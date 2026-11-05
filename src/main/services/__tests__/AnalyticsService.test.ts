import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BaseService } from '@main/core/lifecycle'

const { analyticsMethods, MockAnalyticsClient } = vi.hoisted(() => {
  const methods = {
    trackAppLaunch: vi.fn(),
    trackAppUpdate: vi.fn(),
    trackTokenUsage: vi.fn(),
    destroy: vi.fn(),
    getQueueSize: vi.fn(() => 0)
  }
  return {
    analyticsMethods: methods,
    MockAnalyticsClient: vi.fn(() => methods)
  }
})

vi.mock('@cherrystudio/analytics-client', () => ({ AnalyticsClient: MockAnalyticsClient }))

import { AnalyticsService } from '../AnalyticsService'

beforeEach(() => {
  BaseService.resetInstances()
  MockAnalyticsClient.mockClear()
  for (const method of Object.values(analyticsMethods)) method.mockClear()
})

describe('AnalyticsService disabled build', () => {
  it('never creates a client or sends events', async () => {
    const service = new AnalyticsService()
    await service._doInit()

    service.trackTokenUsage({
      provider: 'test-provider',
      model: 'test-model',
      input_tokens: 1,
      output_tokens: 1
    } satisfies Parameters<AnalyticsService['trackTokenUsage']>[0])
    await service.trackAppUpdate()

    expect(service.isActivated).toBe(false)
    expect(MockAnalyticsClient).not.toHaveBeenCalled()
    expect(analyticsMethods.trackAppLaunch).not.toHaveBeenCalled()
    expect(analyticsMethods.trackAppUpdate).not.toHaveBeenCalled()
    expect(analyticsMethods.trackTokenUsage).not.toHaveBeenCalled()
  })
})
