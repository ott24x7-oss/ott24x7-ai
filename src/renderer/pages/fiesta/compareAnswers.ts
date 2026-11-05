import type { CompareModelStatus } from '@renderer/types/compare'
import type { CherryUIMessage } from '@shared/data/types/message'
import type { UniqueModelId } from '@shared/data/types/model'

export interface LatestPrompt {
  question: string
  messageId: string
  index: number
}

export interface ApiAnswerSnapshot {
  content: string
  status: CompareModelStatus
}

export function getLatestPrompt(messages: readonly CherryUIMessage[]): LatestPrompt | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'user') continue
    return { question: getMessageText(message), messageId: message.id, index }
  }
  return null
}

export function getLatestApiAnswer(
  messages: readonly CherryUIMessage[],
  prompt: LatestPrompt | null,
  modelId: UniqueModelId
): ApiAnswerSnapshot | null {
  if (!prompt) return null

  for (let index = messages.length - 1; index > prompt.index; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant' || message.metadata?.modelId !== modelId) continue

    const status = message.metadata?.status
    return {
      content: getMessageText(message),
      status:
        status === 'pending' ? 'streaming' : status === 'error' ? 'error' : status === 'success' ? 'done' : 'waiting'
    }
  }

  return null
}

function getMessageText(message: CherryUIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('')
    .trim()
}
