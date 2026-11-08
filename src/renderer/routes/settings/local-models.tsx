import { createFileRoute } from '@tanstack/react-router'

import { SettingsContentColumn } from '@renderer/components/SettingsPrimitives'
import LocalLlmSection from '@renderer/pages/settings/DependenciesSettings/LocalLlmSection'
import LocalModelsSection from '@renderer/pages/settings/DependenciesSettings/LocalModelsSection'

const LocalModelsSettings = () => (
  <SettingsContentColumn className="bg-transparent">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-y-auto px-1 pb-4">
      <LocalLlmSection />
      <LocalModelsSection />
    </div>
  </SettingsContentColumn>
)

export const Route = createFileRoute('/settings/local-models')({
  component: LocalModelsSettings
})
