import type { WebviewTag } from 'electron'
import { ExternalLink, Focus, LogOut, RotateCw, Sparkles, Square, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Tooltip } from '@cherrystudio/ui'
import ChatMarkdown from '@renderer/components/chat/messages/markdown/ChatMarkdown'
import WebviewContainer from '@renderer/components/MiniApp/WebviewContainer'
import { useOptionalTabsContext } from '@renderer/hooks/tab'
import { ipcApi } from '@renderer/ipc'
import { toast } from '@renderer/services/toast'
import type { CompareCliOutput, CompareColumn } from '@renderer/types/compare'
import type { CompareCliId } from '@shared/types/compareCli'

interface CompareWebColumnProps {
  column: Extract<CompareColumn, { kind: 'web' }>
  visible: boolean
  warning: boolean
  onSetRef: (appId: string, webview: WebviewTag | null) => void
  onFocus: () => void
  onRemove: () => void
  onUseInFinalAnswer: (appId: string) => void
}

export function CompareWebColumn({
  column,
  visible,
  warning,
  onSetRef,
  onFocus,
  onRemove,
  onUseInFinalAnswer
}: CompareWebColumnProps) {
  const { t } = useTranslation()
  const tabs = useOptionalTabsContext()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const webviewRef = useRef<WebviewTag | null>(null)
  const [wasVisible, setWasVisible] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [guestVersion, setGuestVersion] = useState(0)

  useEffect(() => {
    if (!visible || wasVisible) return
    const wrapper = wrapperRef.current
    if (!wrapper || typeof IntersectionObserver === 'undefined') {
      setWasVisible(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setWasVisible(true)
        observer.disconnect()
      }
    })
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [visible, wasVisible])

  const handleRef = useCallback(
    (appId: string, webview: WebviewTag | null) => {
      webviewRef.current = webview
      onSetRef(appId, webview)
    },
    [onSetRef]
  )
  const handleLoaded = useCallback(() => {}, [])
  const handleOpenInApps = () =>
    tabs?.openTab(`/app/mini-app/${encodeURIComponent(column.appId)}`, { title: column.name })
  const handleOpenExternal = () => {
    if (column.url.startsWith('https://') || column.url.startsWith('http://')) {
      void ipcApi.request('system.shell.open_external_website', column.url).catch(() => {})
    }
  }
  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      if (column.miniAppKind === 'site' && webviewRef.current) {
        await webviewRef.current.loadURL('about:blank')
      }
      await ipcApi.request('mini_app.sign_out', { appId: column.appId })
    } catch {
      toast.error(t('compare.web.sign_out_failed'))
    } finally {
      setGuestVersion((version) => version + 1)
      setSigningOut(false)
    }
  }

  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background"
      hidden={!visible}>
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{column.name}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {t('compare.web_badge')}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip content={t('compare.focus_model', { model: column.name })}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t('compare.focus_model', { model: column.name })}
              onClick={onFocus}>
              <Focus className="size-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={t('compare.web.reload')}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t('compare.web.reload')}
              onClick={() => webviewRef.current?.reload()}>
              <RotateCw className="size-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={t('compare.web.open_apps')}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t('compare.web.open_apps')}
              onClick={handleOpenInApps}>
              <ExternalLink className="size-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={t('compare.web.open_external')}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t('compare.web.open_external')}
              onClick={handleOpenExternal}>
              <ExternalLink className="size-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={t('compare.web.sign_out')}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t('compare.web.sign_out')}
              disabled={signingOut}
              onClick={() => void handleSignOut()}>
              <LogOut className="size-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={t('chat.input.followup_queue.remove')}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t('chat.input.followup_queue.remove')}
              onClick={onRemove}>
              <X className="size-3.5" />
            </Button>
          </Tooltip>
        </div>
      </header>
      <div ref={wrapperRef} className="relative min-h-0 flex-1 bg-background">
        {wasVisible ? (
          <WebviewContainer
            key={`${column.appId}:${guestVersion}`}
            appid={column.appId}
            url={column.url}
            kind={column.miniAppKind}
            onSetRefCallback={handleRef}
            onLoadedCallback={handleLoaded}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {t('compare.web.panel_load_hint')}
          </div>
        )}
      </div>
      <footer className="flex min-h-8 shrink-0 items-center gap-2 border-t border-border px-2 py-1 text-xs">
        <span className="text-muted-foreground">{t('compare.web.attach_hint')}</span>
        {column.canReadAnswer && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto h-7 px-2"
            onClick={() => onUseInFinalAnswer(column.appId)}>
            <Sparkles className="size-3.5" />
            {t('compare.web.use_in_final')}
          </Button>
        )}
        {warning && (
          <span role="alert" className="text-warning">
            {t('compare.web.send_failed')}
          </span>
        )}
      </footer>
    </section>
  )
}

interface CompareCliColumnProps {
  column: Extract<CompareColumn, { kind: 'cli' }>
  output?: CompareCliOutput
  onCancel: (cliId: CompareCliId) => void
  onFocus: () => void
  onRemove: () => void
}

export function CompareCliColumn({ column, output, onCancel, onFocus, onRemove }: CompareCliColumnProps) {
  const { t } = useTranslation()
  const status = output?.status ?? 'waiting'
  const statusLabel =
    status === 'waiting'
      ? t('compare.status.waiting')
      : status === 'streaming'
        ? t('compare.status.streaming')
        : status === 'done'
          ? t('compare.status.done')
          : t('compare.status.error')
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{column.name}</span>
          <span className="text-xs text-muted-foreground">{statusLabel}</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {status === 'streaming' && (
            <Tooltip content={t('compare.cli.stop')}>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t('compare.cli.stop')}
                onClick={() => onCancel(column.cliId)}>
                <Square className="size-3" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t('compare.focus_model', { model: column.name })}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t('compare.focus_model', { model: column.name })}
              onClick={onFocus}>
              <Focus className="size-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={t('chat.input.followup_queue.remove')}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t('chat.input.followup_queue.remove')}
              onClick={onRemove}>
              <X className="size-3.5" />
            </Button>
          </Tooltip>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {output?.content ? (
          <ChatMarkdown
            block={{
              id: `compare-cli-${column.cliId}`,
              content: output.content,
              status: status === 'streaming' ? 'streaming' : 'success'
            }}
          />
        ) : null}
        {output?.error && (
          <p role="alert" className="text-sm text-error">
            {output.error}
          </p>
        )}
        {!output?.content && !output?.error && status === 'waiting' && (
          <p className="text-sm text-muted-foreground">{t('compare.status.waiting')}</p>
        )}
      </div>
    </section>
  )
}
