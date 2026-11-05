import { describe, expect, it } from 'vitest'

import { buildSynthesisPrompt } from '../synthesisPrompt'

describe('buildSynthesisPrompt', () => {
  it('labels each answer with its model name and requests the synthesis sections', () => {
    const prompt = buildSynthesisPrompt('What is 2 + 2?', [
      { modelName: 'Claude', content: '4' },
      { modelName: 'ChatGPT', content: 'The answer is four.' }
    ])

    expect(prompt).toContain('## User question\nWhat is 2 + 2?')
    expect(prompt).toContain('## Claude\n4')
    expect(prompt).toContain('## ChatGPT\nThe answer is four.')
    expect(prompt).toContain('## Best answer')
    expect(prompt).toContain('## Where they agree')
    expect(prompt).toContain('## Where they differ')
    expect(prompt).toContain('## Scores')
  })

  it('truncates an oversized answer and tells the judge the original length', () => {
    const content = 'x'.repeat(9_000)

    const prompt = buildSynthesisPrompt('Question?', [{ modelName: 'Gemini', content }])

    expect(prompt).toContain(
      `${'x'.repeat(8_000)}\n\n[Answer truncated after 8,000 characters; original length: 9,000 characters.]`
    )
    expect(prompt).not.toContain('x'.repeat(8_001))
  })
})
