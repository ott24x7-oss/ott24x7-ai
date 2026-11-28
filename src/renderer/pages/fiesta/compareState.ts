import type { CompareColumn, CompareColumnId } from '@renderer/types/compare'
import type { CacheCompareModelSelection, CacheCompareSavedSet } from '@shared/data/cache/cacheValueTypes'
import type { Model } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'
import type { CompareCliId } from '@shared/types/compareCli'
import { isNonChatModel } from '@shared/utils/model'
import { isAgentOnlyProvider } from '@shared/utils/provider'

export { getMySubscriptionColumnIds } from '@renderer/utils/compareSubscriptions'

export const MAX_COMPARE_COLUMNS = 8
export const SIGNED_IN_COMPARE_SET_ID = 'signed-in-ai'
export const WEB_PANELS_COMPARE_SET_ID = 'my-subscriptions'

/** Compare columns and judges must be chat models: embedding, rerank, image, video and audio models cannot answer. */
export function isCompareChatModel(model: Model, provider: Provider | undefined): boolean {
  return model.isEnabled && !!provider?.isEnabled && !isAgentOnlyProvider(provider) && !isNonChatModel(model)
}

export function limitCompareSelection(selection: readonly CacheCompareModelSelection[]): CacheCompareModelSelection[] {
  if (selection.length <= MAX_COMPARE_COLUMNS) return selection.map((item) => ({ ...item }))

  const nonApiColumns = selection.filter((item) => item.id.startsWith('webapp::') || item.id.startsWith('cli::'))
  const apiModels = selection.filter((item) => !item.id.startsWith('webapp::') && !item.id.startsWith('cli::'))
  return [...nonApiColumns, ...apiModels].slice(0, MAX_COMPARE_COLUMNS).map((item) => ({ ...item }))
}

export function buildCompareDefaultSets({
  freeModels,
  signedInIds,
  signedInSetName,
  subscriptionIds,
  freeSetName,
  subscriptionsSetName
}: {
  freeModels: readonly Model[]
  signedInIds: readonly CompareColumnId[]
  signedInSetName: string
  subscriptionIds: readonly CompareColumnId[]
  freeSetName: string
  subscriptionsSetName: string
}): CacheCompareSavedSet[] {
  const families = ['llama', 'gemma', 'qwen', 'deepseek', 'mistral']
  const preferred = families.flatMap((family) =>
    freeModels.filter((model) => `${model.name} ${model.apiModelId}`.toLowerCase().includes(family))
  )
  const preferredIds = new Set(preferred.map((model) => model.id))
  const cappedFreeModels = [...preferred, ...freeModels.filter((model) => !preferredIds.has(model.id))].slice(
    0,
    MAX_COMPARE_COLUMNS
  )

  return [
    {
      id: SIGNED_IN_COMPARE_SET_ID,
      name: signedInSetName,
      selection: limitCompareSelection(signedInIds.map((id) => ({ id, enabled: true })))
    },
    {
      id: WEB_PANELS_COMPARE_SET_ID,
      name: subscriptionsSetName,
      selection: limitCompareSelection(subscriptionIds.map((id) => ({ id, enabled: true })))
    },
    {
      id: 'free',
      name: freeSetName,
      selection: cappedFreeModels.map((model) => ({ id: model.id, enabled: true }))
    }
  ]
}

export function resolveCompareSavedSetId(setId: string): string {
  return setId === 'all-enabled' ? WEB_PANELS_COMPARE_SET_ID : setId
}

export const DEFAULT_COMPARE_CLI_ORDER: readonly CompareCliId[] = ['claude', 'agy', 'codex']

const WEAK_LOGIN_MODEL_PATTERN = /(mini|nano|spark)/i

/** The strongest ChatGPT login (openai-codex) model: highest GPT version, full-size before mini/spark. */
export function pickBestChatGptLoginModel(chatModelIds: readonly string[]): string | undefined {
  const rank = (id: string) => {
    const version = Number(/gpt-(\d+(?:\.\d+)?)/i.exec(id)?.[1] ?? 0)
    return version * 10 - (WEAK_LOGIN_MODEL_PATTERN.test(id) ? 5 : 0)
  }
  return chatModelIds
    .filter((id) => id.startsWith('openai-codex::'))
    .reduce<string | undefined>((best, id) => (best === undefined || rank(id) > rank(best) ? id : best), undefined)
}

const SIGNED_IN_COMPARE_CLI_ORDER: readonly CompareCliId[] = ['claude', 'agy']

export function getSignedInAiColumnIds(
  chatModelIds: readonly string[],
  availableCliIds: readonly CompareCliId[]
): CompareColumnId[] {
  // ChatGPT answers through the in-app login; the Codex CLI is only used when picked by hand.
  const chatGptModel = pickBestChatGptLoginModel(chatModelIds)
  const signedInCliIds = new Set(availableCliIds)
  const chatGptColumn = chatGptModel ? (chatGptModel as CompareColumnId) : null

  return [
    ...(chatGptColumn ? [chatGptColumn] : []),
    ...SIGNED_IN_COMPARE_CLI_ORDER.filter((id) => signedInCliIds.has(id)).map((id): CompareColumnId => `cli::${id}`)
  ]
}

export interface ReconcileCompareSelectionsInput {
  selection: readonly CacheCompareModelSelection[]
  savedSets: readonly CacheCompareSavedSet[]
  chatModelIds: readonly string[]
  webAppIds: readonly string[]
  cliIds: readonly CompareCliId[]
  subscriptionAppIds: readonly string[]
  isFreshProfile: boolean
  defaultsSeeded: boolean
  judgeId: string
  savedSetName: string
  signedInSetName?: string
}

export interface ReconciledCompareSelections {
  selection: CacheCompareModelSelection[]
  savedSets: CacheCompareSavedSet[]
  seeded: boolean
  overflowTotal?: number
}

export function reconcileCompareSelections({
  selection,
  savedSets,
  chatModelIds,
  webAppIds,
  cliIds,
  isFreshProfile,
  defaultsSeeded,
  judgeId,
  signedInSetName = 'Signed-in AI'
}: ReconcileCompareSelectionsInput): ReconciledCompareSelections {
  const modelIds = new Set(chatModelIds)
  const appIds = new Set(webAppIds.map((id) => id.toLowerCase()))
  const availableCliIds = new Set(cliIds)
  const isAvailable = (id: string): boolean => {
    if (id.startsWith('webapp::')) {
      try {
        return appIds.has(decodeURIComponent(id.slice('webapp::'.length)).toLowerCase())
      } catch {
        return false
      }
    }
    if (id.startsWith('cli::')) return availableCliIds.has(id.slice('cli::'.length) as CompareCliId)
    return modelIds.has(id)
  }

  const prunedSelection = selection.filter((item) => isAvailable(item.id)).map((item) => ({ ...item }))
  const prunedSavedSets = savedSets.map((set) => ({
    ...set,
    selection: set.selection.filter((item) => isAvailable(item.id)).map((item) => ({ ...item }))
  }))
  const overflowTotal = Math.max(
    prunedSelection.length > MAX_COMPARE_COLUMNS ? prunedSelection.length : 0,
    ...prunedSavedSets.map((set) => (set.selection.length > MAX_COMPARE_COLUMNS ? set.selection.length : 0))
  )
  const limitedSelection = limitCompareSelection(prunedSelection)
  const limitedSavedSets = prunedSavedSets.map((set) => ({
    ...set,
    selection: limitCompareSelection(set.selection)
  }))
  const allSelectionEntriesWereStale = selection.length > 0 && prunedSelection.length === 0
  const canSeedFreshProfile =
    isFreshProfile && !defaultsSeeded && selection.length === 0 && savedSets.length === 0 && judgeId === 'auto'

  if (!allSelectionEntriesWereStale && !canSeedFreshProfile) {
    return {
      selection: limitedSelection,
      savedSets: limitedSavedSets,
      seeded: false,
      ...(overflowTotal > 0 ? { overflowTotal } : {})
    }
  }

  const signedInSet: CacheCompareSavedSet = {
    id: SIGNED_IN_COMPARE_SET_ID,
    name: signedInSetName,
    selection: getSignedInAiColumnIds(chatModelIds, cliIds).map((id) => ({ id, enabled: true }))
  }
  return {
    selection: signedInSet.selection.map((item) => ({ ...item })),
    savedSets: [...limitedSavedSets.filter((set) => set.id !== signedInSet.id), signedInSet],
    seeded: true,
    ...(overflowTotal > 0 ? { overflowTotal } : {})
  }
}

interface FirstRunCompareDefaultsInput {
  isFreshProfile: boolean
  defaultsSeeded: boolean
  selection: readonly CacheCompareModelSelection[]
  savedSets: readonly CacheCompareSavedSet[]
  judgeId: string
  chatModelIds: readonly CompareColumnId[]
  availableCliIds: readonly CompareCliId[]
  signedInSetName: string
}

export function getFirstRunCompareDefaults({
  isFreshProfile,
  defaultsSeeded,
  selection,
  savedSets,
  judgeId,
  chatModelIds,
  availableCliIds,
  signedInSetName
}: FirstRunCompareDefaultsInput): { selection: CacheCompareModelSelection[]; savedSet: CacheCompareSavedSet } | null {
  if (!isFreshProfile || defaultsSeeded || selection.length > 0 || savedSets.length > 0 || judgeId !== 'auto')
    return null

  const defaultSelection: CacheCompareModelSelection[] = getSignedInAiColumnIds(chatModelIds, availableCliIds).map(
    (id) => ({
      id,
      enabled: true
    })
  )

  return {
    selection: defaultSelection,
    savedSet: {
      id: SIGNED_IN_COMPARE_SET_ID,
      name: signedInSetName,
      selection: defaultSelection.map((item) => ({ ...item }))
    }
  }
}

export interface MigrateCompareLoginDefaultsInput {
  selection: readonly CacheCompareModelSelection[]
  savedSets: readonly CacheCompareSavedSet[]
  signedInSelection: readonly CacheCompareModelSelection[]
  oldWebSelection: readonly CacheCompareModelSelection[]
  signedInSetName: string
}

export interface MigratedCompareLoginDefaults {
  selection: CacheCompareModelSelection[]
  savedSets: CacheCompareSavedSet[]
  switchedSelection: boolean
}

export function migrateCompareLoginDefaults({
  selection,
  savedSets,
  signedInSelection,
  oldWebSelection,
  signedInSetName
}: MigrateCompareLoginDefaultsInput): MigratedCompareLoginDefaults {
  const signedInSet: CacheCompareSavedSet = {
    id: SIGNED_IN_COMPARE_SET_ID,
    name: signedInSetName,
    selection: signedInSelection.map((item) => ({ ...item }))
  }
  const hasSignedInSet = savedSets.some((set) => set.id === signedInSet.id)
  const switchedSelection = compareSelectionsEqual(selection, oldWebSelection)

  return {
    selection: switchedSelection
      ? signedInSet.selection.map((item) => ({ ...item }))
      : selection.map((item) => ({ ...item })),
    savedSets: hasSignedInSet
      ? savedSets.map((set) => ({ ...set, selection: set.selection.map((item) => ({ ...item })) }))
      : [...savedSets.map((set) => ({ ...set, selection: set.selection.map((item) => ({ ...item })) })), signedInSet],
    switchedSelection
  }
}

/**
 * Moves saved Compare columns from the ChatGPT Codex CLI to the ChatGPT login model, and points the
 * Signed-in AI set at the strongest login model. The current selection follows when it mirrored that set.
 */
export function upgradeSignedInChatGptColumns({
  selection,
  savedSets,
  chatModelIds
}: {
  selection: readonly CacheCompareModelSelection[]
  savedSets: readonly CacheCompareSavedSet[]
  chatModelIds: readonly string[]
}): { selection: CacheCompareModelSelection[]; savedSets: CacheCompareSavedSet[] } {
  const best = pickBestChatGptLoginModel(chatModelIds)
  const copy = (items: readonly CacheCompareModelSelection[]) => items.map((item) => ({ ...item }))
  if (!best)
    return {
      selection: copy(selection),
      savedSets: savedSets.map((set) => ({ ...set, selection: copy(set.selection) }))
    }

  const upgrade = (items: readonly CacheCompareModelSelection[], replaceLoginModels: boolean) => {
    const next: CacheCompareModelSelection[] = []
    for (const item of items) {
      const isChatGpt = item.id === 'cli::codex' || (replaceLoginModels && item.id.startsWith('openai-codex::'))
      const id = isChatGpt ? (best as CompareColumnId) : item.id
      if (!next.some((existing) => existing.id === id)) next.push({ ...item, id })
    }
    return next
  }
  const oldSignedIn = savedSets.find((set) => set.id === SIGNED_IN_COMPARE_SET_ID)
  const followsSignedIn = oldSignedIn !== undefined && compareSelectionsEqual(selection, oldSignedIn.selection)
  const nextSavedSets = savedSets.map((set) => ({
    ...set,
    selection: upgrade(set.selection, set.id === SIGNED_IN_COMPARE_SET_ID)
  }))
  const nextSignedIn = nextSavedSets.find((set) => set.id === SIGNED_IN_COMPARE_SET_ID)
  return {
    selection: followsSignedIn && nextSignedIn ? copy(nextSignedIn.selection) : upgrade(selection, false),
    savedSets: nextSavedSets
  }
}

function compareSelectionsEqual(
  left: readonly CacheCompareModelSelection[],
  right: readonly CacheCompareModelSelection[]
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item.id === right[index]?.id && item.enabled === right[index]?.enabled)
  )
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

export interface ResolveCompareJudgeInput {
  savedJudgeId: string
  availableCliIds: readonly CompareCliId[]
  visibleWebAppIds: readonly string[]
  chatModelIds: readonly CompareColumnId[]
}

/** Keep a usable saved judge; otherwise resolve silently using Fiesta's preference order. */
export function resolveCompareJudge({
  savedJudgeId,
  availableCliIds,
  visibleWebAppIds,
  chatModelIds
}: ResolveCompareJudgeInput): CompareColumnId | 'auto' {
  const available = new Set<CompareColumnId>([
    ...availableCliIds.map((id): CompareColumnId => `cli::${id}`),
    ...visibleWebAppIds.map((id): CompareColumnId => `webapp::${encodeURIComponent(id)}`),
    ...chatModelIds
  ])
  if (savedJudgeId !== 'auto' && available.has(savedJudgeId as CompareColumnId)) {
    return savedJudgeId as CompareColumnId
  }

  // Signed-in subscription models answer in the background; typing into a web panel would disturb its chat.
  const loginModel = pickBestChatGptLoginModel(chatModelIds)
  if (loginModel) return loginModel as CompareColumnId

  const cli = DEFAULT_COMPARE_CLI_ORDER.find((id) => availableCliIds.includes(id))
  if (cli) return `cli::${cli}`
  if (chatModelIds[0]) return chatModelIds[0]

  const chatGpt = visibleWebAppIds.find((id) => ['openai', 'chatgpt'].includes(id.toLowerCase()))
  return chatGpt ? `webapp::${encodeURIComponent(chatGpt)}` : 'auto'
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

export function addCompareColumn(
  selection: CacheCompareModelSelection[],
  modelId: CompareColumnId
): CacheCompareModelSelection[] {
  const current = selection.find((item) => item.id === modelId)
  if (current) return setCompareModelEnabled(selection, modelId, true)
  if (selection.length >= MAX_COMPARE_COLUMNS) return selection
  return [...selection, { id: modelId, enabled: true }]
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
  return limitCompareSelection(set.selection)
}

export interface CompareSelectionState {
  selection: CacheCompareModelSelection[]
  customSelection: CacheCompareModelSelection[] | null
  activeSetId: string
}

export function selectCompareSet(
  state: CompareSelectionState,
  setId: string,
  sets: readonly CacheCompareSavedSet[]
): CompareSelectionState {
  if (setId === 'custom') {
    return {
      ...state,
      selection: limitCompareSelection(state.customSelection ?? state.selection),
      activeSetId: 'custom'
    }
  }

  const resolvedSetId = resolveCompareSavedSetId(setId)
  const selectedSet = sets.find((set) => set.id === resolvedSetId)
  if (!selectedSet) return { ...state, activeSetId: 'custom' }

  return {
    ...state,
    selection: getCompareSetSelection(selectedSet),
    activeSetId: resolvedSetId
  }
}

export function editCompareSelection(selection: readonly CacheCompareModelSelection[]): CompareSelectionState {
  const editedSelection = limitCompareSelection(selection)
  return {
    selection: editedSelection,
    customSelection: editedSelection,
    activeSetId: 'custom'
  }
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

export function getCompareSendableColumnIds(
  requestedIds: readonly CompareColumnId[],
  columns: readonly CompareColumn[]
): CompareColumnId[] {
  const availableIds = new Set(columns.filter((column) => column.enabled).map((column) => column.id))
  return [...new Set(requestedIds)].filter((id) => availableIds.has(id))
}

export function getCompareVisibleModelIds(
  selection: CacheCompareModelSelection[],
  focusedModelId: CompareColumnId | null
): ReadonlySet<CompareColumnId> {
  if (focusedModelId) return new Set([focusedModelId])
  return new Set(selection.map((item) => item.id))
}
