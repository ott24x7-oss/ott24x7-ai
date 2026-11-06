import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@cherrystudio/ui'
import desktopLogo from '@renderer/assets/images/logo.png'
import { ipcApi, useIpcOn } from '@renderer/ipc'
import type { EventPayload, OutputFor } from '@shared/ipc/types'
import { OTT_DESKTOP_BUILD } from '@shared/utils/desktopUpdate'

type DesktopUpdateStatus = OutputFor<'app.desktop_update.status.get'>
type DesktopUpdateProgress = EventPayload<'app.desktop_update.download_progress'>

interface DesktopUpdateContextValue {
  status: DesktopUpdateStatus | null
  isReady: boolean
  optionalPromptResolved: boolean
  freeModelsOpen: boolean
  openFreeModels: () => void
  closeFreeModels: () => void
  setFreeModelsOpen: (open: boolean) => void
  optionalUpdateOpen: boolean
  setOptionalUpdateOpen: (open: boolean) => void
  downloading: boolean
  downloadProgress: DesktopUpdateProgress | null
  downloadFailed: boolean
  downloadAndInstall: () => Promise<void>
  openUpdateInBrowser: () => Promise<void>
  canShowOpenRouterPrompt: boolean
  resolveOptionalPrompt: () => void
}

const DesktopUpdateContext = createContext<DesktopUpdateContextValue | null>(null)

export function DesktopUpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [optionalPromptResolved, setOptionalPromptResolved] = useState(false)
  const [optionalUpdateOpen, setOptionalUpdateOpen] = useState(false)
  const [freeModelsOpen, setFreeModelsOpen] = useState(false)
  const [freeModelsRequested, setFreeModelsRequested] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<DesktopUpdateProgress | null>(null)
  const [downloadFailed, setDownloadFailed] = useState(false)

  useEffect(() => {
    let active = true
    void ipcApi
      .request('app.desktop_update.status.get')
      .then((nextStatus) => {
        if (!active) return
        setStatus(nextStatus)
        if (nextStatus.decision === 'OPTIONAL') setOptionalUpdateOpen(true)
        else setOptionalPromptResolved(true)
      })
      .catch(() => {
        if (!active) return
        setStatus({ decision: 'NONE', currentBuild: OTT_DESKTOP_BUILD })
        setOptionalPromptResolved(true)
      })
      .finally(() => {
        if (active) setIsReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  useIpcOn('app.desktop_update.download_progress', setDownloadProgress)

  useEffect(() => {
    if (!isReady) return
    if (status?.decision === 'FORCED') {
      setFreeModelsRequested(false)
      setFreeModelsOpen(false)
    } else if (freeModelsRequested) {
      setFreeModelsRequested(false)
      setFreeModelsOpen(true)
    }
  }, [freeModelsRequested, isReady, status?.decision])

  const resolveOptionalPrompt = useCallback(() => {
    setOptionalUpdateOpen(false)
    setOptionalPromptResolved(true)
  }, [])

  const downloadAndInstall = useCallback(async () => {
    setDownloadFailed(false)
    setDownloadProgress(null)
    setDownloading(true)
    try {
      const launched = await ipcApi.request('app.desktop_update.download_install')
      if (!launched) setDownloadFailed(true)
    } catch {
      setDownloadFailed(true)
    } finally {
      setDownloading(false)
    }
  }, [])

  const openUpdateInBrowser = useCallback(async () => {
    try {
      await ipcApi.request('app.desktop_update.open_in_browser')
    } catch {
      setDownloadFailed(true)
    }
  }, [])

  const openFreeModels = useCallback(() => setFreeModelsRequested(true), [])
  const closeFreeModels = useCallback(() => {
    setFreeModelsRequested(false)
    setFreeModelsOpen(false)
  }, [])
  const setFreeModelsOpenSafely = useCallback(
    (open: boolean) => {
      if (open) openFreeModels()
      else closeFreeModels()
    },
    [closeFreeModels, openFreeModels]
  )
  const handleOptionalOpenChange = useCallback(
    (open: boolean) => {
      if (!open) resolveOptionalPrompt()
      else setOptionalUpdateOpen(true)
    },
    [resolveOptionalPrompt]
  )

  const value = useMemo<DesktopUpdateContextValue>(
    () => ({
      status,
      isReady,
      optionalPromptResolved,
      freeModelsOpen,
      openFreeModels,
      closeFreeModels,
      setFreeModelsOpen: setFreeModelsOpenSafely,
      optionalUpdateOpen,
      setOptionalUpdateOpen: handleOptionalOpenChange,
      downloading,
      downloadProgress,
      downloadFailed,
      downloadAndInstall,
      openUpdateInBrowser,
      canShowOpenRouterPrompt: isReady && status?.decision !== 'FORCED' && optionalPromptResolved,
      resolveOptionalPrompt
    }),
    [
      closeFreeModels,
      downloadAndInstall,
      downloadFailed,
      downloadProgress,
      downloading,
      freeModelsOpen,
      handleOptionalOpenChange,
      isReady,
      openFreeModels,
      openUpdateInBrowser,
      optionalPromptResolved,
      optionalUpdateOpen,
      resolveOptionalPrompt,
      setFreeModelsOpenSafely,
      status
    ]
  )

  return <DesktopUpdateContext value={value}>{children}</DesktopUpdateContext>
}

export function useDesktopUpdate(): DesktopUpdateContextValue {
  const value = use(DesktopUpdateContext)
  if (!value) throw new Error('useDesktopUpdate must be used inside DesktopUpdateProvider')
  return value
}

export function DesktopUpdatePrompt() {
  const { t } = useTranslation()
  const {
    status,
    optionalUpdateOpen,
    setOptionalUpdateOpen,
    downloading,
    downloadProgress,
    downloadFailed,
    downloadAndInstall,
    openUpdateInBrowser
  } = useDesktopUpdate()

  if (!status || status.decision === 'NONE') return null
  const forced = status.decision === 'FORCED'
  const manifest = status.manifest
  const progress = downloadProgress?.progress

  return (
    <Dialog
      open={forced || optionalUpdateOpen}
      onOpenChange={forced ? undefined : setOptionalUpdateOpen}>
      <DialogContent
        aria-describedby="desktop-update-notes"
        aria-labelledby="desktop-update-title"
        closeOnOverlayClick={!forced}
        onEscapeKeyDown={forced ? (event) => event.preventDefault() : undefined}
        onPointerDownOutside={forced ? (event) => event.preventDefault() : undefined}
        overlayClassName={forced ? '!z-[9999] !bg-background' : undefined}
        showCloseButton={!forced}
        size={forced ? 'xl' : 'default'}
        className={
          forced
            ? '!fixed !inset-0 !top-0 !left-0 !z-[10000] !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 !gap-0 !rounded-none !border-0 !bg-background p-8 sm:p-12'
            : 'max-h-[88vh] overflow-y-auto'
        }>
        <div className={forced ? 'mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center text-center' : ''}>
          {forced && <img src={desktopLogo} alt="" className="mb-8 size-20" />}
          <DialogHeader className={forced ? 'items-center text-center' : ''}>
            <DialogTitle id="desktop-update-title">
              {forced ? t('desktop_update.required_title') : t('desktop_update.available_title', { version: manifest.version })}
            </DialogTitle>
            <DialogDescription id="desktop-update-notes" className="whitespace-pre-wrap text-left leading-6">
              {manifest.notes}
            </DialogDescription>
          </DialogHeader>
          {downloading && (
            <div className="mt-5 w-full" role="status" aria-live="polite">
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>{t('desktop_update.downloading')}</span>
                {progress !== null && progress !== undefined && <span>{progress}%</span>}
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={t('desktop_update.downloading')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress ?? undefined}>
                <div
                  className={`h-full rounded-full bg-primary transition-[width] ${progress === null || progress === undefined ? 'w-1/3 animate-pulse' : ''}`}
                  style={progress === null || progress === undefined ? undefined : { width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {downloadFailed && <p role="alert" className="mt-4 text-sm text-destructive">{t('desktop_update.download_failed')}</p>}
          <DialogFooter className={forced ? 'mt-8 w-full flex-col-reverse sm:flex-col' : 'mt-2'}>
            <Button type="button" disabled={downloading} onClick={() => void downloadAndInstall()}>
              {downloading ? t('desktop_update.downloading') : t('desktop_update.update_now')}
            </Button>
            {forced ? (
              <Button type="button" variant="outline" disabled={downloading} onClick={() => void openUpdateInBrowser()}>
                {t('desktop_update.download_in_browser')}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setOptionalUpdateOpen(false)}>
                {t('desktop_update.later')}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
