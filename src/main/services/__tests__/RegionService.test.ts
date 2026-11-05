import { beforeEach, describe, expect, it, vi } from 'vitest'

const { localeCountry, proxyState } = vi.hoisted(() => ({
  localeCountry: { value: 'IN' },
  proxyState: { appliedProxyKey: 'direct||' }
}))

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
  }
}))

vi.mock('electron', () => ({
  app: { getLocaleCountryCode: () => localeCountry.value }
}))

// Unified application mock provides a real Map-backed CacheService; ProxyService
// is not a default service, so wrap `get` to return our controllable stub.
vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  const result = mockApplicationFactory()
  const originalGet = result.application.get.getMockImplementation()!
  result.application.get.mockImplementation((name: string) => {
    if (name === 'ProxyService') {
      return {
        get appliedProxyKey() {
          return proxyState.appliedProxyKey
        }
      }
    }
    return originalGet(name)
  })
  return result
})

import { MockMainCacheServiceUtils } from '@test-mocks/main/CacheService'

import { regionService } from '../RegionService'

describe('RegionService', () => {
  beforeEach(() => {
    MockMainCacheServiceUtils.resetMocks()
    localeCountry.value = 'IN'
  })

  it('takes the country from the OS locale without any network lookup', async () => {
    await expect(regionService.getCountry()).resolves.toBe('IN')
  })

  it('reports China only for a CN locale', async () => {
    localeCountry.value = 'CN'
    await expect(regionService.isInChina()).resolves.toBe(true)
  })

  it('falls back to a global region when the OS locale has no country', async () => {
    localeCountry.value = ''
    await expect(regionService.isInChina()).resolves.toBe(false)
  })
})
