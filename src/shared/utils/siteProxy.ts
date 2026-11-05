import type { ProxyMode } from '@shared/data/preference/preferenceTypes'

export interface SiteProxyRule {
  id: string
  name: string
  enabled: boolean
  domains: string[]
  proxyUrl: string
}

export type SiteProxyRuleDraft = SiteProxyRule & { password: string }
export type SiteProxyRuleSecrets = Record<string, string>

export interface ParsedSiteProxyUrl {
  protocol: 'http:' | 'https:' | 'socks4:' | 'socks5:'
  hostname: string
  port: number
  username: string
  password: string
  sanitizedUrl: string
  proxyServer: string
}

const PROXY_PROTOCOLS = new Set(['http:', 'https:', 'socks4:', 'socks5:'])
const DOMAIN_LABEL = /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/

export function normalizeProxyDomain(domain: string): string {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, '')
  if (
    !normalized ||
    normalized.length > 253 ||
    normalized.split('.').some((label) => !DOMAIN_LABEL.test(label))
  ) {
    throw new Error('Invalid proxy domain')
  }
  return normalized
}

export function validateProxyDomains(domains: string[]): string[] {
  if (!domains.length) throw new Error('At least one proxy domain is required')
  return [...new Set(domains.map(normalizeProxyDomain))]
}

export function parseSiteProxyUrl(proxyUrl: string): ParsedSiteProxyUrl {
  if (!proxyUrl || /[\r\n"'\\]/.test(proxyUrl)) throw new Error('Invalid proxy URL')

  const url = new URL(proxyUrl)
  if (
    !PROXY_PROTOCOLS.has(url.protocol) ||
    !url.hostname ||
    (url.pathname !== '' && url.pathname !== '/') ||
    url.search ||
    url.hash
  ) {
    throw new Error('Invalid proxy URL')
  }

  const authority = proxyUrl.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1]
  const hostPort = authority?.slice(authority.lastIndexOf('@') + 1)
  const portMatch = hostPort?.match(/^(?:\[[^\]]+\]|[^:]+):(\d+)$/)
  const port = Number(portMatch?.[1])
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Proxy URL must include a valid port')

  const hostname = url.hostname.toLowerCase()
  const sanitizedUrl = `${url.protocol}//${url.username ? `${url.username}@` : ''}${hostname}:${port}`

  return {
    protocol: url.protocol as ParsedSiteProxyUrl['protocol'],
    hostname,
    port,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    sanitizedUrl: sanitizedUrl.toString().replace(/\/$/, ''),
    proxyServer: `${hostname}:${port}`
  }
}

export function proxyUrlWithPassword(proxyUrl: string, password: string): string {
  const parsed = new URL(proxyUrl)
  parsed.password = password
  return parsed.toString().replace(/\/$/, '')
}

export function proxyUrlForAuthentication(proxyUrl: string, password: string): string {
  return password ? proxyUrlWithPassword(proxyUrl, password) : proxyUrl
}

export function proxyDirective(protocol: string, proxyServer: string): string {
  switch (protocol.toLowerCase()) {
    case 'http:':
      return `PROXY ${proxyServer}`
    case 'https:':
      return `HTTPS ${proxyServer}`
    case 'socks4:':
      return `SOCKS ${proxyServer}`
    case 'socks5:':
    case 'socks:':
      return `SOCKS5 ${proxyServer}`
    default:
      throw new Error('Unsupported proxy protocol')
  }
}

export function proxyFallbackDirective(mode: ProxyMode, proxyUrl?: string): string {
  if (mode === 'none' || !proxyUrl) return 'DIRECT'
  try {
    try {
      const parsed = parseSiteProxyUrl(proxyUrl)
      return proxyDirective(parsed.protocol, parsed.proxyServer)
    } catch {
      const url = new URL(proxyUrl)
      const protocol = url.protocol.toLowerCase()
      if (!['http:', 'https:', 'socks:'].includes(protocol) || !url.hostname) return 'DIRECT'
      const port = url.port || (protocol === 'https:' ? '443' : protocol === 'socks:' ? '1080' : '80')
      return proxyDirective(protocol, `${url.hostname}:${port}`)
    }
  } catch {
    return 'DIRECT'
  }
}

export function buildSiteProxyPacScript(rules: SiteProxyRule[], fallback: string): string {
  const enabledRules = rules.filter((rule) => rule.enabled)
  const conditions = enabledRules.flatMap((rule) => {
    const domains = validateProxyDomains(rule.domains)
    const proxy = parseSiteProxyUrl(rule.proxyUrl)
    const directive = proxyDirective(proxy.protocol, proxy.proxyServer)
    return domains.map((domain) => {
      const escapedDomain = JSON.stringify(domain)
      const escapedDirective = JSON.stringify(directive)
      return `  if (host === ${escapedDomain} || dnsDomainIs(host, ${JSON.stringify(`.${domain}`)})) return ${escapedDirective};`
    })
  })

  return [
    'function FindProxyForURL(url, host) {',
    '  host = host.toLowerCase();',
    ...conditions,
    `  return ${JSON.stringify(fallback)};`,
    '}'
  ].join('\n')
}

export function findSiteProxyRule<T extends Pick<SiteProxyRule, 'enabled' | 'domains'>>(
  hostname: string,
  rules: T[]
): T | undefined {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return rules.find((rule) => rule.enabled && rule.domains.some((domain) => {
    const normalized = normalizeProxyDomain(domain)
    return host === normalized || host.endsWith(`.${normalized}`)
  }))
}
