import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PromosProvider, usePromos } from '../PromosProvider'

function PromoTitles() {
  const promos = usePromos()
  return (
    <div>
      {promos.map((promo) => (
        <span key={promo.id}>{promo.title ?? promo.id}</span>
      ))}
    </div>
  )
}

describe('PromosProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refreshes once on startup without sending credentials or a referrer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'ai-tools',
          title: 'Updated AI tools',
          text: 'Updated copy',
          button: 'Visit ott24x7.com',
          url: 'https://ott24x7.com/'
        },
        {
          id: 'office-keys',
          title: 'Updated keys',
          text: 'Updated copy',
          button: 'Visit keys24x7.com',
          url: 'https://keys24x7.com/'
        }
      ]
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <StrictMode>
        <PromosProvider>
          <PromoTitles />
        </PromosProvider>
      </StrictMode>
    )

    expect(await screen.findByText('Updated AI tools')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ott24x7.com/ott24x7-ai/promos.json',
      expect.objectContaining({ credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' })
    )
  })
})
