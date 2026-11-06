import type { Model } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'
import { isNonChatModel } from '@shared/utils/model'

function hasUsableProviderAuth(provider: Provider): boolean {
  return provider.authOptional || provider.authType !== 'api-key' || provider.apiKeys.some((apiKey) => apiKey.isEnabled)
}

export function pickStudioPromptModel(
  models: readonly Model[],
  providers: readonly Provider[],
  compareJudgeId?: string | null,
  defaultModelId?: string | null
): Model | undefined {
  const providersById = new Map(providers.map((provider) => [provider.id, provider]))
  const eligible = models.filter((model) => {
    const provider = providersById.get(model.providerId)
    return (
      model.isEnabled &&
      !model.isHidden &&
      !isNonChatModel(model) &&
      provider?.isEnabled &&
      hasUsableProviderAuth(provider)
    )
  })

  return (
    eligible.find((model) => model.id === compareJudgeId) ??
    eligible.find((model) => model.id === defaultModelId) ??
    eligible[0]
  )
}
