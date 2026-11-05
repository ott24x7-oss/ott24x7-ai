import { useMemo } from 'react'

import { isManagedCherryCloudModel } from '@shared/data/presets/cherryai'
import type { Model } from '@shared/data/types/model'

/** Cherry-hosted models stay hidden; availability is never fetched from a server. */
export function useCherryCloudModelAvailability(_enabled = true) {
  void _enabled
  return useMemo(
    () => ({
      isModelHidden: (model: Model, _includeAgentOnlyModels?: boolean) => {
        void _includeAgentOnlyModels
        return isManagedCherryCloudModel(model.providerId)
      },
      isModelUnavailable: (_model?: Model) => {
        void _model
        return false
      },
      getModelDescription: (_model?: Model) => {
        void _model
        return undefined
      }
    }),
    []
  )
}
