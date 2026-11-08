import { arrayMove } from '@dnd-kit/sortable'
import {
  CircleOff,
  LoaderCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquarePen,
  Sun,
  WifiOff
} from 'lucide-react'
import { type ReactElement, type Ref } from 'react'
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Popover, PopoverContent, PopoverTrigger } from '@cherrystudio/ui'
import { usePersistCache } from '@data/hooks/useCache'
import brandLogo from '@renderer/assets/images/logo.png'
import { SidebarPromoCard } from '@renderer/components/app/PromoCard'
import { useTabs } from '@renderer/hooks/tab'
import { useSidebarShortcuts } from '@renderer/hooks/useSidebarShortcuts'
import { useTheme } from '@renderer/hooks/useTheme'
import { useTopicMutations } from '@renderer/hooks/useTopic'
import { openSettingsTab } from '@renderer/services/mainWindowNavigation'
import { toast } from '@renderer/services/toast'
import { isMac } from '@renderer/utils/platform'
import { ThemeMode } from '@shared/data/preference/preferenceTypes'

import { CommandTooltip } from '../command'
import { HelpMenu } from '../layout/HelpMenu'
import {
  getSidebarDisplayWidth,
  getSidebarLayout,
  normalizeSidebarWidth,
  type ResolvedSidebarEntry,
  type SidebarIconPresentation,
  type SidebarUser,
  SIDEBAR_ICON_WIDTH,
  type SidebarVisibleLayout,
  Sidebar as UISidebar
} from '../Sidebar'
import { UserAccountPanel } from '../UserAccountPanel'
import {
  useResolvedSidebarShortcuts,
  useSidebarNavigationSnapshot,
  useSidebarShortcutActivation,
  useSidebarShortcutRegistry
} from './sidebarShortcuts'

function applyEntryOrder(entries: ResolvedSidebarEntry[], orderedKeys: readonly string[]): ResolvedSidebarEntry[] {
  const byKey = new Map(entries.map((entry) => [entry.key, entry]))
  const optimisticKeys = new Set(orderedKeys)
  return [
    ...orderedKeys.flatMap((key) => {
      const entry = byKey.get(key)
      return entry ? [entry] : []
    }),
    ...entries.filter((entry) => !optimisticKeys.has(entry.key))
  ]
}

const SIDEBAR_EXPANDED_WIDTH = 200

export default function Sidebar({
  ref,
  isFullscreen = false
}: {
  ref?: Ref<HTMLDivElement | null>
  isFullscreen?: boolean
}) {
  const { t } = useTranslation()
  const showUserInFooter = isMac && !isFullscreen
  const { openTab } = useTabs()
  const { createTopic } = useTopicMutations()
  const { shortcuts, remove, reorder } = useSidebarShortcuts()
  const registry = useSidebarShortcutRegistry()
  const resolutions = useResolvedSidebarShortcuts(shortcuts, registry)
  const activateShortcut = useSidebarShortcutActivation()
  const navigation = useSidebarNavigationSnapshot()

  const [sidebarWidth, setSidebarWidth] = usePersistCache('ui.sidebar.width')
  const [previewSidebarWidth, setPreviewSidebarWidth] = useState<number | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuOpenedByPointerRef = useRef(false)
  const [hoverVisible, setHoverVisible] = useState(false)
  const activeSidebarWidth = previewSidebarWidth ?? sidebarWidth
  const layout = getSidebarLayout(activeSidebarWidth)

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${getSidebarDisplayWidth(activeSidebarWidth)}px`)
  }, [activeSidebarWidth])

  useEffect(() => {
    if (previewSidebarWidth !== null) return
    const normalizedWidth = normalizeSidebarWidth(sidebarWidth)
    if (normalizedWidth !== sidebarWidth) setSidebarWidth(normalizedWidth)
  }, [previewSidebarWidth, setSidebarWidth, sidebarWidth])

  useEffect(() => {
    if (layout === 'hidden') {
      setUserMenuOpen(false)
      setHoverVisible(false)
    }
  }, [layout])

  const handleUserMenuOpenChange = useCallback(
    (open: boolean) => {
      setUserMenuOpen(open)
      if (!open && layout === 'hidden') setHoverVisible(false)
    },
    [layout]
  )
  const handleUserMenuToggle = useCallback(
    () => handleUserMenuOpenChange(!userMenuOpen),
    [handleUserMenuOpenChange, userMenuOpen]
  )
  useEffect(() => {
    if (!userMenuOpen) return
    const handleWindowBlur = () => handleUserMenuOpenChange(false)
    window.addEventListener('blur', handleWindowBlur)
    return () => window.removeEventListener('blur', handleWindowBlur)
  }, [handleUserMenuOpenChange, userMenuOpen])

  const sidebarUser = useMemo<SidebarUser>(
    () => ({
      name: 'OTT24x7 AI',
      avatar: brandLogo,
      displayName: (
        <span className="font-semibold tracking-tight">
          OTT24x7 <span className="text-primary">AI</span>
        </span>
      ),
      buttonClassName: 'rounded-lg',
      hideChevron: true,
      onClick: handleUserMenuToggle
    }),
    [handleUserMenuToggle]
  )
  const renderSidebarUserTrigger = useCallback(
    (trigger: ReactElement) => (
      <PopoverTrigger
        asChild
        onPointerDown={() => (userMenuOpenedByPointerRef.current = true)}
        onKeyDown={() => (userMenuOpenedByPointerRef.current = false)}>
        {trigger}
      </PopoverTrigger>
    ),
    []
  )
  const renderUserMenu = () =>
    userMenuOpen ? (
      <PopoverContent
        aria-label={t('sidebar.account_menu')}
        align="start"
        side={showUserInFooter ? 'top' : 'bottom'}
        sideOffset={8}
        className="w-56 rounded-md p-0"
        onOpenAutoFocus={(event) => {
          if (userMenuOpenedByPointerRef.current) event.preventDefault()
        }}
        onClick={(event) => event.stopPropagation()}>
        <UserAccountPanel onRequestClose={() => handleUserMenuOpenChange(false)}>
          <HelpMenu onRequestClose={() => handleUserMenuOpenChange(false)} />
        </UserAccountPanel>
      </PopoverContent>
    ) : null

  const resolvedEntries = useMemo(
    () =>
      resolutions.map((resolution) => {
        const { shortcut } = resolution
        const provider = registry.resolve(shortcut.target)
        const isResolved = resolution.status === 'resolved'
        const label = isResolved
          ? resolution.resource.label
          : shortcut.fallbackLabel || shortcut.target.locator.resourceId
        const renderIcon = isResolved
          ? resolution.resource.renderIcon
          : ({ glyphSize }: SidebarIconPresentation) => {
              const Icon =
                resolution.status === 'loading' ? LoaderCircle : resolution.status === 'missing' ? CircleOff : WifiOff
              return (
                <Icon
                  size={glyphSize}
                  strokeWidth={1.6}
                  className={resolution.status === 'loading' ? 'animate-spin' : undefined}
                />
              )
            }
        const activate = (inNewTab = false) => {
          if (!isResolved || !provider) return
          void activateShortcut(provider, shortcut.target, resolution.resource, inNewTab).catch(() =>
            toast.error(t('common.error'))
          )
        }
        const activateInNewTab =
          isResolved && provider && resolution.resource.supportsNewTab ? () => activate(true) : undefined

        return {
          key: shortcut.id,
          label,
          renderIcon,
          disabled: !isResolved || !provider,
          isActive: !!provider?.isActive?.(shortcut.target, navigation),
          statusLabel: isResolved
            ? undefined
            : resolution.status === 'loading'
              ? t('common.loading')
              : resolution.status === 'missing'
                ? t('sidebar.resource_missing')
                : t('sidebar.resource_unavailable'),
          onOpen: () => activate(),
          onOpenNewTab: activateInNewTab,
          contextMenuItems: [
            ...(activateInNewTab
              ? [
                  {
                    type: 'item' as const,
                    id: `sidebar.open-in-new-tab.${shortcut.id}`,
                    label: t('common.open_in_new_tab'),
                    onSelect: activateInNewTab
                  }
                ]
              : []),
            {
              type: 'item' as const,
              id: `sidebar.remove.${shortcut.id}`,
              label: t('launchpad.unpin_from_sidebar'),
              onSelect: () => remove(shortcut.target)
            }
          ]
        }
      }),
    [activateShortcut, navigation, registry, remove, resolutions, shortcuts, t]
  )
  const [entries, setOptimisticEntryOrder] = useOptimistic(resolvedEntries, applyEntryOrder)

  const handleReorder = useCallback(
    ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
      if (oldIndex === newIndex) return
      const byId = new Map(shortcuts.map((shortcut) => [shortcut.id, shortcut]))
      const reorderedEntries = arrayMove(entries, oldIndex, newIndex)
      const reorderedShortcuts = reorderedEntries.flatMap((entry) => {
        const shortcut = byId.get(entry.key)
        return shortcut ? [shortcut] : []
      })
      startTransition(async () => {
        setOptimisticEntryOrder(reorderedEntries.map((entry) => entry.key))
        await reorder(reorderedShortcuts).catch(() => undefined)
      })
    },
    [entries, reorder, setOptimisticEntryOrder, shortcuts]
  )

  const { theme, setTheme } = useTheme()
  const isDark = theme === ThemeMode.dark
  const toggleSidebar = () => setSidebarWidth(layout === 'full' ? SIDEBAR_ICON_WIDTH : SIDEBAR_EXPANDED_WIDTH)

  const renderFooterButton = (
    footerLayout: SidebarVisibleLayout,
    label: string,
    icon: ReactElement,
    onClick: () => void
  ) => (
    <Button
      variant="ghost"
      size={footerLayout === 'icon' ? 'icon' : 'default'}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        footerLayout === 'icon'
          ? 'shell-navigation-item size-9 rounded-full'
          : 'shell-navigation-item flex w-full min-w-0 items-center justify-start gap-2.5 overflow-hidden rounded-full px-2.5 py-1.75 text-[13px]'
      }>
      {icon}
      {footerLayout === 'full' && <span className="min-w-0 truncate">{label}</span>}
    </Button>
  )

  const renderShellToggles = (footerLayout: SidebarVisibleLayout) => {
    const iconClass = footerLayout === 'icon' ? 'size-4.5' : 'size-4'
    return (
      <>
        {footerLayout === 'full' ? (
          <div className="grid w-full grid-cols-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-0.5">
            <Button
              type="button"
              variant={isDark ? 'secondary' : 'ghost'}
              size="sm"
              aria-label={t('sidebar.theme.to_dark')}
              aria-pressed={isDark}
              onClick={() => setTheme(ThemeMode.dark)}
              className="h-8 min-w-0 gap-1 rounded-md px-1.5 text-[11px]">
              <Moon className="size-3.5 shrink-0" strokeWidth={1.6} />
              <span className="truncate">{t('sidebar.theme.to_dark')}</span>
            </Button>
            <Button
              type="button"
              variant={!isDark ? 'secondary' : 'ghost'}
              size="sm"
              aria-label={t('sidebar.theme.to_light')}
              aria-pressed={!isDark}
              onClick={() => setTheme(ThemeMode.light)}
              className="h-8 min-w-0 gap-1 rounded-md px-1.5 text-[11px]">
              <Sun className="size-3.5 shrink-0" strokeWidth={1.6} />
              <span className="truncate">{t('sidebar.theme.to_light')}</span>
            </Button>
          </div>
        ) : (
          renderFooterButton(
            footerLayout,
            isDark ? t('sidebar.theme.to_light') : t('sidebar.theme.to_dark'),
            isDark ? <Sun className={iconClass} strokeWidth={1.6} /> : <Moon className={iconClass} strokeWidth={1.6} />,
            () => setTheme(isDark ? ThemeMode.light : ThemeMode.dark)
          )
        )}
        {renderFooterButton(
          footerLayout,
          footerLayout === 'full' ? t('sidebar.collapse') : t('sidebar.expand'),
          footerLayout === 'full' ? (
            <PanelLeftClose className={iconClass} strokeWidth={1.6} />
          ) : (
            <PanelLeftOpen className={iconClass} strokeWidth={1.6} />
          ),
          toggleSidebar
        )}
      </>
    )
  }

  const renderSettingsButton = (footerLayout: SidebarVisibleLayout) => (
    <CommandTooltip
      command="app.settings.open"
      label={t('settings.title')}
      placement="right"
      delay={800}
      fullWidthTrigger={footerLayout === 'full'}>
      <Button
        variant="ghost"
        size={footerLayout === 'icon' ? 'icon' : 'default'}
        aria-label={t('settings.title')}
        onClick={() => openSettingsTab()}
        className={
          footerLayout === 'icon'
            ? 'shell-navigation-item size-9 rounded-full'
            : 'shell-navigation-item flex w-full min-w-0 items-center justify-start gap-2.5 overflow-hidden rounded-full px-2.5 py-1.75 text-[13px]'
        }>
        <Settings className={footerLayout === 'icon' ? 'size-4.5' : 'size-4'} strokeWidth={1.6} />
        {footerLayout === 'full' && <span className="min-w-0 truncate">{t('settings.title')}</span>}
      </Button>
    </CommandTooltip>
  )

  const sidebarProps = {
    isFullscreen,
    entries,
    emptyHint: t('sidebar.empty_hint', { launchpad: t('title.launchpad') }),
    user: sidebarUser,
    topAction: (footerLayout: SidebarVisibleLayout, onDismiss?: () => void) => {
      // New Chat is a single-model conversation; Compare has its own entry.
      const startNewChat = () => {
        onDismiss?.()
        createTopic({})
          .then((topic) => openTab(`/app/chat?topicId=${topic.id}`, { forceNew: true }))
          .catch((error: unknown) => toast.error(error instanceof Error ? error.message : String(error)))
      }
      const label = t('chat.conversation.new')

      return footerLayout === 'full' ? (
        <div className="px-2 pb-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={label}
            onClick={startNewChat}
            className="shell-navigation-item flex h-9 w-full justify-start gap-2.5 rounded-lg px-2.5 text-[13px]">
            <SquarePen className="size-4" strokeWidth={1.6} />
            {label}
          </Button>
        </div>
      ) : (
        <div className="flex justify-center pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            title={label}
            onClick={startNewChat}
            className="shell-navigation-item size-9 rounded-lg">
            <SquarePen className="size-4.5" strokeWidth={1.6} />
          </Button>
        </div>
      )
    },
    userAction: (footerLayout: SidebarVisibleLayout) =>
      showUserInFooter && footerLayout === 'full' ? renderSettingsButton('icon') : null,
    renderUserTrigger: renderSidebarUserTrigger,
    actions: (footerLayout: SidebarVisibleLayout, onOverlayOpenChange?: (open: boolean) => void) => (
      <>
        <SidebarPromoCard layout={footerLayout} onOverlayOpenChange={onOverlayOpenChange} />
        {renderShellToggles(footerLayout)}
        {!(showUserInFooter && footerLayout === 'full') && renderSettingsButton(footerLayout)}
      </>
    ),
    onEntriesReorder: handleReorder
  }

  return (
    <div ref={ref} id="app-sidebar" data-ui="app.sidebar" className="relative h-full [-webkit-app-region:no-drag]">
      <Popover open={layout !== 'hidden' && userMenuOpen} onOpenChange={handleUserMenuOpenChange}>
        <UISidebar
          width={activeSidebarWidth}
          setWidth={setSidebarWidth}
          onHoverChange={setHoverVisible}
          onResizePreview={setPreviewSidebarWidth}
          {...sidebarProps}
        />
        {layout !== 'hidden' && renderUserMenu()}
      </Popover>
      {hoverVisible && layout === 'hidden' && (
        <Popover open={userMenuOpen} onOpenChange={handleUserMenuOpenChange}>
          <UISidebar
            width={activeSidebarWidth}
            setWidth={setSidebarWidth}
            isFloating
            onDismiss={() => {
              if (!userMenuOpen) setHoverVisible(false)
            }}
            {...sidebarProps}
          />
          {renderUserMenu()}
        </Popover>
      )}
    </div>
  )
}
