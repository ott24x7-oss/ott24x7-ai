import { describe, expect, it, vi } from 'vitest'

import type { BulkUpdateModelsDto } from '@shared/data/api/schemas/models'
import { MODELS_BULK_UPDATE_MAX_ITEMS } from '@shared/data/api/schemas/models'
import type { Model } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'
import { IpcError } from '@shared/ipc/errors/IpcError'

import { getProviderSetupErrorDetails, persistProviderModels } from '../providerModelSetup'

function makeModel(index: number): Model {
  return {
    id: `openai::model-${index}`,
    providerId: 'openai',
    apiModelId: `model-${index}`,
    name: `Model ${index}`,
    capabilities: [],
    isEnabled: false,
    isHidden: true,
    supportsStreaming: true
  }
}

describe('persistProviderModels', () => {
  it('restores existing models within the bulk-update transport limit', async () => {
    const models = Array.from({ length: MODELS_BULK_UPDATE_MAX_ITEMS + 1 }, (_, index) => makeModel(index))
    const updateModels = vi.fn(async (items: BulkUpdateModelsDto) =>
      items.map(({ uniqueModelId }) => ({
        ...models.find((model) => model.id === uniqueModelId)!,
        isEnabled: true,
        isHidden: false
      }))
    )

    const persisted = await persistProviderModels({
      provider: { id: 'openai' } as Provider,
      selectedModels: models,
      localModels: models,
      createModels: vi.fn(async () => []),
      updateModels
    })

    expect(updateModels).toHaveBeenCalledTimes(2)
    expect(updateModels.mock.calls.map(([items]) => items.length)).toEqual([MODELS_BULK_UPDATE_MAX_ITEMS, 1])
    expect(persisted).toHaveLength(models.length)
    expect(persisted.every((model) => model.isEnabled && !model.isHidden)).toBe(true)
  })
})

describe('provider setup check errors', () => {
  it.each([
    [401, 'auth'],
    [402, 'quota'],
    [404, 'model'],
    [429, 'rate_limit']
  ])('maps HTTP %s to its actionable diagnosis', (status, category) => {
    const error = new IpcError('AI_REQUEST_FAILED', 'AI request failed', {
      name: 'AI_APICallError',
      message: `request failed with status ${status} sk-secret`,
      stack: null,
      statusCode: status,
      responseBody: `provider returned ${status}; sk-secret`
    })

    const details = getProviderSetupErrorDetails(error, ['sk-secret'])

    expect(details.i18nKey).toBe(`error.diagnosis.${category}`)
    expect(details.summary).not.toContain('sk-secret')
    expect(details.summary).toContain(String(status))
  })

  it('identifies network failures and keeps the provider error text', () => {
    const details = getProviderSetupErrorDetails(new Error('fetch failed: connection refused'), [])

    expect(details.i18nKey).toBe('error.diagnosis.network')
    expect(details.summary).toContain('fetch failed')
  })
})
