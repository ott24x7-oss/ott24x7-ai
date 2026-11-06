import type { CreateModelDto } from '@shared/data/api/schemas/models'
import type { CacheCompareModelSelection } from '@shared/data/cache/cacheValueTypes'
import { createUniqueModelId, type UniqueModelId } from '@shared/data/types/model'
import type { OpenRouterFreeModel } from '@shared/types/openRouter'

import { addCompareColumn } from './compareState'

export function getOpenRouterCompareModelId(modelId: string): UniqueModelId {
  return createUniqueModelId('openrouter', modelId)
}

export function toOpenRouterCreateModelDto(model: OpenRouterFreeModel): CreateModelDto {
  return {
    providerId: 'openrouter',
    modelId: model.id,
    name: model.name,
    ...(model.contextLength > 0 ? { contextWindow: model.contextLength } : {})
  }
}

export function addOpenRouterModelsToCompare(
  selection: CacheCompareModelSelection[],
  modelIds: readonly string[]
): CacheCompareModelSelection[] {
  return modelIds.reduce((next, modelId) => addCompareColumn(next, getOpenRouterCompareModelId(modelId)), selection)
}
