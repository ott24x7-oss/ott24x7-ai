import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Model } from '@shared/data/types/model'

import { useCherryCloudModelAvailability } from '../useCherryCloudModelAvailability'

function model(providerId: string, modelId: string): Model {
  return {
    id: `${providerId}::${modelId}`,
    providerId,
    name: modelId,
    capabilities: [],
    supportsStreaming: true,
    isEnabled: true,
    isHidden: false
  }
}

describe('useCherryCloudModelAvailability', () => {
  it('hides managed cloud models locally without network access', () => {
    const { result } = renderHook(() => useCherryCloudModelAvailability())

    expect(result.current.isModelHidden(model('cherryai-subscription', 'managed'), false)).toBe(true)
    expect(result.current.isModelHidden(model('openai', 'gpt-4o'), true)).toBe(false)
    expect(result.current.isModelUnavailable(model('openai', 'gpt-4o'))).toBe(false)
    expect(result.current.getModelDescription(model('openai', 'gpt-4o'))).toBeUndefined()
  })

  it('keeps the local behavior when explicitly disabled', () => {
    const { result } = renderHook(() => useCherryCloudModelAvailability(false))

    expect(result.current.isModelHidden(model('cherryai-subscription', 'managed'), true)).toBe(true)
    expect(result.current.isModelUnavailable(model('cherryai-subscription', 'managed'))).toBe(false)
  })
})
