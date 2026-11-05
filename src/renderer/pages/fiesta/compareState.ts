import type { CompareColumnId } from '@renderer/types/compare'
import type { CacheCompareModelSelection, CacheCompareSavedSet } from '@shared/data/cache/cacheValueTypes'
import type { CompareCliId } from '@shared/types/compareCli'

const FIRST_RUN_WEB_APP_ID_GROUPS = [['anthropic', 'claude'], ['openai', 'chatgpt'], ['gemini'], ['deepseek']] as const

export const DEFAULT_COMPARE_CLI_ORDER: readonly CompareCliId[] = ['claude', 'agy', 'codex']

interface FirstRunCompareDefaultsInput {
  isFreshProfile: boolean
  defaultsSeeded: boolean
  selection: readonly CacheCompareModelSelection[]
  savedSets: readonly CacheCompareSavedSet[]
  judgeId: string
  enabledSiteAppIds: readonly string[]
  savedSetName: string
}

export function getFirstRunCompareDefaults({
  isFreshProfile,
  defaultsSeeded,
  selection,
  savedSets,
  judgeId,
  enabledSiteAppIds,
  savedSetName
}: FirstRunCompareDefaultsInput): { selection: CacheCompareModelSelection[]; savedSet: CacheCompareSavedSet } | null {
  if (!isFreshProfile || defaultsSeeded || selection.length > 0 || savedSets.length > 0 || judgeId !== 'auto')
    return null

  const enabledApps = new Set(enabledSiteAppIds.map((id) => id.toLowerCase()))
  const defaultSelection: CacheCompareModelSelection[] = FIRST_RUN_WEB_APP_ID_GROUPS.flatMap(
    (group): CacheCompareModelSelection[] => {
      const appId = group.find((candidate) => enabledApps.has(candidate))
      return appId ? [{ id: `webapp::${appId}`, enabled: true }] : []
    }
  )
  if (defaultSelection.length === 0) return null

  return {
    selection: defaultSelection,
    savedSet: {
      id: 'my-subscriptions',
      name: savedSetName,
      selection: defaultSelection.map((item) => ({ ...item }))
    }
  }
}

export function getDefaultCompareJudgeId(
  availableCliIds: readonly CompareCliId[],
  visibleWebAppIds: readonly string[]
): CompareColumnId | 'auto' {
  const availableClis = new Set(availableCliIds)
  const defaultCli = DEFAULT_COMPARE_CLI_ORDER.find((cliId) => availableClis.has(cliId))
  if (defaultCli) return `cli::${defaultCli}`

  const visibleWebApps = new Set(visibleWebAppIds.map((appId) => appId.toLowerCase()))
  const chatGptAppId = ['openai', 'chatgpt'].find((appId) => visibleWebApps.has(appId))
  if (!chatGptAppId) return 'auto'

  const judgeId: CompareColumnId = `webapp::${chatGptAppId}`
  return judgeId
}

export type CompareKeyboardAction = { type: 'exit-focus' } | { type: 'focus-model'; modelId: CompareColumnId }

export function getCompareKeyboardAction(
  key: string,
  ctrlKey: boolean,
  focusedModelId: CompareColumnId | null,
  modelIds: readonly CompareColumnId[]
): CompareKeyboardAction | null {
  if (key === 'Escape' && focusedModelId) return { type: 'exit-focus' }
  if (!ctrlKey || !/^[1-9]$/.test(key)) return null

  const modelId = modelIds[Number(key) - 1]
  return modelId ? { type: 'focus-model', modelId } : null
}

export function setCompareModelEnabled(
  selection: CacheCompareModelSelection[],
  modelId: CompareColumnId,
  enabled: boolean
): CacheCompareModelSelection[] {
  return selection.map((item) => (item.id === modelId ? { ...item, enabled } : item))
}

export function removeCompareModel(
  selection: CacheCompareModelSelection[],
  modelId: CompareColumnId
): CacheCompareModelSelection[] {
  return selection.filter((item) => item.id !== modelId)
}

export function reorderCompareModels(
  selection: CacheCompareModelSelection[],
  sourceId: CompareColumnId,
  targetId: CompareColumnId
): CacheCompareModelSelection[] {
  const sourceIndex = selection.findIndex((item) => item.id === sourceId)
  const targetIndex = selection.findIndex((item) => item.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return selection

  const next = [...selection]
  const [source] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, source)
  return next
}

export function syncCompareModelSelection(
  selection: CacheCompareModelSelection[],
  selectedIds: readonly CompareColumnId[]
): CacheCompareModelSelection[] {
  const enabledById = new Map(selection.map((item) => [item.id, item.enabled]))
  return selectedIds.map((id) => ({ id, enabled: enabledById.get(id) ?? true }))
}

export function getCompareSetSelection(set: CacheCompareSavedSet): CacheCompareModelSelection[] {
  return set.selection.map((item) => ({ ...item }))
}

export function getCompareSendModelIds(
  selection: CacheCompareModelSelection[],
  focusedModelId: CompareColumnId | null,
  onlyFocusedModel: boolean
): CompareColumnId[] {
  if (onlyFocusedModel && focusedModelId) {
    return selection.some((item) => item.id === focusedModelId && item.enabled) ? [focusedModelId] : []
  }
  return selection.filter((item) => item.enabled).map((item) => item.id)
}

export function getCompareVisibleModelIds(
  selection: CacheCompareModelSelection[],
  focusedModelId: CompareColumnId | null
): ReadonlySet<CompareColumnId> {
  if (focusedModelId) return new Set([focusedModelId])
  return new Set(selection.map((item) => item.id))
}
