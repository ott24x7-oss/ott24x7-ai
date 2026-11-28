import { describe, expect, it } from 'vitest'

import type { CacheCompareModelSelection, CacheCompareSavedSet } from '@shared/data/cache/cacheValueTypes'
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
  getSignedInAiColumnIds,
  pickBestChatGptLoginModel,
  upgradeSignedInChatGptColumns,
  reconcileCompareSelections,
  isCompareChatModel,
  getCompareSetSelection,
  limitCompareSelection,
  migrateCompareLoginDefaults,
  MAX_COMPARE_COLUMNS,
  removeCompareModel,
  resolveCompareJudge,
  resolveCompareSavedSetId,
  selectCompareSet,
  reorderCompareModels,
  editCompareSelection,
  setCompareModelEnabled,
  syncCompareModelSelection
} from '../compareState'

const selection = [
  { id: 'openai-codex::gpt-a', enabled: true },
  { id: 'gemini::flash', enabled: false },
  { id: 'deepseek::chat', enabled: true }
] as const

describe('compare state', () => {
  it('seeds a fresh profile with the available signed-in models and no web panels', () => {
    const defaults = getFirstRunCompareDefaults({
      isFreshProfile: true,
      defaultsSeeded: false,
      selection: [],
      savedSets: [],
      judgeId: 'auto',
      chatModelIds: ['openai-codex::gpt-5', 'openrouter::free'],
      availableCliIds: ['claude', 'agy', 'codex'],
      signedInSetName: 'Signed-in AI'
    })

    expect(defaults).toEqual({
      selection: [
        { id: 'openai-codex::gpt-5', enabled: true },
        { id: 'cli::claude', enabled: true },
        { id: 'cli::agy', enabled: true }
      ],
      savedSet: {
        id: 'signed-in-ai',
        name: 'Signed-in AI',
        selection: [
          { id: 'openai-codex::gpt-5', enabled: true },
          { id: 'cli::claude', enabled: true },
          { id: 'cli::agy', enabled: true }
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
      chatModelIds: ['openai-codex::gpt-5'] as const,
      availableCliIds: ['claude'] as const,
      signedInSetName: 'Signed-in AI'
    }

    expect(getFirstRunCompareDefaults({ ...input, isFreshProfile: false })).toBeNull()
    expect(getFirstRunCompareDefaults({ ...input, defaultsSeeded: true })).toBeNull()
    expect(getFirstRunCompareDefaults({ ...input, selection: [selection[0]] })).toBeNull()
    expect(
      getFirstRunCompareDefaults({ ...input, savedSets: [{ id: 'custom', name: 'Custom', selection: [] }] })
    ).toBeNull()
    expect(getFirstRunCompareDefaults({ ...input, judgeId: 'webapp::openai' })).toBeNull()
  })

  it('keeps the signed-in set empty until a login becomes available', () => {
    expect(
      getFirstRunCompareDefaults({
        isFreshProfile: true,
        defaultsSeeded: false,
        selection: [],
        savedSets: [],
        judgeId: 'auto',
        chatModelIds: [],
        availableCliIds: [],
        signedInSetName: 'Signed-in AI'
      })
    ).toEqual({
      selection: [],
      savedSet: { id: 'signed-in-ai', name: 'Signed-in AI', selection: [] }
    })
  })

  it('does not duplicate the Codex CLI when the ChatGPT login model is available', () => {
    expect(getSignedInAiColumnIds(['openai-codex::gpt-5'], ['codex', 'claude', 'agy'])).toEqual([
      'openai-codex::gpt-5',
      'cli::claude',
      'cli::agy'
    ])
  })

  it('uses the ChatGPT login, never the Codex CLI, for the Signed-in AI set', () => {
    expect(getSignedInAiColumnIds([], ['codex', 'claude'])).toEqual(['cli::claude'])
  })

  it('picks the strongest ChatGPT login model over Spark and mini models', () => {
    expect(
      pickBestChatGptLoginModel([
        'openai-codex::gpt-5.3-codex-spark',
        'openai-codex::gpt-5.4-mini',
        'openai-codex::gpt-6.1-sol',
        'openai-codex::gpt-5.5',
        'openrouter::gpt-9'
      ])
    ).toBe('openai-codex::gpt-6.1-sol')
    expect(pickBestChatGptLoginModel(['openai-codex::gpt-6-mini', 'openai-codex::gpt-6'])).toBe('openai-codex::gpt-6')
    expect(pickBestChatGptLoginModel(['provider::model'])).toBeUndefined()
  })

  it('moves saved ChatGPT CLI columns to the strongest login model', () => {
    const oldSignedIn = [
      { id: 'openai-codex::gpt-5.3-codex-spark' as const, enabled: true },
      { id: 'cli::claude' as const, enabled: true }
    ]
    const result = upgradeSignedInChatGptColumns({
      selection: oldSignedIn,
      savedSets: [
        { id: 'signed-in-ai', name: 'Signed-in AI', selection: oldSignedIn },
        {
          id: 'mine',
          name: 'Mine',
          selection: [
            { id: 'cli::codex', enabled: false },
            { id: 'openai-codex::gpt-5.5', enabled: true }
          ]
        }
      ],
      chatModelIds: ['openai-codex::gpt-5.3-codex-spark', 'openai-codex::gpt-5.5', 'openai-codex::gpt-6-sol']
    })
    expect(result.selection.map((item) => item.id)).toEqual(['openai-codex::gpt-6-sol', 'cli::claude'])
    expect(result.savedSets[0].selection.map((item) => item.id)).toEqual(['openai-codex::gpt-6-sol', 'cli::claude'])
    // A custom set keeps its chosen login model; only the CLI column moves to the login.
    expect(result.savedSets[1].selection).toEqual([
      { id: 'openai-codex::gpt-6-sol', enabled: false },
      { id: 'openai-codex::gpt-5.5', enabled: true }
    ])
  })

  it('leaves the Codex CLI alone when there is no ChatGPT login model', () => {
    const selection = [{ id: 'cli::codex' as const, enabled: true }]
    expect(upgradeSignedInChatGptColumns({ selection, savedSets: [], chatModelIds: [] }).selection).toEqual(selection)
  })

  it('migrates only the old web-only default and preserves custom sets', () => {
    const customSet: CacheCompareSavedSet = {
      id: 'coding',
      name: 'Coding',
      selection: [{ id: 'provider::model', enabled: true }]
    }
    const oldWebSelection = [
      { id: 'webapp::anthropic', enabled: true },
      { id: 'webapp::openai', enabled: true }
    ] as const
    const signedInSelection = [{ id: 'openai-codex::gpt-5', enabled: true }] as const
    const migrated = migrateCompareLoginDefaults({
      selection: oldWebSelection,
      savedSets: [customSet],
      signedInSelection,
      oldWebSelection,
      signedInSetName: 'Signed-in AI'
    })

    expect(migrated.selection).toEqual(signedInSelection)
    expect(migrated.savedSets).toEqual([
      customSet,
      { id: 'signed-in-ai', name: 'Signed-in AI', selection: signedInSelection }
    ])
    expect(migrated.switchedSelection).toBe(true)

    const unchanged = migrateCompareLoginDefaults({
      selection: migrated.selection,
      savedSets: migrated.savedSets,
      signedInSelection,
      oldWebSelection,
      signedInSetName: 'Signed-in AI'
    })
    expect(unchanged.selection).toEqual(migrated.selection)
    expect(unchanged.savedSets).toEqual(migrated.savedSets)
    expect(unchanged.switchedSelection).toBe(false)
  })

  it('keeps a customized selection while adding the signed-in set', () => {
    const customSelection = [{ id: 'provider::model', enabled: true }] as const
    const customSet: CacheCompareSavedSet = {
      id: 'coding',
      name: 'Coding',
      selection: [{ id: 'provider::saved', enabled: true }]
    }
    const migrated = migrateCompareLoginDefaults({
      selection: customSelection,
      savedSets: [customSet],
      signedInSelection: [{ id: 'cli::claude', enabled: true }],
      oldWebSelection: [{ id: 'webapp::openai', enabled: true }],
      signedInSetName: 'Signed-in AI'
    })

    expect(migrated.selection).toEqual(customSelection)
    expect(migrated.savedSets[0]).toEqual(customSet)
    expect(migrated.savedSets[1].id).toBe('signed-in-ai')
    expect(migrated.switchedSelection).toBe(false)
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
    ).toBe('openai-codex::gpt-a')
    expect(
      resolveCompareJudge({
        savedJudgeId: 'auto',
        availableCliIds: ['codex', 'agy', 'claude'],
        visibleWebAppIds: ['openai'],
        chatModelIds: ['deepseek::chat']
      })
    ).toBe('cli::claude')
    expect(
      resolveCompareJudge({
        savedJudgeId: 'auto',
        availableCliIds: [],
        visibleWebAppIds: ['openai'],
        chatModelIds: ['deepseek::chat']
      })
    ).toBe('deepseek::chat')
    expect(
      resolveCompareJudge({
        savedJudgeId: 'webapp::removed',
        availableCliIds: [],
        visibleWebAppIds: ['anthropic', 'openai'],
        chatModelIds: []
      })
    ).toBe('webapp::openai')
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
      { id: 'cli::claude' as const, enabled: true }
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
      signedInIds: ['openai-codex::gpt-5', 'cli::claude', 'cli::agy'],
      signedInSetName: 'Signed-in AI',
      subscriptionIds: ['webapp::claude', 'webapp::openai', 'webapp::gemini', 'webapp::deepseek'],
      freeSetName: 'Free models',
      subscriptionsSetName: 'My subscriptions'
    })

    expect(sets.map((set) => set.id)).toEqual(['signed-in-ai', 'my-subscriptions', 'free'])
    expect(sets.every((set) => set.selection.length <= MAX_COMPARE_COLUMNS)).toBe(true)
    expect(
      sets
        .find((set) => set.id === 'free')
        ?.selection.slice(0, 5)
        .map(({ id }) => id)
    ).toEqual(['provider::model-5', 'provider::model-1', 'provider::model-2', 'provider::model-3', 'provider::model-4'])
  })

  it('maps the removed all-enabled set id to Web panels (extra)', () => {
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

  it('prunes stale ids from live and saved selections and reseeds Signed-in AI if the live selection empties', () => {
    const reconciled = reconcileCompareSelections({
      selection: [
        { id: 'model::removed', enabled: true },
        { id: 'webapp::gone', enabled: true },
        { id: 'cli::removed', enabled: true }
      ],
      savedSets: [
        {
          id: 'custom',
          name: 'Custom',
          selection: [
            { id: 'model::removed', enabled: true },
            { id: 'webapp::openai', enabled: true },
            { id: 'cli::claude' as const, enabled: true }
          ]
        }
      ],
      chatModelIds: ['openai-codex::gpt-5', 'model::live'],
      webAppIds: ['openai', 'anthropic', 'gemini', 'deepseek'],
      cliIds: ['claude', 'agy', 'codex'],
      subscriptionAppIds: ['anthropic', 'openai', 'gemini', 'deepseek'],
      isFreshProfile: false,
      defaultsSeeded: true,
      judgeId: 'auto',
      savedSetName: 'My subscriptions'
    })

    expect(reconciled.selection).toEqual([
      { id: 'openai-codex::gpt-5', enabled: true },
      { id: 'cli::claude', enabled: true },
      { id: 'cli::agy', enabled: true }
    ])
    expect(reconciled.savedSets).toEqual([
      {
        id: 'custom',
        name: 'Custom',
        selection: [
          { id: 'webapp::openai', enabled: true },
          { id: 'cli::claude' as const, enabled: true }
        ]
      },
      {
        id: 'signed-in-ai',
        name: 'Signed-in AI',
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

  it('restores the previous custom columns after a built-in set and records edits made there', () => {
    const customSelection = [
      { id: 'provider::one', enabled: true },
      { id: 'provider::two', enabled: true },
      { id: 'provider::three', enabled: false },
      { id: 'provider::four', enabled: true }
    ] as const
    const sets: CacheCompareSavedSet[] = [
      {
        id: 'my-subscriptions',
        name: 'My subscriptions',
        selection: [{ id: 'webapp::openai', enabled: true }]
      }
    ]
    const initial = {
      selection: [...customSelection],
      customSelection: [...customSelection],
      activeSetId: 'custom'
    }

    const subscriptions = selectCompareSet(initial, 'my-subscriptions', sets)
    expect(subscriptions.selection).toEqual(sets[0].selection)
    expect(subscriptions.customSelection).toEqual(customSelection)

    const restored = selectCompareSet(subscriptions, 'custom', sets)
    expect(restored.selection).toEqual(customSelection)

    const edited = editCompareSelection([{ id: 'provider::edited', enabled: true }])
    const restoredEdit = selectCompareSet(edited, 'custom', sets)
    expect(restoredEdit.selection).toEqual([{ id: 'provider::edited', enabled: true }])
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
