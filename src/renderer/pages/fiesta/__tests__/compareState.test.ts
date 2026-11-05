import { describe, expect, it } from 'vitest'

import type { CacheCompareModelSelection } from '@shared/data/cache/cacheValueTypes'

import {
  getCompareSendModelIds,
  getCompareVisibleModelIds,
  getCompareKeyboardAction,
  getDefaultCompareJudgeId,
  getFirstRunCompareDefaults,
  getCompareSetSelection,
  removeCompareModel,
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
