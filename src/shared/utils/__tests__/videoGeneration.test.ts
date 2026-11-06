import { describe, expect, it } from 'vitest'

import type { Model } from '@shared/data/types/model'
import { MODEL_CAPABILITY } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'
import type { VideoGenerationRecord } from '@shared/types/videoGeneration'

import {
  filterVideoGenerationModels,
  getVideoModelOptions,
  getVideoPollDelayMs,
  getVideoResumeAction,
  getVideoCostEstimate,
  shouldStopVideoPolling
} from '../videoGeneration'

function model(overrides: Partial<Model>): Model {
  return {
    id: 'provider::model',
    providerId: 'provider',
    name: 'Model',
    capabilities: [],
    supportsStreaming: false,
    isEnabled: true,
    isHidden: false,
    ...overrides
  }
}

function provider(overrides: Partial<Provider>): Provider {
  return {
    id: 'provider',
    name: 'Provider',
    apiKeys: [{ id: 'key-1', isEnabled: true }],
    authType: 'api-key',
    settings: {},
    reportsActualCost: false,
    isEnabled: true,
    ...overrides
  }
}

function record(overrides: Partial<VideoGenerationRecord>): VideoGenerationRecord {
  return {
    id: '7d4d8991-84ec-432d-8b1a-5544800d3c76',
    providerId: 'provider',
    modelId: 'provider::model',
    modelName: 'Model',
    prompt: 'A red kite floating above a quiet beach',
    duration: 8,
    ratio: '16:9',
    generateAudio: true,
    status: 'in_progress',
    taskId: 'task-1',
    apiStyle: 'openai',
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
    startedAt: 1,
    ...overrides
  }
}

describe('video generation model contracts', () => {
  it('offers only duration and aspect options accepted by known HeyRoute models', () => {
    expect(getVideoModelOptions('grok-video').durations).toEqual([6, 10, 15])
    expect(getVideoModelOptions('grok-video').ratios).toEqual([])
    expect(getVideoModelOptions('grok-imagine-video').durations).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1)
    )
    expect(getVideoModelOptions('grok-imagine-video').resolutions).toEqual(['480p', '720p'])
    expect(getVideoModelOptions('grok-imagine-video-1.5').resolutions).toEqual(['1080p'])
    expect(getVideoModelOptions('seedance-2.0').durations).toEqual([15])
    expect(getVideoModelOptions('seedance-2.5').durations).toEqual(Array.from({ length: 27 }, (_, index) => index + 4))
    expect(getVideoModelOptions('minimax-h3-720p').timeoutMs).toBe(30 * 60 * 1000)
  })

  it('calculates a cost estimate only when this model and resolution have a documented rate', () => {
    expect(getVideoCostEstimate('grok-video', 10)).toBe(2)
    expect(getVideoCostEstimate('grok-imagine-video', 5, '480p')).toBe(5)
    expect(getVideoCostEstimate('grok-imagine-video', 5, '720p')).toBeUndefined()
  })

  it('keeps only enabled video models whose enabled provider has an enabled API key', () => {
    const video = model({ capabilities: [MODEL_CAPABILITY.VIDEO_GENERATION] })
    const models = [
      video,
      model({ id: 'provider::chat', capabilities: [MODEL_CAPABILITY.FUNCTION_CALL] }),
      model({ id: 'provider::disabled-model', capabilities: [MODEL_CAPABILITY.VIDEO_GENERATION], isEnabled: false }),
      model({ id: 'provider::hidden-model', capabilities: [MODEL_CAPABILITY.VIDEO_GENERATION], isHidden: true }),
      model({ id: 'other::video', providerId: 'other', capabilities: [MODEL_CAPABILITY.VIDEO_GENERATION] })
    ]
    const providers = [
      provider({}),
      provider({ id: 'other', isEnabled: false }),
      provider({ id: 'no-key', apiKeys: [] })
    ]

    expect(filterVideoGenerationModels(models, providers).map(({ id }) => id)).toEqual(['provider::model'])
  })
})

describe('video job lifecycle contracts', () => {
  it('backs off failed polls, honors Retry-After, and stops for terminal or shutdown states', () => {
    expect([0, 1, 2, 8].map((retries) => getVideoPollDelayMs(retries))).toEqual([15_000, 30_000, 60_000, 60_000])
    expect(getVideoPollDelayMs(3, 45_000)).toBe(45_000)
    expect(getVideoPollDelayMs(3, 0)).toBe(0)
    expect(
      shouldStopVideoPolling({ status: 'completed', aborted: false, appQuitting: false, now: 0, deadline: 1 })
    ).toBe(true)
    expect(
      shouldStopVideoPolling({ status: 'in_progress', aborted: true, appQuitting: false, now: 0, deadline: 1 })
    ).toBe(true)
    expect(
      shouldStopVideoPolling({ status: 'in_progress', aborted: false, appQuitting: true, now: 0, deadline: 1 })
    ).toBe(true)
    expect(
      shouldStopVideoPolling({ status: 'in_progress', aborted: false, appQuitting: false, now: 2, deadline: 1 })
    ).toBe(true)
  })

  it('resumes persisted provider tasks by polling and never resubmits an uncertain request', () => {
    expect(getVideoResumeAction(record({}))).toBe('poll')
    expect(getVideoResumeAction(record({ taskId: undefined }))).toBe('none')
    expect(getVideoResumeAction(record({ status: 'completed' }))).toBe('none')
  })
})
