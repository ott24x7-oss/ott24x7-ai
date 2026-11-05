export interface Promo {
  id: 'ai-tools' | 'office-keys'
  url: string
  title?: string
  text?: string
  button?: string
  titleKey?: string
  textKey?: string
  buttonKey?: string
}

const PROMO_LINK_TAGS = {
  source: 'ott24x7-ai',
  medium: 'app',
  campaign: 'promo'
} as const

export function buildPromoUrl(rawUrl: string): string {
  const url = new URL(rawUrl)
  url.searchParams.set('utm_source', PROMO_LINK_TAGS.source)
  url.searchParams.set('utm_medium', PROMO_LINK_TAGS.medium)
  url.searchParams.set('utm_campaign', PROMO_LINK_TAGS.campaign)
  return url.toString()
}

export const BUNDLED_PROMOS: Promo[] = [
  {
    id: 'ai-tools',
    title: 'Buy AI tools',
    text: 'Get premium AI tools at the best price',
    button: 'Visit ott24x7.com',
    titleKey: 'promos.ai_tools.title',
    textKey: 'promos.ai_tools.text',
    buttonKey: 'promos.ai_tools.button',
    url: buildPromoUrl('https://ott24x7.com/')
  },
  {
    id: 'office-keys',
    title: 'Windows & MS Office keys',
    text: 'Genuine Windows & Microsoft Office keys',
    button: 'Visit keys24x7.com',
    titleKey: 'promos.office_keys.title',
    textKey: 'promos.office_keys.text',
    buttonKey: 'promos.office_keys.button',
    url: buildPromoUrl('https://keys24x7.com/')
  }
]

export const PROMO_CONFIG_URL = 'https://ott24x7.com/ott24x7-ai/promos.json'
export const SOURCE_CODE_URL = 'https://github.com/ott24x7-oss/ott24x7-ai'

const PROMO_IDS = new Set<Promo['id']>(['ai-tools', 'office-keys'])
const PROMO_HOSTS = new Set(['ott24x7.com', 'keys24x7.com'])

export function validateRemotePromos(value: unknown): Promo[] | null {
  if (!Array.isArray(value) || value.length !== 2) return null

  const promos: Promo[] = []
  const seenIds = new Set<string>()

  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) return null

    const promo = candidate as Record<string, unknown>
    if (
      typeof promo.id !== 'string' ||
      !PROMO_IDS.has(promo.id as Promo['id']) ||
      seenIds.has(promo.id) ||
      typeof promo.title !== 'string' ||
      promo.title.trim().length === 0 ||
      typeof promo.text !== 'string' ||
      promo.text.trim().length === 0 ||
      typeof promo.button !== 'string' ||
      promo.button.trim().length === 0 ||
      typeof promo.url !== 'string'
    ) {
      return null
    }

    let url: URL
    try {
      url = new URL(promo.url)
    } catch {
      return null
    }

    if (
      url.protocol !== 'https:' ||
      !PROMO_HOSTS.has(url.hostname) ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.port.length > 0
    ) {
      return null
    }

    seenIds.add(promo.id)
    promos.push({
      id: promo.id as Promo['id'],
      title: promo.title,
      text: promo.text,
      button: promo.button,
      url: url.toString()
    })
  }

  return seenIds.size === PROMO_IDS.size ? promos : null
}

export async function fetchRemotePromos(fetcher: typeof fetch = fetch): Promise<Promo[]> {
  try {
    const response = await fetcher(PROMO_CONFIG_URL, {
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) return BUNDLED_PROMOS
    return validateRemotePromos(await response.json()) ?? BUNDLED_PROMOS
  } catch {
    return BUNDLED_PROMOS
  }
}
