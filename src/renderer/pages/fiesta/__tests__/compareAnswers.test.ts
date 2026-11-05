import { describe, expect, it } from 'vitest'

import type { CherryUIMessage } from '@shared/data/types/message'

import { getLatestApiAnswer, getLatestPrompt } from '../compareAnswers'

function message(id: string, role: 'user' | 'assistant', text: string, modelId?: string, status?: string) {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
    metadata: { modelId, status }
  } as unknown as CherryUIMessage
}

describe('latest Compare answers', () => {
  it('uses only the latest user prompt and the matching model reply', () => {
    const messages = [
      message('u1', 'user', 'Old question'),
      message('a1', 'assistant', 'Old answer', 'openai-codex::gpt-5', 'success'),
      message('u2', 'user', 'Latest question'),
      message('a2', 'assistant', 'Latest answer', 'openai-codex::gpt-5', 'success'),
      message('a3', 'assistant', 'Still answering', 'gemini::flash', 'pending')
    ]
    const prompt = getLatestPrompt(messages)

    expect(prompt?.question).toBe('Latest question')
    expect(getLatestApiAnswer(messages, prompt, 'openai-codex::gpt-5')).toEqual({
      content: 'Latest answer',
      status: 'done'
    })
    expect(getLatestApiAnswer(messages, prompt, 'gemini::flash')).toEqual({
      content: 'Still answering',
      status: 'streaming'
    })
  })

  it('does not mistake an earlier model reply for the current turn', () => {
    const messages = [
      message('u1', 'user', 'Question'),
      message('a1', 'assistant', 'Answer', 'openai-codex::gpt-5', 'success'),
      message('u2', 'user', 'Question')
    ]
    const prompt = getLatestPrompt(messages)

    expect(getLatestApiAnswer(messages, prompt, 'openai-codex::gpt-5')).toBeNull()
  })
})
