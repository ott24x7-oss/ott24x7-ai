import { describe, expect, it } from 'vitest'

import { buildCompareCliPrompt } from '../cliConversation'

describe('Compare CLI stateless continuity', () => {
  it('includes previous user and assistant turns in each single-turn prompt', () => {
    expect(
      buildCompareCliPrompt(
        [
          { role: 'user', content: 'Explain the first result' },
          { role: 'assistant', content: 'It shows a baseline.' }
        ],
        'Now compare it to a second result'
      )
    ).toContain(
      'User:\nExplain the first result\n\nAssistant:\nIt shows a baseline.\n\nCurrent user message:\nNow compare it to a second result'
    )
  })

  it('limits prompt history to the latest twenty turns', () => {
    const history = Array.from({ length: 22 }, (_, index) => ({ role: 'user' as const, content: `turn-${index}` }))
    const prompt = buildCompareCliPrompt(history, 'current')
    expect(prompt).not.toContain('turn-0')
    expect(prompt).toContain('turn-2')
    expect(prompt).toContain('turn-21')
  })
})
