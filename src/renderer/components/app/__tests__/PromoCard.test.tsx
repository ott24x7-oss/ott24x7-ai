import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { openExternalWebsite } = vi.hoisted(() => ({ openExternalWebsite: vi.fn() }))

vi.unmock('@cherrystudio/ui')
vi.mock('@renderer/services/website', () => ({ openExternalWebsite }))
vi.mock('@renderer/services/toast', () => ({ toast: { error: vi.fn() } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { SidebarPromoCard } from '../PromoCard'

describe('SidebarPromoCard', () => {
  beforeEach(() => {
    openExternalWebsite.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('rotates to the other sponsored offer after 30 seconds', async () => {
    vi.useFakeTimers()
    render(<SidebarPromoCard layout="full" />)

    expect(screen.getByText('promos.sponsored')).toBeVisible()
    expect(screen.getByRole('link', { name: 'promos.ai_tools.button' })).toHaveAttribute(
      'href',
      'https://ott24x7.com/?utm_source=ott24x7-ai&utm_medium=app&utm_campaign=promo'
    )

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    expect(screen.getByRole('link', { name: 'promos.office_keys.button' })).toHaveAttribute(
      'href',
      'https://keys24x7.com/?utm_source=ott24x7-ai&utm_medium=app&utm_campaign=promo'
    )
  })

  it('opens both stores in the external browser from the collapsed icon', async () => {
    const user = userEvent.setup()
    render(<SidebarPromoCard layout="icon" />)

    await user.click(screen.getByRole('button', { name: 'promos.our_stores' }))

    expect(screen.getByRole('heading', { name: 'promos.our_stores' })).toBeVisible()
    const aiToolsLink = screen.getByRole('link', { name: 'promos.ai_tools.button' })
    const keysLink = screen.getByRole('link', { name: 'promos.office_keys.button' })
    expect(aiToolsLink).toHaveAttribute(
      'href',
      'https://ott24x7.com/?utm_source=ott24x7-ai&utm_medium=app&utm_campaign=promo'
    )
    expect(keysLink).toHaveAttribute(
      'href',
      'https://keys24x7.com/?utm_source=ott24x7-ai&utm_medium=app&utm_campaign=promo'
    )

    await user.click(aiToolsLink)

    expect(openExternalWebsite).toHaveBeenCalledWith(aiToolsLink.getAttribute('href'))
  })
})
