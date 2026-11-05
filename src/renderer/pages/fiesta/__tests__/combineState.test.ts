import { describe, expect, it } from 'vitest'

import { canCombine, getCombineSignature, getWebJudgePriority, shouldAutoCombine } from '../combineState'

describe('combined answer state', () => {
  it('offers combine only when two answers are available', () => {
    expect(canCombine(0)).toBe(false)
    expect(canCombine(1)).toBe(false)
    expect(canCombine(2)).toBe(true)
  })

  it('prioritizes ChatGPT, Claude, and Gemini web judges before other sites', () => {
    expect(getWebJudgePriority('chatgpt')).toBeLessThan(getWebJudgePriority('claude'))
    expect(getWebJudgePriority('claude')).toBeLessThan(getWebJudgePriority('gemini'))
    expect(getWebJudgePriority('gemini')).toBeLessThan(getWebJudgePriority('deepseek'))
  })

  it('waits for every selected response to settle before auto-combining', () => {
    const state = {
      enabled: true,
      judgeId: 'cli::claude',
      statuses: ['done', 'streaming'] as const,
      answerCount: 2,
      signature: 'turn-1'
    }

    expect(shouldAutoCombine(state)).toBe(false)
    expect(shouldAutoCombine({ ...state, statuses: ['done', 'error'] })).toBe(true)
  })

  it('does not auto-combine when disabled, without a judge, or with fewer than two answers', () => {
    const state = {
      enabled: true,
      judgeId: 'cli::claude',
      statuses: ['done', 'done'] as const,
      answerCount: 2,
      signature: 'turn-1'
    }

    expect(shouldAutoCombine({ ...state, enabled: false })).toBe(false)
    expect(shouldAutoCombine({ ...state, judgeId: 'auto' })).toBe(false)
    expect(shouldAutoCombine({ ...state, answerCount: 1 })).toBe(false)
  })

  it('does not trigger the same turn twice and changes signature for a new prompt', () => {
    const signature = getCombineSignature('topic-1', 'Question?', ['chatgpt', 'claude'])
    const base = {
      enabled: true,
      judgeId: 'cli::claude',
      statuses: ['done', 'done'] as const,
      answerCount: 2,
      signature,
      lastCombinedSignature: signature
    }

    expect(shouldAutoCombine(base)).toBe(false)
    expect(getCombineSignature('topic-1', 'Another question', ['chatgpt', 'claude'])).not.toBe(signature)
  })
})
