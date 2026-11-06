import '@testing-library/jest-dom/vitest'
import { MockUsePreferenceUtils } from '@test-mocks/renderer/usePreference'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSidebarShortcutId, type SidebarShortcutTarget } from '@shared/data/preference/preferenceTypes'

const onboardingModule = vi.hoisted(() => ({ evaluations: 0 }))

vi.mock('../onboarding/OnboardingPage', () => {
  onboardingModule.evaluations += 1
  return { default: () => <div data-testid="onboarding-page">onboarding</div> }
})

vi.mock('../privacy/PrivacyPolicyUpdateGate', () => ({
  PrivacyPolicyUpdateGate: () => <div data-testid="privacy-policy-gate">privacy-policy-gate</div>
}))

const tabsProviderMock = vi.hoisted(() => ({ lastInitialDefaultTab: null as unknown }))
const ipcMock = vi.hoisted(() => ({
  request: vi.fn().mockResolvedValue({ decision: 'NONE', currentBuild: 2 }),
  on: vi.fn(() => () => {})
}))

vi.mock('@renderer/ipc', () => ({
  ipcApi: ipcMock,
  useIpcOn: () => {}
}))
vi.mock('@renderer/components/app/OpenRouterFreeModelsDialog', () => ({ OpenRouterFreeModelsDialog: () => null }))
vi.mock('@renderer/components/app/DesktopUpdateProvider', () => ({
  DesktopUpdateProvider: ({ children }: { children: ReactNode }) => children,
  DesktopUpdatePrompt: () => null
}))

vi.mock('@renderer/components/layout/TabsProvider', () => ({
  TabsProvider: ({ children, initialDefaultTab }: { children: ReactNode; initialDefaultTab?: unknown }) => {
    tabsProviderMock.lastInitialDefaultTab = initialDefaultTab
    return <div data-testid="tabs-provider">{children}</div>
  }
}))

vi.mock('@renderer/components/layout/AppShell', () => ({
  AppShell: () => <div data-testid="app-shell">app-shell</div>
}))

vi.mock('@renderer/hooks/useWindowRuntime', () => ({ useWindowRuntime: () => {} }))
vi.mock('@renderer/hooks/tab', () => ({ useMainWindowNavigation: () => {} }))
vi.mock('@renderer/hooks/useStorageMonitorNotification', () => ({ useStorageMonitorNotification: () => {} }))
vi.mock('@renderer/components/ConversationNotificationRuntime', () => ({
  ConversationNotificationRuntime: () => null
}))
vi.mock('../hooks/useAutoBackupEvents', () => ({ useAutoBackupEvents: () => {} }))
vi.mock('../hooks/useTopicNamingErrorNotification', () => ({ useTopicNamingErrorNotification: () => {} }))
vi.mock('@renderer/components/PopupHost', () => ({ PopupHost: () => null }))
vi.mock('@renderer/components/ToastHost', () => ({ default: () => null }))
// Recovery has its own integration tests; this shell harness intentionally omits its providers.
vi.mock('@renderer/windows/WindowFileEditRecovery', () => ({ WindowFileEditRecovery: () => null }))
vi.mock('@renderer/components/ThemeProvider', () => ({
  ThemeProvider: () => {
    throw new Error('theme provider boom')
  }
}))

import MainApp, { MainWindowContent } from '../MainApp'

function appendBootSpinner() {
  const spinner = document.createElement('div')
  spinner.id = 'spinner'
  document.body.appendChild(spinner)
}

vi.mock('@renderer/components/app/PromosProvider', () => ({
  PromosProvider: ({ children }: { children: ReactNode }) => children
}))

function appShortcut(resourceId: string) {
  const target: SidebarShortcutTarget = { kind: 'resource', locator: { providerId: 'core.app', resourceId } }
  return { type: 'shortcut' as const, id: createSidebarShortcutId(target), target }
}

describe('MainWindowContent', () => {
  beforeEach(() => {
    MockUsePreferenceUtils.resetMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows the main app without onboarding or privacy gates after first-run setup is completed or skipped', () => {
    for (const status of ['completed', 'skipped'] as const) {
      MockUsePreferenceUtils.setPreferenceValue('app.onboarding.provider_setup.status', status)

      const view = render(<MainWindowContent />)

      expect(screen.getByTestId('tabs-provider')).toBeInTheDocument()
      expect(screen.getByTestId('app-shell')).toBeInTheDocument()
      expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument()
      expect(screen.queryByTestId('privacy-policy-gate')).not.toBeInTheDocument()
      expect(onboardingModule.evaluations).toBe(0)
      view.unmount()
    }
  })

  it('opens the main app and marks legacy pending setup complete', async () => {
    MockUsePreferenceUtils.setPreferenceValue('app.onboarding.provider_setup.status', 'pending')

    render(<MainWindowContent />)

    expect(screen.getByTestId('app-shell')).toBeInTheDocument()
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('privacy-policy-gate')).not.toBeInTheDocument()
    expect(document.getElementById('spinner')).toBeNull()
    await waitFor(() =>
      expect(MockUsePreferenceUtils.getPreferenceValue('app.onboarding.provider_setup.status')).toBe('completed')
    )
  })

  it('opens Compare as the startup landing tab regardless of sidebar shortcuts', () => {
    MockUsePreferenceUtils.setPreferenceValue('app.onboarding.provider_setup.status', 'completed')
    MockUsePreferenceUtils.setPreferenceValue('ui.sidebar_shortcut', [appShortcut('agents'), appShortcut('translate')])
    MockUsePreferenceUtils.setPreferenceValue('feature.paintings.default_provider', 'zhipu')

    render(<MainWindowContent />)

    expect(tabsProviderMock.lastInitialDefaultTab).toMatchObject({ url: '/app/compare' })
  })

  it('opens Compare when no sidebar apps are configured', () => {
    MockUsePreferenceUtils.setPreferenceValue('app.onboarding.provider_setup.status', 'completed')
    MockUsePreferenceUtils.setPreferenceValue('ui.sidebar_shortcut', [])
    MockUsePreferenceUtils.setPreferenceValue('feature.paintings.default_provider', 'zhipu')

    render(<MainWindowContent />)

    expect(tabsProviderMock.lastInitialDefaultTab).toMatchObject({ url: '/app/compare' })
  })
})

describe('MainApp top-level error boundary', () => {
  it('shows the window fatal fallback instead of a white screen when a provider throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    appendBootSpinner()

    render(<MainApp />)

    expect(screen.getByRole('alert')).toHaveTextContent('theme provider boom')
    expect(document.getElementById('spinner')).toBeNull()
    consoleError.mockRestore()
  })
})
