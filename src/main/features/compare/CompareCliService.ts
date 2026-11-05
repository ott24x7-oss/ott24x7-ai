import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'

import { application } from '@application'
import { BaseService, Injectable, Phase, ServicePhase } from '@main/core/lifecycle'
import type { CompareCliStreamEvent } from '@shared/ipc/schemas/compareCli'
import type { WindowId } from '@shared/ipc/types'
import type { CompareCliAvailability, CompareCliId } from '@shared/types/compareCli'

import { buildCompareCliArgs, createCliParserState, flushCliOutput, pushCliOutput } from './cliAdapter'

const CLI_IDS: readonly CompareCliId[] = ['claude', 'agy', 'codex']
const CLI_TIMEOUT_MS = 5 * 60 * 1000
const CLI_PROBE_TIMEOUT_MS = 5_000

interface ActiveRun {
  senderId: WindowId
  requestId: string
  cliId: CompareCliId
  child: ChildProcess
  cwd: string
  finish: Promise<void>
  cancel: () => void
}

@Injectable('CompareCliService')
@ServicePhase(Phase.BeforeReady)
export class CompareCliService extends BaseService {
  private readonly activeRuns = new Map<string, ActiveRun>()
  private readonly availabilityProbes = new Set<ChildProcess>()

  /** Called only when a user opens the Compare picker. */
  async available(): Promise<CompareCliAvailability[]> {
    return Promise.all(CLI_IDS.map(async (id) => ({ id, available: await this.isInstalled(id) })))
  }

  async run(senderId: WindowId, requestId: string, cliId: CompareCliId, prompt: string): Promise<void> {
    const key = this.runKey(senderId, requestId)
    if (this.activeRuns.has(key)) throw new Error('A Compare CLI request with this id is already active')

    const appTemp = application.getPath('app.temp')
    const cwd = await mkdtemp(path.join(appTemp, 'compare-cli-'))
    const childEnv = this.environmentFor(cliId)
    const executable = process.platform === 'win32' ? `${cliId}.exe` : cliId
    const args = buildCompareCliArgs(cliId, prompt, cwd)

    let finish!: () => void
    const finished = new Promise<void>((resolve) => {
      finish = resolve
    })
    let child: ChildProcess
    try {
      child = spawn(executable, args, {
        cwd,
        env: childEnv,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      })
    } catch {
      await this.removeTempDirectory(appTemp, cwd)
      this.send(senderId, { requestId, cliId, type: 'error', code: 'launch' })
      return
    }

    let completed = false
    let cancelled = false
    let timedOut = false
    const parser = createCliParserState()
    const emit = (event: CompareCliStreamEvent) => this.send(senderId, event)
    const complete = async (code: number | null, failedToStart = false) => {
      if (completed) return
      completed = true
      clearTimeout(timer)
      for (const text of flushCliOutput(cliId, parser)) emit({ requestId, cliId, type: 'delta', text })
      this.activeRuns.delete(key)
      await this.removeTempDirectory(appTemp, cwd)
      if (cancelled) emit({ requestId, cliId, type: 'cancelled' })
      else if (timedOut) emit({ requestId, cliId, type: 'error', code: 'timeout' })
      else if (failedToStart) {
        emit({ requestId, cliId, type: 'error', code: 'launch' })
      } else if (code === 0) emit({ requestId, cliId, type: 'done' })
      else emit({ requestId, cliId, type: 'error', code: 'failed' })
      finish()
    }
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, CLI_TIMEOUT_MS)
    timer.unref()

    const run: ActiveRun = {
      senderId,
      requestId,
      cliId,
      child,
      cwd,
      finish: finished,
      cancel: () => {
        cancelled = true
        child.kill()
      }
    }
    this.activeRuns.set(key, run)

    child.stdout?.on('data', (data: Buffer | string) => {
      for (const text of pushCliOutput(cliId, String(data), parser)) emit({ requestId, cliId, type: 'delta', text })
    })
    child.once('error', () => void complete(null, true))
    child.once('close', (code) => void complete(code))
  }

  cancel(senderId: WindowId, requestId: string): void {
    this.activeRuns.get(this.runKey(senderId, requestId))?.cancel()
  }

  protected async onStop(): Promise<void> {
    const runs = [...this.activeRuns.values()]
    for (const run of runs) run.cancel()
    for (const probe of this.availabilityProbes) probe.kill()
    await Promise.allSettled(runs.map((run) => run.finish))
  }

  private async isInstalled(cliId: CompareCliId): Promise<boolean> {
    const executable = process.platform === 'win32' ? `${cliId}.exe` : cliId
    return new Promise((resolve) => {
      let settled = false
      let child: ChildProcess | undefined
      const settle = (available: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (child) this.availabilityProbes.delete(child)
        resolve(available)
      }
      const timer = setTimeout(() => {
        child?.kill()
        settle(false)
      }, CLI_PROBE_TIMEOUT_MS)
      timer.unref()
      try {
        child = spawn(executable, ['--version'], {
          env: this.environmentFor(cliId),
          shell: false,
          windowsHide: true,
          stdio: 'ignore'
        })
        this.availabilityProbes.add(child)
        child.once('error', () => settle(false))
        child.once('close', (code) => settle(code === 0))
      } catch {
        settle(false)
      }
    })
  }

  private environmentFor(cliId: CompareCliId): NodeJS.ProcessEnv {
    const env = { ...process.env }
    const keysByCli: Record<CompareCliId, string[]> = {
      claude: ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_CUSTOM_HEADERS'],
      agy: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_USE_VERTEXAI'],
      codex: ['OPENAI_API_KEY', 'OPENAI_BASE_URL']
    }
    for (const key of keysByCli[cliId]) delete env[key]
    return env
  }

  private send(senderId: WindowId, payload: CompareCliStreamEvent): void {
    try {
      application.get('IpcApiService').send(senderId, 'compare_cli.stream', payload)
    } catch {
      // The owner may already be stopping; CLI output is intentionally not logged.
    }
  }

  private runKey(senderId: WindowId, requestId: string): string {
    return `${senderId}:${requestId}`
  }

  private async removeTempDirectory(appTemp: string, cwd: string): Promise<void> {
    const relative = path.relative(path.resolve(appTemp), path.resolve(cwd))
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return
    await rm(cwd, { recursive: true, force: true }).catch(() => {})
  }
}
