// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { cacheService } from '@data/CacheService'
import en from '@renderer/i18n/locales/en-us.json'

import { GuideContent } from '../GuideContent'

vi.unmock('@cherrystudio/ui')
vi.unmock('react-i18next')
vi.unmock('@data/CacheService')
vi.unmock('@data/hooks/useCache')

const { openTab, openFreeModels } = vi.hoisted(() => ({ openTab: vi.fn(), openFreeModels: vi.fn() }))
vi.mock('@renderer/hooks/tab', () => ({ useTabs: () => ({ openTab }) }))
vi.mock('@renderer/components/app/DesktopUpdateProvider', () => ({ useDesktopUpdate: () => ({ openFreeModels }) }))
vi.mock('@renderer/services/website', () => ({ openExternalWebsite: vi.fn() }))

const i18n = createInstance()

beforeAll(async () => {
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.init({
    lng: 'en',
    resources: { en: { translation: en } },
    keySeparator: false,
    interpolation: { escapeValue: false }
  })
})

beforeEach(() => {
  cacheService.deletePersist('ui.guide.checklist')
  cacheService.deletePersist('ui.guide.banner_dismissed')
  openTab.mockReset()
  openFreeModels.mockReset()
})

afterEach(cleanup)

function renderGuide() {
  return render(
    <I18nextProvider i18n={i18n}>
      <GuideContent />
    </I18nextProvider>
  )
}

describe('GuideContent', () => {
  it('starts with an empty checklist and Show me focuses the matching step', async () => {
    const user = userEvent.setup()
    renderGuide()

    expect(screen.getByRole('status').textContent).toContain('0 of 8 done')
    await user.click(screen.getByRole('button', { name: 'Show me: Choose how many columns to show (1–4)' }))

    const target = document.getElementById('guide-step-4')
    expect(target).toBeInTheDocument()
    expect(target).toHaveFocus()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('opens the related in-app destination from a guide step', async () => {
    const user = userEvent.setup()
    renderGuide()

    await user.click(screen.getByRole('button', { name: 'Open Settings → Model Provider' }))

    expect(openTab).toHaveBeenCalledWith('/settings/provider')
  })

  it('opens Compare and the free models dialog from the Guide entry', async () => {
    const user = userEvent.setup()
    renderGuide()

    await user.click(screen.getByRole('button', { name: 'Add free OpenRouter models' }))

    expect(openTab).toHaveBeenCalledWith('/app/compare')
    expect(openFreeModels).toHaveBeenCalledOnce()
  })
})
