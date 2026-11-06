import type { WebviewTag } from 'electron'
import {
  ArrowDown,
  Check,
  CircleAlert,
  ClipboardCopy,
  Ellipsis,
  ExternalLink,
  Focus,
  LogIn,
  LogOut,
  RotateCw,
  Sparkles,
  Square,
  TerminalSquare,
  X
} from 'lucide-react'
import { memo, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Switch,
  Tooltip
} from '@cherrystudio/ui'
import ChatMarkdown from '@renderer/components/chat/messages/markdown/ChatMarkdown'
import MiniAppIcon from '@renderer/components/icons/MiniAppIcon'
import WebviewContainer from '@renderer/components/MiniApp/WebviewContainer'
import { ipcApi } from '@renderer/ipc'
import { toast } from '@renderer/services/toast'
import type { CompareCliOutput, CompareColumn, CompareColumnId, CompareDeliveryResult } from '@renderer/types/compare'
import { cn } from '@renderer/utils/style'
import type { CompareCliId } from '@shared/types/compareCli'

const SUSPEND_HIDDEN_WEBVIEW_AFTER_MS = 10 * 60 * 1000

interface CompareColumnHeaderProps {
  id: CompareColumnId
  name: string
  badge: string
  icon?: ReactNode
  enabled: boolean
  focused: boolean
  onToggle: () => void
  onFocus: () => void
  onRegenerate?: () => void
  onReload?: () => void
  onOpenExternal?: () => void
  onSignOut?: () => void
  onCancel?: () => void
  onRemove: () => void
  onReorder: (sourceId: CompareColumnId, targetId: CompareColumnId) => void
  onUseInFinalAnswer?: () => void
  isStreaming?: boolean
  delivery?: CompareDeliveryResult
  onSignIn?: () => void
}

export const CompareColumnHeader = memo(function CompareColumnHeader({
  id,
  name,
  badge,
  icon,
  enabled,
  focused,
  onToggle,
  onFocus,
  onRegenerate,
  onReload,
  onOpenExternal,
  onSignOut,
  onCancel,
  onRemove,
  onReorder,
  onUseInFinalAnswer,
  isStreaming,
  delivery,
  onSignIn
}: CompareColumnHeaderProps) {
  const { t } = useTranslation()
  return (
    <header
      draggable
      onDragStart={(event) => {
        if ((event.target as HTMLElement).closest('button')) {
          event.preventDefault()
          return
        }
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', id)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const sourceId = event.dataTransfer.getData('text/plain') as CompareColumnId
        if (sourceId) onReorder(sourceId, id)
      }}
      className="flex shrink-0 flex-col gap-1.5 border-b border-border px-3 py-2">
      <div className="flex h-8 min-w-0 w-full items-center gap-1.5">
        {icon && (
          <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={name}>
          {name}
        </span>
        <span className="shrink-0 rounded-full border border-border bg-background px-1.5 py-0.5 text-[9px] font-medium uppercase leading-none tracking-wide text-muted-foreground">
          {badge}
        </span>
        <Tooltip content={t('compare.column.toggle', { model: name })}>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            aria-label={t('compare.column.toggle', { model: name })}
            className="shrink-0 data-[state=checked]:bg-(--cs-theme-primary)"
          />
        </Tooltip>
        <Tooltip content={t(focused ? 'compare.exit_focus' : 'compare.focus_model', { model: name })}>
          <Button
            type="button"
            size="icon-sm"
            variant={focused ? 'secondary' : 'ghost'}
            aria-label={t(focused ? 'compare.exit_focus' : 'compare.focus_model', { model: name })}
            aria-pressed={focused}
            onClick={onFocus}>
            <Focus className="size-3.5" />
          </Button>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={t('compare.column.more_actions')}>
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isStreaming && onCancel && (
              <DropdownMenuItem onSelect={onCancel}>
                <Square className="mr-2 size-3" />
                {t('compare.cli.stop')}
              </DropdownMenuItem>
            )}
            {onReload && (
              <DropdownMenuItem disabled={!enabled} onSelect={onReload}>
                <RotateCw className="mr-2 size-3.5" />
                {t('compare.web.reload')}
              </DropdownMenuItem>
            )}
            {onRegenerate && (
              <DropdownMenuItem disabled={!enabled} onSelect={onRegenerate}>
                <RotateCw className="mr-2 size-3.5" />
                {t('compare.column.regenerate')}
              </DropdownMenuItem>
            )}
            {onOpenExternal && (
              <DropdownMenuItem onClick={onOpenExternal}>
                <ExternalLink className="mr-2 size-3.5" />
                {t('compare.web.open_external')}
              </DropdownMenuItem>
            )}
            {onSignOut && (
              <DropdownMenuItem onClick={onSignOut}>
                <LogOut className="mr-2 size-3.5" />
                {t('compare.web.sign_out')}
              </DropdownMenuItem>
            )}
            {onUseInFinalAnswer && (
              <DropdownMenuItem onSelect={onUseInFinalAnswer}>
                <Sparkles className="mr-2 size-3.5" />
                {t('compare.web.use_in_final')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-error" onClick={onRemove}>
              <X className="mr-2 size-3.5" />
              {t('chat.input.followup_queue.remove')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CompareDeliveryChip delivery={delivery} onSignIn={onSignIn} />
    </header>
  )
})

function CompareDeliveryChip({ delivery, onSignIn }: { delivery?: CompareDeliveryResult; onSignIn?: () => void }) {
  const { t } = useTranslation()
  if (!delivery) return null

  const className =
    delivery.status === 'sent'
      ? 'border-success-border bg-success-subtle text-success-subtle-foreground'
      : delivery.status === 'login-needed'
        ? 'border-warning-border bg-warning-subtle text-warning-subtle-foreground'
        : delivery.status === 'copied'
          ? 'border-border-selected bg-primary/10 text-primary'
          : 'border-error-border bg-error-subtle text-error-subtle-foreground'
  const label =
    delivery.status === 'sent'
      ? t('compare.delivery.sent')
      : delivery.status === 'login-needed'
        ? t('compare.delivery.sign_in_needed')
        : delivery.status === 'copied'
          ? t('compare.delivery.copied')
          : t('compare.delivery.error', { reason: delivery.reason ?? '' })
  const Icon =
    delivery.status === 'sent'
      ? Check
      : delivery.status === 'login-needed'
        ? LogIn
        : delivery.status === 'copied'
          ? ClipboardCopy
          : CircleAlert

  return (
    <div
      role={delivery.status === 'error' ? 'alert' : undefined}
      className={`flex min-h-6 items-center gap-1.5 text-[11px] ${delivery.status === 'error' ? 'text-error' : ''}`}>
      <span className={`inline-flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 ${className}`}>
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        <span>{label}</span>
        {delivery.status === 'login-needed' && onSignIn && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-1 h-5 rounded-full border-warning-border bg-background px-2 py-0 text-[10px] font-medium text-warning-subtle-foreground hover:bg-warning-subtle"
            onClick={onSignIn}>
            {t('compare.delivery.sign_in')}
          </Button>
        )}
      </span>
    </div>
  )
}

interface CompareWebColumnProps {
  column: Extract<CompareColumn, { kind: 'web' }>
  visible: boolean
  warning: boolean
  onSetRef: (appId: string, webview: WebviewTag | null) => void
  focused: boolean
  onFocusModel: (id: CompareColumnId | null) => void
  onToggleModel: (id: CompareColumnId) => void
  onRemoveModel: (id: CompareColumnId) => void
  onRegenerateModel: (id: CompareColumnId) => void
  onReorder: (sourceId: CompareColumnId, targetId: CompareColumnId) => void
  onUseInFinalAnswer: (appId: string) => void
  delivery?: CompareDeliveryResult
}

export const CompareWebColumn = memo(function CompareWebColumn({
  column,
  visible,
  warning,
  onSetRef,
  focused,
  onFocusModel,
  onToggleModel,
  onRemoveModel,
  onRegenerateModel,
  onReorder,
  onUseInFinalAnswer,
  delivery
}: CompareWebColumnProps) {
  const { t } = useTranslation()
  const wrapperRef = useRef<HTMLElement>(null)
  const webviewRef = useRef<WebviewTag | null>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [wasVisible, setWasVisible] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [guestVersion, setGuestVersion] = useState(0)
  const onFocus = useCallback(() => onFocusModel(focused ? null : column.id), [column.id, focused, onFocusModel])
  const onSignIn = useCallback(() => {
    onFocusModel(column.id)
    webviewRef.current?.focus()
  }, [column.id, onFocusModel])
  const onToggle = useCallback(() => onToggleModel(column.id), [column.id, onToggleModel])
  const onRemove = useCallback(() => onRemoveModel(column.id), [column.id, onRemoveModel])
  const onRegenerate = useCallback(() => onRegenerateModel(column.id), [column.id, onRegenerateModel])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || typeof IntersectionObserver === 'undefined') {
      setIsIntersecting(visible)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      setIsIntersecting(entries.some((entry) => entry.isIntersecting))
    })
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (column.enabled && visible && isIntersecting) {
      setWasVisible(true)
      return
    }
    if (!wasVisible) return
    const timeout = window.setTimeout(() => setWasVisible(false), SUSPEND_HIDDEN_WEBVIEW_AFTER_MS)
    return () => window.clearTimeout(timeout)
  }, [column.enabled, isIntersecting, visible, wasVisible])

  const handleRef = useCallback(
    (appId: string, webview: WebviewTag | null) => {
      webviewRef.current = webview
      onSetRef(appId, webview)
    },
    [onSetRef]
  )
  const openExternal = useCallback(() => {
    if (column.url.startsWith('https://') || column.url.startsWith('http://')) {
      void ipcApi.request('system.shell.open_external_website', column.url).catch(() => {})
    }
  }, [column.url])
  const signOut = useCallback(async () => {
    setSigningOut(true)
    try {
      if (column.miniAppKind === 'site' && webviewRef.current) await webviewRef.current.loadURL('about:blank')
      await ipcApi.request('mini_app.sign_out', { appId: column.appId })
    } catch {
      toast.error(t('compare.web.sign_out_failed'))
    } finally {
      setGuestVersion((version) => version + 1)
      setSigningOut(false)
    }
  }, [column.appId, column.miniAppKind, t])
  const icon = (
    <MiniAppIcon
      app={{
        name: column.name,
        logo: column.logo,
        logoSrc: column.logoSrc,
        background: column.background
      }}
      appearance="bare"
      size={20}
    />
  )

  return (
    <section
      ref={wrapperRef}
      hidden={!visible}
      className="flex h-full min-h-0 min-w-[380px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      <CompareColumnHeader
        id={column.id}
        name={column.name}
        badge={t('compare.web_badge')}
        icon={icon}
        enabled={column.enabled}
        focused={focused}
        onToggle={onToggle}
        onFocus={onFocus}
        onRegenerate={onRegenerate}
        onReload={() => webviewRef.current?.reload()}
        onOpenExternal={openExternal}
        onSignOut={column.miniAppKind === 'site' ? () => void signOut() : undefined}
        onRemove={onRemove}
        onReorder={onReorder}
        onUseInFinalAnswer={column.canReadAnswer ? () => onUseInFinalAnswer(column.appId) : undefined}
        delivery={delivery}
        onSignIn={onSignIn}
      />
      <div className="relative min-h-0 flex-1 bg-background">
        {wasVisible ? (
          <div className={cn('absolute inset-0', column.enabled ? 'visible' : 'invisible pointer-events-none')}>
            <WebviewContainer
              key={`${column.appId}:${guestVersion}`}
              appid={column.appId}
              url={column.url}
              kind={column.miniAppKind}
              onSetRefCallback={handleRef}
              onLoadedCallback={() => {}}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {t('compare.web.panel_load_hint')}
          </div>
        )}
        {!column.enabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 text-sm text-muted-foreground">
            {t('compare.column.disabled')}
          </div>
        )}
      </div>
      {warning && (
        <footer className="flex min-h-7 shrink-0 items-center gap-2 border-t border-border px-2 py-1 text-xs">
          <span role="alert" className="text-warning">
            {t('compare.web.send_failed')}
          </span>
        </footer>
      )}
      {signingOut && <span className="sr-only">{t('common.loading')}</span>}
    </section>
  )
})

interface CompareCliColumnProps {
  column: Extract<CompareColumn, { kind: 'cli' }>
  output?: CompareCliOutput
  visible: boolean
  onCancel: (cliId: CompareCliId) => void
  focused: boolean
  onFocusModel: (id: CompareColumnId | null) => void
  onToggleModel: (id: CompareColumnId) => void
  onRemoveModel: (id: CompareColumnId) => void
  onRegenerateModel: (id: CompareColumnId) => void
  onReorder: (sourceId: CompareColumnId, targetId: CompareColumnId) => void
  delivery?: CompareDeliveryResult
}

export const CompareCliColumn = memo(function CompareCliColumn({
  column,
  output,
  visible,
  onCancel,
  focused,
  onFocusModel,
  onToggleModel,
  onRemoveModel,
  onRegenerateModel,
  onReorder,
  delivery
}: CompareCliColumnProps) {
  const { t } = useTranslation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const outputTurnKey = output ? `${output.prompt ?? ''}:${output.requestId ?? ''}` : undefined
  const lastPromptRef = useRef(outputTurnKey)
  const shouldFollowRef = useRef(true)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const status = output?.status ?? 'waiting'
  const statusLabel =
    status === 'waiting'
      ? t('compare.status.waiting')
      : status === 'streaming'
        ? t('compare.status.streaming')
        : status === 'done'
          ? t('compare.status.done')
          : t('compare.status.error')
  const onFocus = useCallback(() => onFocusModel(focused ? null : column.id), [column.id, focused, onFocusModel])
  const onToggle = useCallback(() => onToggleModel(column.id), [column.id, onToggleModel])
  const onRemove = useCallback(() => onRemoveModel(column.id), [column.id, onRemoveModel])
  const onRegenerate = useCallback(() => onRegenerateModel(column.id), [column.id, onRegenerateModel])
  const syncScrollButton = useCallback(() => {
    const element = scrollContainerRef.current
    if (!element) return
    const atBottom = element.scrollHeight - element.clientHeight - element.scrollTop <= 24
    setShowScrollToBottom(!atBottom)
    if (atBottom) shouldFollowRef.current = true
  }, [])
  const scrollToBottom = useCallback(() => {
    const element = scrollContainerRef.current
    if (!element) return
    shouldFollowRef.current = true
    element.scrollTop = element.scrollHeight
    syncScrollButton()
  }, [syncScrollButton])

  useEffect(() => {
    if (!visible || !column.enabled || !output?.prompt || lastPromptRef.current === outputTurnKey) return
    lastPromptRef.current = outputTurnKey
    scrollToBottom()
  }, [column.enabled, output?.prompt, outputTurnKey, scrollToBottom, visible])

  useEffect(() => {
    if (!visible || !column.enabled || !shouldFollowRef.current) return
    scrollToBottom()
  }, [column.enabled, output?.content, scrollToBottom, visible])

  return (
    <section
      hidden={!visible}
      className="flex h-full min-h-0 min-w-[380px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      <CompareColumnHeader
        id={column.id}
        name={column.name}
        badge={t('compare.cli_badge')}
        icon={<TerminalSquare className="size-4 shrink-0 text-muted-foreground" />}
        enabled={column.enabled}
        focused={focused}
        onToggle={onToggle}
        onFocus={onFocus}
        onRegenerate={onRegenerate}
        onCancel={status === 'streaming' ? () => onCancel(column.cliId) : undefined}
        onRemove={onRemove}
        onReorder={onReorder}
        isStreaming={status === 'streaming'}
        delivery={delivery}
      />
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollContainerRef}
          role="region"
          aria-label={column.name}
          className="h-full overflow-y-auto p-4"
          onScroll={() => {
            const element = scrollContainerRef.current
            if (!element) return
            const atBottom = element.scrollHeight - element.clientHeight - element.scrollTop <= 24
            setShowScrollToBottom(!atBottom)
            shouldFollowRef.current = atBottom
          }}>
          {!column.enabled ? (
            <p className="text-sm text-muted-foreground">{t('compare.column.disabled')}</p>
          ) : (
            <>
              {output?.prompt && (
                <div className="mb-4 flex justify-end">
                  <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {output.prompt}
                  </p>
                </div>
              )}
              {output?.content ? (
                <ChatMarkdown
                  block={{
                    id: `compare-cli-${column.cliId}`,
                    content: output.content,
                    status: status === 'streaming' ? 'streaming' : 'success'
                  }}
                />
              ) : output?.error ? (
                <p role="alert" className="text-sm text-error">
                  {output.error}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{statusLabel}</p>
              )}
            </>
          )}
        </div>
        {showScrollToBottom && (
          <Tooltip content={t('chat.navigation.bottom')}>
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              aria-label={t('chat.navigation.bottom')}
              className="absolute right-3 bottom-3 z-10 rounded-full shadow-sm"
              onClick={scrollToBottom}>
              <ArrowDown className="size-3.5" />
            </Button>
          </Tooltip>
        )}
      </div>
    </section>
  )
})
