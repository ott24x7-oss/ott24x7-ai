import { useEffect, useMemo } from 'react'

import { usePreference } from '@data/hooks/usePreference'
import { loggerService } from '@logger'
import { PromosProvider } from '@renderer/components/app/PromosProvider'
import {
  CORE_SIDEBAR_SHORTCUT_PROVIDERS,
  SidebarShortcutRegistry,
  SidebarShortcutRegistryProvider
} from '@renderer/components/app/sidebarShortcuts'
import { CodeStyleProvider } from '@renderer/components/CodeStyleProvider'
import { CommandContextKeyProvider, CommandProvider } from '@renderer/components/command'
import { ConversationNotificationRuntime } from '@renderer/components/ConversationNotificationRuntime'
import { DictationShortcutHost } from '@renderer/components/DictationShortcutHost'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { FileEditSessionProvider } from '@renderer/components/FileEditSessionProvider'
import { AppShell } from '@renderer/components/layout/AppShell'
import { TabsProvider } from '@renderer/components/layout/TabsProvider'
import { McpInteractionHost } from '@renderer/components/McpInteractionHost'
import { PopupHost } from '@renderer/components/PopupHost'
import { ThemeProvider } from '@renderer/components/ThemeProvider'
import ToastHost from '@renderer/components/ToastHost'
import { VoicePlaybackHost } from '@renderer/components/VoicePlaybackHost'
import { WindowFatalFallback } from '@renderer/components/WindowFatalFallback'
import { useMainWindowNavigation } from '@renderer/hooks/tab'
import { useAutoReadPreferenceSync } from '@renderer/hooks/useAutoReadPreferenceSync'
import { useStorageMonitorNotification } from '@renderer/hooks/useStorageMonitorNotification'
import { useWindowRuntime } from '@renderer/hooks/useWindowRuntime'
import { registerImageModeChooser } from '@renderer/services/imageExportModeChooser'
import { WindowFileEditRecovery } from '@renderer/windows/WindowFileEditRecovery'
import type { Tab } from '@shared/data/cache/cacheValueTypes'

import { useAutoBackupEvents } from './hooks/useAutoBackupEvents'
import { useTopicNamingErrorNotification } from './hooks/useTopicNamingErrorNotification'

const logger = loggerService.withContext('MainApp')

// Behavior leaf inside the providers: the shared window runtime plus the main-only
// concerns, then the popup/toast hosts. It sits inside the providers but outside every
// TabRouter/<Activity>, so these window-scoped subscriptions and DOM sync are never
// torn down when a background tab hides.
//
// useAutoBackupEvents / useStorageMonitorNotification / useTopicNamingErrorNotification are
// intentionally main-only (update events only reach the main window; the storage warning and
// topic-naming-failed toast must not duplicate across windows) and intentionally React hooks:
// they depend on React-visible
// cache/toast state and manage their own effect cleanup, and the renderer has no
// service lifecycle container, so a service would only add manual start/stop.
//
// Headless: it runs hooks and renders nothing. The popup/toast hosts are explicit
// siblings in the App JSX below, so a window's host composition is visible there.
function MainWindowRuntime(): null {
  useWindowRuntime()
  useAutoReadPreferenceSync()
  useMainWindowNavigation()

  // Register the real (component-layer) image-mode popup behind the services seam.
  // subWindow registers the same effect (SubWindowApp) — detached tabs render the
  // same route tree and can export too; other windows never reach these exports.
  useEffect(() => {
    registerImageModeChooser((imageCount) =>
      import('@renderer/components/MarkdownImageExportPopup').then((m) => m.default.show({ imageCount }))
    )
  }, [])

  // Main-only: tear down the HTML boot spinner and end the `init` timer. Both are
  // paired with markup only main/index.html creates (`#spinner`, `console.time`), so
  // this must never run in another window.
  useEffect(() => {
    document.getElementById('spinner')?.remove()
    // Paired with `console.time('init')` in index.html's bootstrap script; a DevTools
    // timer for dev DX, not a production log — loggerService is not apt.
    // eslint-disable-next-line no-restricted-syntax
    console.timeEnd('init')
  }, [])

  useAutoBackupEvents()
  useStorageMonitorNotification()
  useTopicNamingErrorNotification()

  return null
}

export function MainWindowContent(): React.ReactElement {
  const [providerSetupStatus, setProviderSetupStatus] = usePreference('app.onboarding.provider_setup.status')
  const sidebarShortcutRegistry = useMemo(() => new SidebarShortcutRegistry(CORE_SIDEBAR_SHORTCUT_PROVIDERS), [])

  useEffect(() => {
    if (providerSetupStatus === 'pending') void setProviderSetupStatus('completed')
  }, [providerSetupStatus, setProviderSetupStatus])

  const initialDefaultTab = useMemo<Tab>(
    () => ({
      id: 'home',
      type: 'route',
      url: '/app/compare',
      title: '',
      lastAccessTime: Date.now(),
      isDormant: false
    }),
    []
  )

  return (
    <TabsProvider initialDefaultTab={initialDefaultTab}>
      <PromosProvider>
        <SidebarShortcutRegistryProvider registry={sidebarShortcutRegistry}>
          <AppShell />
          <MainWindowRuntime />
          <ConversationNotificationRuntime />
          <McpInteractionHost />
          <PopupHost />
          <ToastHost />
          <WindowFileEditRecovery />
          <DictationShortcutHost />
          <VoicePlaybackHost />
        </SidebarShortcutRegistryProvider>
      </PromosProvider>
    </TabsProvider>
  )
}

function MainApp(): React.ReactElement {
  logger.info('MainApp initialized')

  return (
    // The boundary must stay the ANCESTOR of every provider so a provider throwing
    // during render (e.g. reading preferences) falls back instead of white-screening.
    <ErrorBoundary fallbackComponent={WindowFatalFallback}>
      <ThemeProvider>
        <CodeStyleProvider>
          <FileEditSessionProvider>
            <CommandContextKeyProvider>
              <CommandProvider>
                <MainWindowContent />
              </CommandProvider>
            </CommandContextKeyProvider>
          </FileEditSessionProvider>
        </CodeStyleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default MainApp
