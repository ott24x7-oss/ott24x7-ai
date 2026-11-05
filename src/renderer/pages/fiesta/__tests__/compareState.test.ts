import { describe, expect, it } from 'vitest'

import type { CacheCompareModelSelection } from '@shared/data/cache/cacheValueTypes'
import { type Model, MODEL_CAPABILITY } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'

import {
  addCompareColumn,
  buildCompareDefaultSets,
  getCompareSendModelIds,
  getCompareSendableColumnIds,
  getCompareVisibleModelIds,
  getCompareKeyboardAction,
  getDefaultCompareJudgeId,
  getFirstRunCompareDefaults,
  reconcileCompareSelections,
  isCompareChatModel,
  getCompareSetSelection,
  limitCompareSelection,
  MAX_COMPARE_COLUMNS,
  removeCompareModel,
  resolveCompareJudge,
  resolveCompareSavedSetId,
  reorderCompareModels,
  setCompareModelEnabled,
  syncCompareModelSelection
} from '../compareState'

const selection = [
  { id: 'openai-codex::gpt-a', enabled: true },
  { id: 'gemini::flash', enabled: false },
  { id: 'deepseek::chat', enabled: true }
] as const

describe('compare state', () => {
  it('seeds a fresh profile with the four login-based web panels and a matching subscriptions set', () => {
    const defaults = getFirstRunCompareDefaults({
      isFreshProfile: true,
      defaultsSeeded: false,
      selection: [],
      savedSets: [],
      judgeId: 'auto',
      enabledSiteAppIds: ['deepseek', 'gemini', 'openai', 'anthropic'],
      savedSetName: 'My subscriptions'
    })

    expect(defaults).toEqual({
      selection: [
        { id: 'webapp::anthropic', enabled: true },
        { id: 'webapp::openai', enabled: true },
        { id: 'webapp::gemini', enabled: true },
        { id: 'webapp::deepseek', enabled: true }
      ],
      savedSet: {
        id: 'my-subscriptions',
        name: 'My subscriptions',
        selection: [
          { id: 'webapp::anthropic', enabled: true },
          { id: 'webapp::openai', enabled: true },
          { id: 'webapp::gemini', enabled: true },
          { id: 'webapp::deepseek', enabled: true }
        ]
      }
    })
  })

  it('leaves existing or already customized compare settings untouched', () => {
    const input = {
      isFreshProfile: true,
      defaultsSeeded: false,
      selection: [] as CacheCompareModelSelection[],
      savedSets: [],
      judgeId: 'auto',
      enabledSiteAppIds: ['openai', 'gemini', 'anthropic', 'deepseek'],
      savedSetName: 'My subscriptions'
    }

    expect(getFirstRunCompareDefaults({ ...input, isFreshProfile: false })).toBeNull()
    expect(getFirstRunCompareDefaults({ ...input, defaultsSeeded: true })).toBeNull()
    expect(getFirstRunCompareDefaults({ ...input, selection: [selection[0]] })).toBeNull()
    expect(
      getFirstRunCompareDefaults({ ...input, savedSets: [{ id: 'custom', name: 'Custom', selection: [] }] })
    ).toBeNull()
    expect(getFirstRunCompareDefaults({ ...input, judgeId: 'webapp::openai' })).toBeNull()
  })

  it('prefers signed-in judge CLIs in Claude, Antigravity, Codex order, then ChatGPT web', () => {
    expect(getDefaultCompareJudgeId(['codex', 'agy', 'claude'], ['openai'])).toBe('cli::claude')
    expect(getDefaultCompareJudgeId([], ['anthropic', 'openai'])).toBe('webapp::openai')
    expect(getDefaultCompareJudgeId([], ['anthropic'])).toBe('auto')
  })

  it('keeps an available judge and silently resolves unavailable judges by CLI, ChatGPT web, then chat model', () => {
    const modelIds = ['openai-codex::gpt-a', 'deepseek::chat'] as const
    expect(
      resolveCompareJudge({
        savedJudgeId: 'deepseek::chat',
        availableCliIds: ['claude'],
        visibleWebAppIds: ['openai'],
        chatModelIds: modelIds
      })
    ).toBe('deepseek::chat')
    expect(
      resolveCompareJudge({
        savedJudgeId: 'cli::gone',
        availableCliIds: ['codex', 'agy', 'claude'],
        visibleWebAppIds: ['openai'],
        chatModelIds: modelIds
      })
    ).toBe('cli::claude')
    expect(
      resolveCompareJudge({
        savedJudgeId: 'webapp::removed',
        availableCliIds: [],
        visibleWebAppIds: ['anthropic', 'openai'],
        chatModelIds: modelIds
      })
    ).toBe('webapp::openai')
    expect(
      resolveCompareJudge({
        savedJudgeId: 'cli::unavailable',
        availableCliIds: [],
        visibleWebAppIds: ['anthropic'],
        chatModelIds: modelIds
      })
    ).toBe('openai-codex::gpt-a')
  })

  it('keeps a disabled model selected while excluding it from sends', () => {
    const next = setCompareModelEnabled([...selection], 'openai-codex::gpt-a', false)

    expect(next.map(({ id, enabled }) => [id, enabled])).toEqual([
      ['openai-codex::gpt-a', false],
      ['gemini::flash', false],
      ['deepseek::chat', true]
    ])
    expect(getCompareSendModelIds(next, null, false)).toEqual(['deepseek::chat'])
  })

  it('reorders chips without losing enabled state', () => {
    const next = reorderCompareModels([...selection], 'deepseek::chat', 'openai-codex::gpt-a')

    expect(next).toEqual([selection[2], selection[0], selection[1]])
  })

  it('keeps web app and signed-in CLI columns in saved selections and send order', () => {
    const mixed: CacheCompareModelSelection[] = [
      { id: 'webapp::openai', enabled: true },
      { id: 'openai-codex::gpt-a', enabled: true },
      { id: 'cli::claude', enabled: true }
    ]

    expect(getCompareSendModelIds(mixed, null, false)).toEqual(['webapp::openai', 'openai-codex::gpt-a', 'cli::claude'])
    expect(reorderCompareModels(mixed, 'cli::claude', 'webapp::openai').map(({ id }) => id)).toEqual([
      'cli::claude',
      'webapp::openai',
      'openai-codex::gpt-a'
    ])
  })

  it('caps oversized selections, keeping web and CLI columns before API models in saved order', () => {
    const oversized: CacheCompareModelSelection[] = [
      ...Array.from({ length: 7 }, (_, index) => ({ id: `provider::model-${index}` as const, enabled: true })),
      { id: 'webapp::claude', enabled: true },
      { id: 'cli::agy', enabled: false }
    ]

    const limited = limitCompareSelection(oversized)

    expect(limited).toHaveLength(MAX_COMPARE_COLUMNS)
    expect(limited).toEqual([
      { id: 'webapp::claude', enabled: true },
      { id: 'cli::agy', enabled: false },
      ...Array.from({ length: 6 }, (_, index) => ({ id: `provider::model-${index}`, enabled: true }))
    ])
  })

  it('caps loaded selections and saved sets and reports the largest trimmed set once', () => {
    const oversized: CacheCompareModelSelection[] = Array.from({ length: 12 }, (_, index) => ({
      id: `provider::model-${index}` as const,
      enabled: true
    }))
    const reconciled = reconcileCompareSelections({
      selection: oversized,
      savedSets: [{ id: 'coding', name: 'Coding', selection: oversized }],
      chatModelIds: oversized.map(({ id }) => id),
      webAppIds: [],
      cliIds: [],
      subscriptionAppIds: [],
      isFreshProfile: false,
      defaultsSeeded: true,
      judgeId: 'auto',
      savedSetName: 'My subscriptions'
    })

    expect(reconciled.selection).toHaveLength(MAX_COMPARE_COLUMNS)
    expect(reconciled.savedSets[0].selection).toHaveLength(MAX_COMPARE_COLUMNS)
    expect(reconciled.overflowTotal).toBe(12)
  })

  it('keeps every built-in set within eight columns with 100 enabled models', () => {
    const freeModels = Array.from({ length: 100 }, (_, index) => {
      const familyByIndex: Record<number, string> = {
        1: 'Gemma',
        2: 'Qwen',
        3: 'DeepSeek',
        4: 'Mistral',
        5: 'Llama'
      }
      const name = `${familyByIndex[index] ?? 'Other'} ${index}`
      return {
        id: `provider::model-${index}` as const,
        providerId: 'provider',
        apiModelId: name,
        name,
        capabilities: [],
        supportsStreaming: true,
        isEnabled: true,
        isHidden: false
      }
    })
    const sets = buildCompareDefaultSets({
      freeModels,
      subscriptionIds: ['webapp::claude', 'webapp::openai', 'webapp::gemini', 'webapp::deepseek'],
      freeSetName: 'Free models',
      subscriptionsSetName: 'My subscriptions'
    })

    expect(sets.map((set) => set.id)).toEqual(['my-subscriptions', 'free'])
    expect(sets.every((set) => set.selection.length <= MAX_COMPARE_COLUMNS)).toBe(true)
    expect(
      sets
        .find((set) => set.id === 'free')
        ?.selection.slice(0, 5)
        .map(({ id }) => id)
    ).toEqual(['provider::model-5', 'provider::model-1', 'provider::model-2', 'provider::model-3', 'provider::model-4'])
  })

  it('maps the removed all-enabled set id to My subscriptions', () => {
    expect(resolveCompareSavedSetId('all-enabled')).toBe('my-subscriptions')
    expect(resolveCompareSavedSetId('coding')).toBe('coding')
  })

  it('does not add newly available provider models to an existing selection', () => {
    const reconciled = reconcileCompareSelections({
      selection: [{ id: 'provider::existing', enabled: true }],
      savedSets: [],
      chatModelIds: ['provider::existing', 'provider::new'],
      webAppIds: [],
      cliIds: [],
      subscriptionAppIds: [],
      isFreshProfile: false,
      defaultsSeeded: true,
      judgeId: 'auto',
      savedSetName: 'My subscriptions'
    })

    expect(reconciled.selection).toEqual([{ id: 'provider::existing', enabled: true }])
  })

  it('does not add a ninth column while allowing an existing column to be re-enabled', () => {
    const eightColumns: CacheCompareModelSelection[] = Array.from({ length: MAX_COMPARE_COLUMNS }, (_, index) => ({
      id: `provider::model-${index}` as const,
      enabled: index > 0
    }))

    expect(addCompareColumn(eightColumns, 'provider::new')).toBe(eightColumns)
    expect(addCompareColumn(eightColumns, 'provider::model-0')[0]).toEqual({
      id: 'provider::model-0',
      enabled: true
    })
  })

  it('blocks sends when every selected column is stale or disabled', () => {
    expect(
      getCompareSendableColumnIds(
        ['model::removed', 'webapp::gone', 'cli::claude'],
        [
          { id: 'model::disabled', kind: 'api', model: {} as Model, enabled: false },
          { id: 'cli::codex', kind: 'cli', cliId: 'codex', name: 'Codex', enabled: true }
        ]
      )
    ).toEqual([])
  })

  it('prunes stale ids from live and saved selections and reseeds subscriptions if the live selection empties', () => {
    const reconciled = reconcileCompareSelections({
      selection: [
        { id: 'model::removed', enabled: true },
        { id: 'webapp::gone', enabled: true },
        { id: 'cli::claude', enabled: true }
      ],
      savedSets: [
        {
          id: 'custom',
          name: 'Custom',
          selection: [
            { id: 'model::removed', enabled: true },
            { id: 'webapp::openai', enabled: true },
            { id: 'cli::claude', enabled: true }
          ]
        }
      ],
      chatModelIds: ['model::live'],
      webAppIds: ['openai', 'anthropic', 'gemini', 'deepseek'],
      cliIds: ['codex'],
      subscriptionAppIds: ['anthropic', 'openai', 'gemini', 'deepseek'],
      isFreshProfile: false,
      defaultsSeeded: true,
      judgeId: 'auto',
      savedSetName: 'My subscriptions'
    })

    expect(reconciled.selection).toEqual([
      { id: 'webapp::anthropic', enabled: true },
      { id: 'webapp::openai', enabled: true },
      { id: 'webapp::gemini', enabled: true },
      { id: 'webapp::deepseek', enabled: true }
    ])
    expect(reconciled.savedSets).toEqual([
      { id: 'custom', name: 'Custom', selection: [{ id: 'webapp::openai', enabled: true }] },
      {
        id: 'my-subscriptions',
        name: 'My subscriptions',
        selection: reconciled.selection
      }
    ])
    expect(reconciled.seeded).toBe(true)
  })

  it('keeps a deliberately empty selection empty', () => {
    const reconciled = reconcileCompareSelections({
      selection: [],
      savedSets: [],
      chatModelIds: [],
      webAppIds: ['anthropic', 'openai', 'gemini', 'deepseek'],
      cliIds: [],
      subscriptionAppIds: ['anthropic', 'openai', 'gemini', 'deepseek'],
      isFreshProfile: true,
      defaultsSeeded: true,
      judgeId: 'auto',
      savedSetName: 'My subscriptions'
    })

    expect(reconciled).toEqual({ selection: [], savedSets: [], seeded: false })
  })

  it('selects every model in a saved set as enabled', () => {
    expect(
      getCompareSetSelection({
        id: 'work',
        name: 'Work',
        selection: [
          { id: 'gemini::flash', enabled: false },
          { id: 'deepseek::chat', enabled: true }
        ]
      })
    ).toEqual([
      { id: 'gemini::flash', enabled: false },
      { id: 'deepseek::chat', enabled: true }
    ])
  })

  it('removes a model from future display and sends', () => {
    const next = removeCompareModel([...selection], 'gemini::flash')

    expect(next.map((item) => item.id)).toEqual(['openai-codex::gpt-a', 'deepseek::chat'])
    expect(getCompareVisibleModelIds(next, null)).toEqual(new Set(['openai-codex::gpt-a', 'deepseek::chat']))
  })

  it('preserves a model toggle when reconciling the picker selection', () => {
    expect(syncCompareModelSelection([...selection], ['gemini::flash', 'openai-codex::gpt-a'])).toEqual([
      selection[1],
      selection[0]
    ])
  })

  it('sends to the focused model only when that option is enabled', () => {
    expect(getCompareSendModelIds([...selection], 'deepseek::chat', true)).toEqual(['deepseek::chat'])
    expect(getCompareSendModelIds([...selection], 'gemini::flash', true)).toEqual([])
  })

  it('limits the visible reply list to the focused model', () => {
    expect(getCompareVisibleModelIds([...selection], 'gemini::flash')).toEqual(new Set(['gemini::flash']))
  })

  it('maps Ctrl+1..9 to a selected model and Escape to exiting focus', () => {
    expect(
      getCompareKeyboardAction(
        '2',
        true,
        null,
        selection.map((item) => item.id)
      )
    ).toEqual({
      type: 'focus-model',
      modelId: 'gemini::flash'
    })
    expect(
      getCompareKeyboardAction(
        'Escape',
        false,
        'gemini::flash',
        selection.map((item) => item.id)
      )
    ).toEqual({
      type: 'exit-focus'
    })
    expect(
      getCompareKeyboardAction(
        '9',
        true,
        null,
        selection.map((item) => item.id)
      )
    ).toBeNull()
  })
})

describe('isCompareChatModel', () => {
  const chatModel = (capabilities: Model['capabilities'] = []): Model => ({
    id: 'local::qwen3',
    providerId: 'local',
    apiModelId: 'qwen3',
    name: 'qwen3',
    capabilities,
    supportsStreaming: true,
    isEnabled: true,
    isHidden: false
  })
  const provider = { id: 'local', isEnabled: true, authMethods: ['api-key'] } as unknown as Provider

  it('keeps chat models that can answer a prompt', () => {
    expect(isCompareChatModel(chatModel(), provider)).toBe(true)
  })

  it('drops embedding models such as Qwen3 Embedding, which cannot answer', () => {
    expect(isCompareChatModel(chatModel([MODEL_CAPABILITY.EMBEDDING]), provider)).toBe(false)
  })

  it('drops models from a disabled or missing provider', () => {
    expect(isCompareChatModel(chatModel(), { ...provider, isEnabled: false })).toBe(false)
    expect(isCompareChatModel(chatModel(), undefined)).toBe(false)
  })
})
