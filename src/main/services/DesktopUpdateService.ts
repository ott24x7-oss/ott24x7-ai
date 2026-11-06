import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

import { app, shell } from 'electron'

import { application } from '@application'
import { loggerService } from '@logger'
import { BaseService, Injectable, Phase, ServicePhase } from '@main/core/lifecycle'
import { isWin } from '@main/core/platform'
import { WindowType } from '@main/core/window/types'
import type { OutputFor } from '@shared/ipc/types'
import {
  decideDesktopUpdate,
  DESKTOP_UPDATE_MANIFEST_URL,
  isAllowedDesktopInstallerUrl,
  OTT_DESKTOP_BUILD,
  parseDesktopUpdateManifest
} from '@shared/utils/desktopUpdate'

const logger = loggerService.withContext('DesktopUpdateService')
type DesktopUpdateStatus = OutputFor<'app.desktop_update.status.get'>

@Injectable('DesktopUpdateService')
@ServicePhase(Phase.WhenReady)
export class DesktopUpdateService extends BaseService {
  private manifestPromise: Promise<ReturnType<typeof parseDesktopUpdateManifest>> | null = null
  private installInProgress = false

  protected async onInit(): Promise<void> {
    this.manifestPromise = this.loadManifest()
  }

  async getStatus(): Promise<DesktopUpdateStatus> {
    const manifest = await (this.manifestPromise ??= this.loadManifest())
    const decision = decideDesktopUpdate(OTT_DESKTOP_BUILD, manifest)
    if (!manifest || decision === 'NONE') return { decision: 'NONE', currentBuild: OTT_DESKTOP_BUILD }
    return { decision, currentBuild: OTT_DESKTOP_BUILD, manifest }
  }

  async downloadAndInstall(): Promise<boolean> {
    const status = await this.getStatus()
    if (status.decision === 'NONE') return false
    if (!isWin || !app.isPackaged) {
      await this.openInstallerInBrowser(status.manifest.url)
      return false
    }
    if (this.installInProgress) return false

    this.installInProgress = true
    const installerPath = application.getPath('app.temp', `ott24x7-ai-update-${status.manifest.latestBuild}.exe`)
    try {
      await this.downloadInstaller(status.manifest.url, installerPath)
      await this.startInstaller(installerPath)
      application.quit()
      return true
    } catch (error) {
      logger.warn('Desktop update install failed; opening the installer in the browser', {
        errorType: error instanceof Error ? error.name : typeof error
      })
      await this.openInstallerInBrowser(status.manifest.url)
      return false
    } finally {
      this.installInProgress = false
    }
  }

  async openLatestInBrowser(): Promise<void> {
    const manifest = await (this.manifestPromise ??= this.loadManifest())
    if (manifest) await this.openInstallerInBrowser(manifest.url)
  }

  private async loadManifest() {
    const manifestUrl = !app.isPackaged
      ? process.env.OTT_UPDATE_MANIFEST_URL?.trim() || DESKTOP_UPDATE_MANIFEST_URL
      : DESKTOP_UPDATE_MANIFEST_URL

    try {
      const response = await fetch(manifestUrl, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(8_000)
      })
      if (!response.ok) return null
      return parseDesktopUpdateManifest(await response.text())
    } catch {
      logger.warn('Desktop update manifest could not be loaded')
      return null
    }
  }

  private async downloadInstaller(url: string, installerPath: string): Promise<void> {
    if (!isAllowedDesktopInstallerUrl(url)) throw new Error('Installer URL is not allowed')
    const response = await fetch(url, { signal: AbortSignal.timeout(30 * 60_000) })
    if (!response.ok || !response.body) throw new Error('Installer download failed')
    if (response.url && !isAllowedDesktopInstallerUrl(response.url))
      throw new Error('Installer redirect is not allowed')

    const contentLength = Number(response.headers.get('content-length'))
    const totalBytes = Number.isSafeInteger(contentLength) && contentLength > 0 ? contentLength : null
    let downloadedBytes = 0
    let lastProgress: number | null = -1
    const progressStream = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        downloadedBytes += chunk.length
        const progress = totalBytes ? Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100)) : null
        if (progress === lastProgress) return callback(null, chunk)
        lastProgress = progress
        application.get('IpcApiService').broadcastToType(WindowType.Main, 'app.desktop_update.download_progress', {
          downloadedBytes,
          totalBytes,
          progress
        })
        callback(null, chunk)
      }
    })

    await pipeline(
      Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
      progressStream,
      createWriteStream(installerPath)
    )
  }

  private async startInstaller(installerPath: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const installer = spawn(installerPath, [], { detached: true, stdio: 'ignore' })
      installer.once('error', reject)
      installer.once('spawn', () => {
        installer.unref()
        resolve()
      })
    })
  }

  private async openInstallerInBrowser(url: string): Promise<void> {
    try {
      await shell.openExternal(url)
    } catch {
      logger.warn('Desktop update installer link could not be opened')
    }
  }
}
