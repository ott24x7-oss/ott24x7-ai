import { useEffect, useRef } from 'react'

import type { CherryMessagePart, CherryUIMessage } from '@shared/data/types/message'

export const MAX_BACKUP_RETRY_ATTEMPTS = 3

export interface LatestPromptForBackup {
  question: string
  index: number
  messageId: string
}

export interface BackupAnswerForRetry {
  id: string
  modelId?: string
  status: 'waiting' | 'streaming' | 'done' | 'error'
  content: string
}

export interface BackupRetryState {
  attempted: Set<string>
  current?: string
  exhausted?: boolean
}

export interface BackupNotice {
  promptId?: string
  failedMessageId: string
  originalModelName: string
  backupModelId?: string
  backupModelName?: string
  reason: string
  exhausted?: boolean
}

export type BackupRetryDecision =
  | {
      kind: 'retry'
      originalId: string
      answer: BackupAnswerForRetry
      backupId: string
      reason: string
    }
  | {
      kind: 'exhausted'
      originalId: string
      answer: BackupAnswerForRetry
      backupId?: string
      reason: string
    }

interface GetBackupRetryDecisionOptions {
  messages: readonly CherryUIMessage[]
  prompt: LatestPromptForBackup
  originalId: string
  answer: BackupAnswerForRetry
  candidateIds: readonly string[]
  primaryIds?: ReadonlySet<string>
  state: BackupRetryState
  mode: 'chat' | 'compare'
  maxAttempts?: number
}

export function getLatestPromptForBackup(messages: readonly CherryUIMessage[]): LatestPromptForBackup | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'user') continue

    return {
      question: message.parts
        .flatMap((part) => (part.type === 'text' ? [part.text] : []))
        .join('')
        .trim(),
      index,
      messageId: message.id
    }
  }
  return null
}

export function getLatestApiAnswerForBackup(
  messages: readonly CherryUIMessage[],
  prompt: LatestPromptForBackup,
  modelId: string
): BackupAnswerForRetry | null {
  for (let index = messages.length - 1; index > prompt.index; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant' || message.metadata?.modelId !== modelId) continue

    return toBackupAnswer(message)
  }
  return null
}

export function getLatestApiAnswerForPrompt(
  messages: readonly CherryUIMessage[],
  prompt: LatestPromptForBackup
): BackupAnswerForRetry | null {
  for (let index = messages.length - 1; index > prompt.index; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant' || typeof message.metadata?.modelId !== 'string') continue

    return toBackupAnswer(message)
  }
  return null
}

export function getLatestApiErrorReason(
  messages: readonly CherryUIMessage[],
  prompt: LatestPromptForBackup,
  modelId: string
): string | undefined {
  const answer = getLatestApiAnswerForBackup(messages, prompt, modelId)
  if (!answer || answer.status !== 'error') return undefined
  return getAnswerErrorReason(messages, answer.id)
}

export function getBackupRetryDecision({
  messages,
  prompt,
  originalId,
  answer,
  candidateIds,
  primaryIds = new Set(),
  state,
  mode,
  maxAttempts = MAX_BACKUP_RETRY_ATTEMPTS
}: GetBackupRetryDecisionOptions): BackupRetryDecision | null {
  if (answer.status !== 'error' || (mode === 'chat' && !isRetryableError(messages, answer.id, answer.content))) {
    return null
  }

  if (state.current) {
    if (state.current.startsWith('cli::')) return null
    const activeBackup = getLatestApiAnswerForBackup(messages, prompt, state.current)
    if (activeBackup?.status !== 'error') return null
  }

  if (state.attempted.size >= maxAttempts) {
    return {
      kind: 'exhausted',
      originalId,
      answer,
      reason: getAnswerErrorReason(messages, answer.id) ?? 'The selected model failed'
    }
  }

  const backupId = candidateIds.find((candidateId) => {
    if (candidateId === originalId || primaryIds.has(candidateId) || state.attempted.has(candidateId)) return false
    if (mode === 'chat' && (candidateId.startsWith('cli::') || candidateId.startsWith('webapp::'))) return false
    return true
  })

  if (!backupId) {
    if (mode === 'chat' && state.attempted.size > 0) {
      return {
        kind: 'exhausted',
        originalId,
        answer,
        reason: getAnswerErrorReason(messages, answer.id) ?? 'All backup models failed'
      }
    }
    return null
  }

  return {
    kind: 'retry',
    originalId,
    answer,
    backupId,
    reason: getAnswerErrorReason(messages, answer.id) ?? 'the selected model failed'
  }
}

export interface UseBackupRetryOptions {
  enabled: boolean
  messages: readonly CherryUIMessage[]
  candidateIds: readonly string[]
  mode: 'chat' | 'compare'
  primaryIds?: readonly string[]
  currentQuestion?: string
  scopeKey?: string
  resetKey?: string
  onRetry: (decision: Extract<BackupRetryDecision, { kind: 'retry' }>) => void
  onExhausted?: (decision: Extract<BackupRetryDecision, { kind: 'exhausted' }>) => void
}

export function useBackupRetry({
  enabled,
  messages,
  candidateIds,
  mode,
  primaryIds = [],
  currentQuestion,
  scopeKey,
  resetKey,
  onRetry,
  onExhausted
}: UseBackupRetryOptions): void {
  const stateRef = useRef(new Map<string, BackupRetryState>())
  // Answers seen while still running in this session. Chat only retries these,
  // so opening an old topic whose last reply failed never starts a model call.
  const liveAnswerIdsRef = useRef(new Set<string>())

  useEffect(() => {
    if (resetKey) stateRef.current.clear()
  }, [resetKey])

  useEffect(() => {
    if (!enabled || candidateIds.length === 0) return

    for (const message of messages) {
      if (message.role !== 'assistant') continue
      const status = message.metadata?.status
      if (status !== 'error' && status !== 'success') liveAnswerIdsRef.current.add(message.id)
    }

    const prompt = getLatestPromptForBackup(messages)
    if (!prompt || (mode === 'compare' && prompt.question !== currentQuestion)) return

    const comparePrimaryIds = new Set(primaryIds)
    const latestAnswer = mode === 'chat' ? getLatestApiAnswerForPrompt(messages, prompt) : null
    const originalIds = mode === 'chat' ? (latestAnswer?.modelId ? [latestAnswer.modelId] : []) : primaryIds

    for (const originalId of originalIds) {
      const answer = mode === 'chat' ? latestAnswer : getLatestApiAnswerForBackup(messages, prompt, originalId)
      if (!answer) continue
      if (mode === 'chat' && !liveAnswerIdsRef.current.has(answer.id)) continue

      const stateKey =
        mode === 'chat'
          ? `${mode}:${scopeKey ?? prompt.messageId}`
          : `${mode}:${scopeKey ?? prompt.messageId}:${originalId}`
      const state = stateRef.current.get(stateKey) ?? { attempted: new Set<string>() }
      stateRef.current.set(stateKey, state)
      const decision = getBackupRetryDecision({
        messages,
        prompt,
        originalId,
        answer,
        candidateIds,
        primaryIds: comparePrimaryIds,
        state,
        mode
      })
      if (!decision) continue

      if (decision.kind === 'retry') {
        state.attempted.add(decision.backupId)
        state.current = decision.backupId
        onRetry(decision)
      } else if (!state.exhausted) {
        state.exhausted = true
        onExhausted?.(decision)
      }
    }
  }, [candidateIds, currentQuestion, enabled, messages, mode, onExhausted, onRetry, primaryIds, scopeKey])
}

function toBackupAnswer(message: CherryUIMessage): BackupAnswerForRetry {
  const status = message.metadata?.status
  return {
    id: message.id,
    modelId: message.metadata?.modelId,
    content: message.parts
      .flatMap((part) => (part.type === 'text' ? [part.text] : []))
      .join('')
      .trim(),
    status:
      status === 'pending' ? 'streaming' : status === 'error' ? 'error' : status === 'success' ? 'done' : 'waiting'
  }
}

function getAnswerErrorReason(messages: readonly CherryUIMessage[], messageId: string): string | undefined {
  const message = messages.find((candidate) => candidate.id === messageId)
  if (!message) return undefined

  const metadataError = (message.metadata as { error?: unknown } | undefined)?.error
  const partError = message.parts.find((part): part is Extract<CherryMessagePart, { type: 'data-error' }> => {
    return part.type === 'data-error'
  })?.data
  return stringifyError(metadataError) ?? stringifyError(partError)
}

function stringifyError(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  for (const key of ['message', 'reason', 'error']) {
    if (typeof record[key] === 'string' && record[key].trim()) return record[key].trim()
  }
  return undefined
}

function isRetryableError(messages: readonly CherryUIMessage[], messageId: string, content: string): boolean {
  const message = messages.find((candidate) => candidate.id === messageId)
  const partError = message?.parts.find((part) => part.type === 'data-error')
  const details = [
    content,
    stringifyError((message?.metadata as { error?: unknown } | undefined)?.error),
    stringifyError(partError && partError.data)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return !/(abort|cancel|canceled|cancelled|paused|content\s*policy|safety|refusal|blocked)/i.test(details)
}
