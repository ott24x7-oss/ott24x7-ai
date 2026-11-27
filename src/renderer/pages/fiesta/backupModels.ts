import type { CacheCompareBackupModelId } from '@shared/data/cache/cacheValueTypes'
import type { Model } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'
import type { CompareCliId } from '@shared/types/compareCli'

import { DEFAULT_COMPARE_CLI_ORDER, isCompareChatModel } from './compareState'

export const MAX_COMPARE_BACKUPS = 3

export interface BackupCandidate {
  id: CacheCompareBackupModelId
  kind: 'api' | 'cli'
  model?: Model
  cliId?: CompareCliId
}

export function getAutomaticBackupOrder({
  models,
  providers,
  availableCliIds,
  excludedIds = []
}: {
  models: readonly Model[]
  providers: readonly Provider[]
  availableCliIds: readonly CompareCliId[]
  excludedIds?: readonly string[]
}): BackupCandidate[] {
  const excluded = new Set(excludedIds)
  const providerById = new Map(providers.map((provider) => [provider.id, provider]))
  const eligibleModels = models.filter((model) => isCompareChatModel(model, providerById.get(model.providerId)))
  const loginModels = eligibleModels.filter((model) => model.providerId === 'openai-codex')
  const otherModels = eligibleModels.filter((model) => model.providerId !== 'openai-codex')
  const cliCandidates = DEFAULT_COMPARE_CLI_ORDER.filter((id) => availableCliIds.includes(id)).map((cliId) => ({
    id: `cli::${cliId}` as const,
    kind: 'cli' as const,
    cliId
  }))
  return [
    ...loginModels.map((model) => ({ id: model.id, kind: 'api' as const, model })),
    ...cliCandidates,
    ...otherModels.map((model) => ({ id: model.id, kind: 'api' as const, model }))
  ].filter((candidate) => !excluded.has(candidate.id))
}

export function getCompareBackupOrder({
  configuredIds,
  automaticCandidates,
  excludedIds = [],
  max = MAX_COMPARE_BACKUPS
}: {
  configuredIds: readonly CacheCompareBackupModelId[]
  automaticCandidates: readonly BackupCandidate[]
  excludedIds?: readonly string[]
  max?: number
}): BackupCandidate[] {
  const excluded = new Set(excludedIds)
  const byId = new Map(automaticCandidates.map((candidate) => [candidate.id, candidate]))
  const source =
    configuredIds.length > 0
      ? configuredIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
      : automaticCandidates
  return [
    ...new Map(
      source.filter((candidate) => !excluded.has(candidate.id)).map((candidate) => [candidate.id, candidate])
    ).values()
  ].slice(0, max)
}

export function getNextCompareBackup(
  candidates: readonly BackupCandidate[],
  attemptedIds: readonly string[],
  failedIds: readonly string[] = []
): BackupCandidate | null {
  const attempted = new Set([...attemptedIds, ...failedIds])
  return candidates.find((candidate) => !attempted.has(candidate.id)) ?? null
}
