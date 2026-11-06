import { describe, expect, it } from 'vitest'

import type { CacheCompareModelSelection } from '@shared/data/cache/cacheValueTypes'
import { MAX_COMPARE_COLUMNS } from '../compareState'
import {
  addOpenRouterModelsToCompare,
  getOpenRouterCompareModelId,
  toOpenRouterCreateModelDto
} from '../openRouterFreeModelSelection'

describe('OpenRouter free model Compare integration', () => {
  it('uses Cherry model creation with OpenRouter IDs and known context sizes', () => {
    expect(toOpenRouterCreateModelDto({ id: 'provider/model', name: 'Model', contextLength: 128_000 })).toEqual({
      providerId: 'openrouter',
      modelId: 'provider/model',
      name: 'Model',
      contextWindow: 128_000
    })
    expect(getOpenRouterCompareModelId('provider/model')).toBe('openrouter::provider/model')
  })

  it('keeps web panels and respects the eight column limit', () => {
    const selection: CacheCompareModelSelection[] = [
      { id: 'webapp::claude', enabled: true },
      ...Array.from(
        { length: MAX_COMPARE_COLUMNS - 2 },
        (_, index): CacheCompareModelSelection => ({ id: `provider::model-${index}`, enabled: true })
      )
    ]

    const next = addOpenRouterModelsToCompare(selection, ['first', 'second'])

    expect(next).toHaveLength(MAX_COMPARE_COLUMNS)
    expect(next[0]).toEqual({ id: 'webapp::claude', enabled: true })
    expect(next.at(-1)?.id).toBe(getOpenRouterCompareModelId('first'))
  })

  it('enables an already-selected model without duplicating its Compare column', () => {
    const id = getOpenRouterCompareModelId('provider/model')
    expect(addOpenRouterModelsToCompare([{ id, enabled: false }], ['provider/model'])).toEqual([{ id, enabled: true }])
  })
})
