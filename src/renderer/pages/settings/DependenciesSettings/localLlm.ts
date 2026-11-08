import type { CreateModelDto } from '@shared/data/api/schemas/models'
import type { InstalledOllamaModel } from '@shared/data/presets/localLlm'
import { ENDPOINT_TYPE } from '@shared/data/types/model'

interface OllamaProviderState {
  id: string
  isEnabled: boolean
}

export async function syncInstalledOllamaModels(
  tags: readonly InstalledOllamaModel[],
  existingModelIds: ReadonlySet<string>,
  provider: OllamaProviderState | undefined,
  ensureProvider: () => Promise<OllamaProviderState>,
  addModels: (models: CreateModelDto[]) => Promise<unknown>,
  enableProvider: (providerId: string) => Promise<unknown>
): Promise<void> {
  if (tags.length === 0) return

  const resolvedProvider = provider ?? (await ensureProvider())
  const additions = tags
    .filter(({ name }) => !existingModelIds.has(name))
    .map(
      ({ name }): CreateModelDto => ({
        providerId: resolvedProvider.id,
        modelId: name,
        name,
        endpointTypes: [ENDPOINT_TYPE.OLLAMA_CHAT],
        supportsStreaming: true
      })
    )

  if (additions.length > 0) await addModels(additions)
  if (!resolvedProvider.isEnabled) await enableProvider(resolvedProvider.id)
}
