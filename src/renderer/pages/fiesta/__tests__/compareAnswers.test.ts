import { describe, expect, it } from 'vitest'

import { formatCompareColumnErrorMessage } from '@renderer/utils/compareErrorMessage'

describe('formatCompareColumnErrorMessage', () => {
  it('names the column and replaces vectorization errors with a chat-model hint', () => {
    expect(
      formatCompareColumnErrorMessage('Qwen3 Embedding', 'Knowledge base vectorization failed', 'Choose a chat model.')
    ).toBe('Qwen3 Embedding: Choose a chat model.')
  })

  it('keeps other error reasons readable and names the affected column', () => {
    expect(formatCompareColumnErrorMessage('Claude Code', 'The CLI timed out.', 'Choose a chat model.')).toBe(
      'Claude Code: The CLI timed out.'
    )
  })
})
