import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { access, unlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { promisify } from 'node:util'

import { application } from '@application'
import { loggerService } from '@logger'
import { BaseService, Injectable, Phase, ServicePhase } from '@main/core/lifecycle'
import { isWin } from '@main/core/platform'
import { WindowType } from '@main/core/window/types'

import { OllamaClient, detectOllamaState, type OllamaInstallation } from './ollamaClient'
import { OllamaPullManager } from './OllamaPullManager'

const logger = loggerService.withContext('OllamaService')
const execFileAsync = promisify(execFile)
const OLLAMA_INSTALLER_URL = 'https://ollama.com/download/OllamaSetup.exe'
const ALLOWED_INSTALLER_HOSTS = new Set([
  'ollama.com',
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com'
])

export interface OllamaDeviceInfo {
  totalMemoryBytes: number
  gpu: { name: string; vramBytes: number } | null
}

export async function findOllamaInstallation(): Promise<OllamaInstallation | null> {
  const serverPaths = isWin ? await findOnPath() : []
  const defaultDirectories = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Ollama')
  ].filter((directory): directory is string => Boolean(directory))
  const directories = [
    ...new Set([...serverPaths.map((serverPath) => path.dirname(serverPath)), ...defaultDirectories])
  ]

  for (const directory of directories) {
    const serverPath = serverPaths.find(
      (candidate) => path.dirname(candidate).toLowerCase() === directory.toLowerCase()
    )
    const appPath = await firstExisting([path.join(directory, 'ollama app.exe'), path.join(directory, 'Ollama.exe')])
    const server = serverPath ?? (await firstExisting([path.join(directory, 'ollama.exe')]))
    if (server || appPath) return { ...(server && { serverPath: server }), ...(appPath && { appPath }) }
  }
  return null
}

async function findOnPath(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('where.exe', ['ollama.exe'], { windowsHide: true, timeout: 2_000 })
    return stdout
      .split(/\r?\n/)
      .map((candidate) => candidate.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

async function firstExisting(candidates: string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Check the next Windows-correct install candidate.
    }
  }
  return undefined
}

export async function getOllamaDeviceInfo(): Promise<OllamaDeviceInfo> {
  if (!isWin) return { totalMemoryBytes: os.totalmem(), gpu: null }
  try {
    const script =
      'Get-CimInstance -ClassName Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress'
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
      {
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 32_768
      }
    )
    const value: unknown = JSON.parse(stdout)
    const rows = Array.isArray(value) ? value : [value]
    const gpu = rows
      .filter((row): row is { Name?: unknown; AdapterRAM?: unknown } => typeof row === 'object' && row !== null)
      .map((row) => ({
        name: typeof row.Name === 'string' ? row.Name.trim() : '',
        vramBytes: typeof row.AdapterRAM === 'number' ? row.AdapterRAM : Number(row.AdapterRAM)
      }))
      .filter((row) => row.name && Number.isFinite(row.vramBytes) && row.vramBytes > 0)
      .sort((left, right) => right.vramBytes - left.vramBytes)[0]
    return { totalMemoryBytes: os.totalmem(), gpu: gpu ?? null }
  } catch (error) {
    logger.warn('GPU details could not be detected', { errorType: error instanceof Error ? error.name : typeof error })
    return { totalMemoryBytes: os.totalmem(), gpu: null }
  }
}

@Injectable('OllamaService')
@ServicePhase(Phase.WhenReady)
export class OllamaService extends BaseService {
  private readonly client = new OllamaClient()
  private readonly pulls = new OllamaPullManager(this.client, (jobId, modelName, progress) => {
    application.get('IpcApiService').broadcastToType(WindowType.Main, 'ollama.progress', {
      jobId,
      operation: 'model-pull',
      modelName,
      status: progress.status,
      percent: progress.percent
    })
  })
  private installerInProgress = false

  async getStatus() {
    const [status, device] = await Promise.all([
      detectOllamaState(this.client, findOllamaInstallation),
      getOllamaDeviceInfo()
    ])
    return { ...status, device }
  }

  listModels() {
    return this.client.getTags()
  }

  pullModel(jobId: string, modelName: string) {
    return this.pulls.pull(jobId, modelName)
  }

  cancelPull(jobId: string): { cancelled: boolean } {
    return { cancelled: this.pulls.cancel(jobId) }
  }

  async deleteModel(modelName: string): Promise<void> {
    await this.client.delete(modelName)
  }

  async start(): Promise<void> {
    const installation = await findOllamaInstallation()
    if (!installation) throw new Error('Ollama is not installed')
    const executable = installation.appPath ?? installation.serverPath
    if (!executable) throw new Error('Ollama installation could not be started')
    const args = installation.appPath ? [] : ['serve']
    await new Promise<void>((resolve, reject) => {
      const process = spawn(executable, args, { detached: true, stdio: 'ignore', windowsHide: true })
      process.once('error', reject)
      process.once('spawn', () => {
        process.unref()
        resolve()
      })
    })
  }

  async install(): Promise<void> {
    if (!isWin) throw new Error('Ollama installer is available for Windows only')
    if (this.installerInProgress) throw new Error('Ollama installation is already in progress')
    this.installerInProgress = true
    const installerPath = application.getPath('app.temp', 'OllamaSetup.exe')
    try {
      await this.downloadInstaller(installerPath)
      await new Promise<void>((resolve, reject) => {
        const installer = spawn(installerPath, [], { detached: true, stdio: 'ignore', windowsHide: true })
        installer.once('error', reject)
        installer.once('spawn', () => {
          installer.unref()
          resolve()
        })
      })
    } finally {
      this.installerInProgress = false
    }
  }

  protected async onStop(): Promise<void> {
    this.pulls.cancelAll()
  }

  private async downloadInstaller(installerPath: string): Promise<void> {
    const response = await fetch(OLLAMA_INSTALLER_URL, { signal: AbortSignal.timeout(30 * 60_000) })
    if (!response.ok || !response.body || !isAllowedInstallerUrl(response.url || OLLAMA_INSTALLER_URL)) {
      throw new Error('Ollama installer download failed')
    }
    const contentLength = Number(response.headers.get('content-length'))
    const totalBytes = Number.isSafeInteger(contentLength) && contentLength > 0 ? contentLength : null
    let downloadedBytes = 0
    let lastPercent: number | null | undefined
    const progress = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        downloadedBytes += chunk.length
        const percent = totalBytes ? Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100)) : null
        if (percent !== lastPercent) {
          lastPercent = percent
          application.get('IpcApiService').broadcastToType(WindowType.Main, 'ollama.progress', {
            jobId: 'installer',
            operation: 'installer',
            percent,
            status: 'Downloading Ollama installer'
          })
        }
        callback(null, chunk)
      }
    })
    try {
      await pipeline(
        Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
        progress,
        createWriteStream(installerPath)
      )
    } catch (error) {
      await unlink(installerPath).catch(() => {})
      throw error
    }
  }
}

function isAllowedInstallerUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ALLOWED_INSTALLER_HOSTS.has(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}
