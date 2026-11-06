import { useMemo } from 'react'

import { usePersistCache } from '@data/hooks/useCache'
import { usePreference } from '@data/hooks/usePreference'
import { useModels } from '@renderer/hooks/useModel'
import { useProviders } from '@renderer/hooks/useProvider'

import { pickStudioPromptModel } from './promptModel'

export function useStudioPromptModel() {
  const [compareJudgeId] = usePersistCache('ui.compare.judge')
  const [defaultModelId] = usePreference('chat.default_model_id')
  const { models } = useModels()
  const { providers } = useProviders()

  return useMemo(
    () => pickStudioPromptModel(models, providers, compareJudgeId, defaultModelId),
    [compareJudgeId, defaultModelId, models, providers]
  )
}
