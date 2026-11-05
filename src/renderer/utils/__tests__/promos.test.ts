import { describe, expect, it } from 'vitest'

import { BUNDLED_PROMOS, buildPromoUrl, validateRemotePromos } from '../promos'

const remotePromos = [
  {
    id: 'ai-tools',
    title: 'AI tools',
    text: 'Premium AI tools',
    button: 'Visit ott24x7.com',
    url: 'https://ott24x7.com/promo'
  },
  {
    id: 'office-keys',
    title: 'Office keys',
    text: 'Genuine software keys',
    button: 'Visit keys24x7.com',
    url: 'https://keys24x7.com/promo'
  }
]

describe('promo configuration', () => {
  it('builds the bundled store URLs with the app campaign tags', () => {
    expect(BUNDLED_PROMOS.map(({ url }) => url)).toEqual([
      'https://ott24x7.com/?utm_source=ott24x7-ai&utm_medium=app&utm_campaign=promo',
      'https://keys24x7.com/?utm_source=ott24x7-ai&utm_medium=app&utm_campaign=promo'
    ])
    expect(buildPromoUrl('https://ott24x7.com/shop?ref=app')).toBe(
      'https://ott24x7.com/shop?ref=app&utm_source=ott24x7-ai&utm_medium=app&utm_campaign=promo'
    )
  })

  it('accepts both promos only when their copy and secure store URLs are valid', () => {
    expect(validateRemotePromos(remotePromos)).toEqual(remotePromos)
  })

  it.each([
    ['an unapproved domain', [{ ...remotePromos[0], url: 'https://ott24x7.com.attacker.test/' }, remotePromos[1]]],
    ['an insecure URL', [{ ...remotePromos[0], url: 'http://ott24x7.com/' }, remotePromos[1]]],
    ['a URL with credentials', [{ ...remotePromos[0], url: 'https://user@ott24x7.com/' }, remotePromos[1]]],
    ['a missing promo', [remotePromos[0]]],
    ['a malformed promo', [{ ...remotePromos[0], button: '' }, remotePromos[1]]],
    ['an unexpected promo id', [{ ...remotePromos[0], id: 'other' }, remotePromos[1]]]
  ])('rejects remote promo data with %s', (_reason, value) => {
    expect(validateRemotePromos(value)).toBeNull()
  })
})
