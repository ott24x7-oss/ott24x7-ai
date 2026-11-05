export type CombineResponseStatus = 'waiting' | 'streaming' | 'done' | 'error' | 'skipped'

const WEB_JUDGE_ORDER = ['chatgpt', 'openai', 'claude', 'anthropic', 'gemini']

export function getWebJudgePriority(appId: string): number {
  const priority = WEB_JUDGE_ORDER.indexOf(appId.toLowerCase())
  return priority < 0 ? WEB_JUDGE_ORDER.length : priority
}

export interface AutoCombineState {
  enabled: boolean
  judgeId: string
  statuses: readonly CombineResponseStatus[]
  answerCount: number
  signature: string
  lastCombinedSignature?: string
}

export function canCombine(answerCount: number): boolean {
  return answerCount >= 2
}

export function getCombineSignature(
  topicId: string,
  question: string,
  sourceIds: readonly string[],
  turnId = ''
): string {
  return JSON.stringify([topicId, question, [...sourceIds].sort(), turnId])
}

export function shouldAutoCombine({
  enabled,
  judgeId,
  statuses,
  answerCount,
  signature,
  lastCombinedSignature
}: AutoCombineState): boolean {
  return (
    enabled &&
    judgeId !== 'auto' &&
    statuses.length >= 2 &&
    statuses.every((status) => status === 'done' || status === 'error' || status === 'skipped') &&
    canCombine(answerCount) &&
    signature !== '' &&
    signature !== lastCombinedSignature
  )
}
