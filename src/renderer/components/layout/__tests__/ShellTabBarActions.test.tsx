// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { MockCacheUtils } from '@test-mocks/renderer/CacheService'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { cacheService } from '@data/CacheService'

const mocks = vi.hoisted(() => ({ openSettingsTab: vi.fn(), showSearchPopup: vi.fn() }))

vi.unmock('@cherrystudio/ui')
vi.unmock('@data/hooks/useCache')
vi.mock('@renderer/services/mainWindowNavigation', () => ({ openSettingsTab: mocks.openSettingsTab }))
vi.mock('@renderer/components/GlobalSearch/GlobalSearchPopup', () => ({ default: { show: mocks.showSearchPopup } }))
vi.mock('@renderer/components/command', () => ({ CommandTooltip: ({ children }: { children: ReactNode }) => children }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({ 'globalSearch.open': 'Open global search', 'settings.title': 'Settings' })[key] ?? key
  })
}))
vi.mock('../../WindowControls', () => ({ WindowControls: () => null }))

import { ShellTabBarActions } from '../ShellTabBarActions'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  MockCacheUtils.resetMocks()
})

describe('ShellTabBarActions', () => {
  it('opens global search from the action area', async () => {
    const user = userEvent.setup()
    render(<ShellTabBarActions />)

    await user.click(screen.getByRole('button', { name: 'Open global search' }))

    expect(mocks.showSearchPopup).toHaveBeenCalledOnce()
  })

  it('opens settings from the action area when the sidebar is hidden', async () => {
    cacheService.setPersist('ui.sidebar.width', 0)
    const user = userEvent.setup()
    render(<ShellTabBarActions />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))

    expect(mocks.openSettingsTab).toHaveBeenCalledWith()
  })
})
