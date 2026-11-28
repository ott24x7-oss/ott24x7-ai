import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { CherryUIMessage } from '@shared/data/types/message'

import {
  getBackupRetryDecision,
  getLatestApiAnswerForPrompt,
  getLatestPromptForBackup,
  type BackupRetryState,
  useBackupRetry
} from '../backupRetry'

function message(
  id: string,
  role: CherryUIMessage['role'],
  modelId?: string,
  status: 'error' | 'success' | 'pending' = 'success',
  error?: string
): CherryUIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text: role === 'user' ? 'question' : `answer-${id}` }],
    metadata: {
      modelId,
      status,
      ...(error ? { error } : {})
    }
  } as CherryUIMessage
}

function failedTurn(modelId = 'provider::primary', error = 'network failure'): CherryUIMessage[] {
  return [message('user-1', 'user'), message('answer-1', 'assistant', modelId, 'error', error)]
}

describe('backup retry', () => {
  it('selects the first eligible API backup for an errored normal-chat reply', () => {
    const messages = failedTurn()
    const prompt = getLatestPromptForBackup(messages)!
    const answer = getLatestApiAnswerForPrompt(messages, prompt)!
    const state: BackupRetryState = { attempted: new Set() }

    const decision = getBackupRetryDecision({
      messages,
      prompt,
      originalId: answer.modelId!,
      answer,
      candidateIds: ['provider::primary', 'cli::claude', 'webapp::search', 'provider::backup'],
      state,
      mode: 'chat'
    })

    expect(decision).toMatchObject({ kind: 'retry', backupId: 'provider::backup', originalId: 'provider::primary' })
  })

  it('does not retry aborted, paused, or safety-refusal errors', () => {
    for (const error of ['AbortError: request aborted', 'paused by user', 'blocked by safety policy']) {
      const messages = failedTurn('provider::primary', error)
      const prompt = getLatestPromptForBackup(messages)!
      const answer = getLatestApiAnswerForPrompt(messages, prompt)!
      expect(
        getBackupRetryDecision({
          messages,
          prompt,
          originalId: answer.modelId!,
          answer,
          candidateIds: ['provider::backup'],
          state: { attempted: new Set() },
          mode: 'chat'
        })
      ).toBeNull()
    }
  })

  it('caps a turn at three attempts and permits a new prompt to start over', () => {
    const messages = failedTurn()
    const prompt = getLatestPromptForBackup(messages)!
    const answer = getLatestApiAnswerForPrompt(messages, prompt)!
    const capped = getBackupRetryDecision({
      messages,
      prompt,
      originalId: answer.modelId!,
      answer,
      candidateIds: ['provider::backup-1'],
      state: { attempted: new Set(['provider::backup-1', 'provider::backup-2', 'provider::backup-3']) },
      mode: 'chat'
    })

    expect(capped?.kind).toBe('exhausted')
    const reset = getBackupRetryDecision({
      messages,
      prompt,
      originalId: answer.modelId!,
      answer,
      candidateIds: ['provider::backup-1'],
      state: { attempted: new Set() },
      mode: 'chat'
    })
    expect(reset).toMatchObject({ kind: 'retry', backupId: 'provider::backup-1' })
  })

  it('keys attempts by the user prompt so a new turn starts with a fresh budget', () => {
    const onRetry = vi.fn()
    const firstTurnRunning = [
      message('user-1', 'user'),
      message('answer-1', 'assistant', 'provider::primary', 'pending')
    ]
    const firstTurn = failedTurn()
    const secondTurnRunning = [
      message('user-2', 'user'),
      message('answer-2', 'assistant', 'provider::primary', 'pending')
    ]
    const secondTurn = [
      message('user-2', 'user'),
      message('answer-2', 'assistant', 'provider::primary', 'error', 'timeout')
    ]
    const { rerender, unmount } = renderHook(
      ({ messages }) =>
        useBackupRetry({
          enabled: true,
          messages,
          candidateIds: ['provider::backup'],
          mode: 'chat',
          onRetry
        }),
      { initialProps: { messages: firstTurnRunning } }
    )

    rerender({ messages: firstTurn })
    expect(onRetry).toHaveBeenCalledTimes(1)
    rerender({ messages: secondTurnRunning })
    rerender({ messages: secondTurn })
    expect(onRetry).toHaveBeenCalledTimes(2)
    unmount()
  })

  it('never retries an error that was already in the topic when it opened', () => {
    const onRetry = vi.fn()
    const { unmount } = renderHook(() =>
      useBackupRetry({
        enabled: true,
        messages: failedTurn(),
        candidateIds: ['provider::backup'],
        mode: 'chat',
        onRetry
      })
    )

    expect(onRetry).not.toHaveBeenCalled()
    unmount()
  })

  it('does not invoke retry while the setting is disabled', () => {
    const onRetry = vi.fn()
    const onExhausted = vi.fn()
    const { unmount } = renderHook(() =>
      useBackupRetry({
        enabled: false,
        messages: failedTurn(),
        candidateIds: ['provider::backup'],
        mode: 'chat',
        onRetry,
        onExhausted
      })
    )

    expect(onRetry).not.toHaveBeenCalled()
    expect(onExhausted).not.toHaveBeenCalled()
    unmount()
  })
})
