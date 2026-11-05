import { describe, expect, it } from 'vitest'

import {
  buildSiteProxyPacScript,
  findSiteProxyRule,
  parseSiteProxyUrl,
  proxyDirective,
  proxyFallbackDirective,
  validateProxyDomains
} from '../siteProxy'

describe('site proxy domain routing', () => {
  const rule = {
    id: 'perplexity',
    name: 'Perplexity',
    enabled: true,
    domains: ['perplexity.ai'],
    proxyUrl: 'socks5://127.0.0.1:1080'
  }

  it('matches the exact domain and its subdomains without matching a lookalike suffix', () => {
    expect(findSiteProxyRule('perplexity.ai', [rule])).toBe(rule)
    expect(findSiteProxyRule('www.perplexity.ai', [rule])).toBe(rule)
    expect(findSiteProxyRule('notperplexity.ai', [rule])).toBeUndefined()
  })

  it.each([
    ['http:', 'proxy.example:8080', 'PROXY proxy.example:8080'],
    ['https:', 'proxy.example:8443', 'HTTPS proxy.example:8443'],
    ['socks5:', 'proxy.example:1080', 'SOCKS5 proxy.example:1080'],
    ['socks4:', 'proxy.example:1080', 'SOCKS proxy.example:1080']
  ])('maps %s to its PAC directive', (protocol, address, expected) => {
    expect(proxyDirective(protocol, address)).toBe(expected)
  })

  it('uses the normal mode as the PAC fallback', () => {
    expect(proxyFallbackDirective('none')).toBe('DIRECT')
    expect(proxyFallbackDirective('custom', 'http://proxy.example:8080')).toBe('PROXY proxy.example:8080')
    expect(proxyFallbackDirective('custom', 'socks5://proxy.example:1080')).toBe('SOCKS5 proxy.example:1080')
    expect(proxyFallbackDirective('system', 'https://system.example:8443')).toBe('HTTPS system.example:8443')
    expect(proxyFallbackDirective('system')).toBe('DIRECT')
  })

  it('builds a host-scoped PAC route and leaves all other hosts on the fallback', () => {
    const pac = buildSiteProxyPacScript([rule], 'DIRECT')
    expect(pac).toContain('host === "perplexity.ai"')
    expect(pac).toContain('dnsDomainIs(host, ".perplexity.ai")')
    expect(pac).toContain('return "SOCKS5 127.0.0.1:1080";')
    expect(pac).toContain('return "DIRECT";')
    expect(pac).not.toContain('notperplexity.ai')
  })

  it('rejects invalid domains and URL text that could inject code into the PAC script', () => {
    expect(() => validateProxyDomains(['perplexity.ai"; alert(1); //'])).toThrow()
    expect(() => validateProxyDomains(['perplexity.ai\nreturn "DIRECT"'])).toThrow()
    expect(() => buildSiteProxyPacScript([{ ...rule, proxyUrl: 'socks5://host:1080\nreturn "DIRECT"' }], 'DIRECT')).toThrow()
    expect(() => buildSiteProxyPacScript([{ ...rule, domains: ['bad"host'] }], 'DIRECT')).toThrow()
  })
})

describe('per-site proxy URL credentials', () => {
  it.each(['http', 'https', 'socks5', 'socks4'])('accepts a %s URL with an explicit host and port', (scheme) => {
    expect(() => parseSiteProxyUrl(`${scheme}://proxy.example:1080`)).not.toThrow()
  })

  it.each(['socks://proxy.example:1080', 'ftp://proxy.example:21', 'http://proxy.example', 'http://proxy.example:0'])('rejects unsupported or incomplete URL %s', (url) => {
    expect(() => parseSiteProxyUrl(url)).toThrow()
  })

  it('parses credentials and removes the password from the stored/display URL', () => {
    const parsed = parseSiteProxyUrl('http://alice:p%40ss%3Aword@proxy.example:8080')
    expect(parsed).toMatchObject({
      username: 'alice',
      password: 'p@ss:word',
      hostname: 'proxy.example',
      port: 8080,
      sanitizedUrl: 'http://alice@proxy.example:8080'
    })
    expect(parsed.sanitizedUrl).not.toContain('p%40ss')
  })
})
