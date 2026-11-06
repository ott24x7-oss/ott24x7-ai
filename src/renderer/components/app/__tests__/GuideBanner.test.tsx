// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { cacheService } from '@data/CacheService'
import { useGuideChecklist } from '@renderer/hooks/useGuideChecklist'
import en from '@renderer/i18n/locales/en-us.json'

import { GuideBanner } from '../GuideBanner'

vi.unmock('@cherrystudio/ui')
vi.unmock('react-i18next')
vi.unmock('@data/CacheService')
vi.unmock('@data/hooks/useCache')

const i18n = createInstance()

beforeAll(async () => {
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
})

afterEach(cleanup)

function BannerHarness() {
  const guide = useGuideChecklist()
  return guide.showBanner ? <GuideBanner onDismiss={guide.dismissBanner} onOpenGuide={vi.fn()} /> : null
}

describe('GuideBanner', () => {
  it('hides after the user dismisses it', async () => {
    const user = userEvent.setup()
    render(
      <I18nextProvider i18n={i18n}>
        <BannerHarness />
      </I18nextProvider>
    )

    expect(screen.getByRole('region', { name: 'Guide for new users' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Dismiss guide banner' }))

    expect(screen.queryByRole('region', { name: 'Guide for new users' })).not.toBeInTheDocument()
  })
})
