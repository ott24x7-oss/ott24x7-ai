import type { VideoGenerationStatus } from '@shared/types/videoGeneration'
import { getVideoPollDelayMs, isTerminalVideoStatus, shouldStopVideoPolling } from '@shared/utils/videoGeneration'

import { isTransientVideoApiError, VideoApiError } from './videoApi'

export async function pollVideoTask<T extends { status: VideoGenerationStatus }>(input: {
  initial: T
  deadline: number
  now: () => number
  signal: AbortSignal
  appQuitting: () => boolean
  wait: (delayMs: number, signal: AbortSignal) => Promise<void>
  poll: (signal: AbortSignal) => Promise<T>
  onUpdate: (value: T) => void | Promise<void>
}): Promise<T> {
  let current = input.initial
  let retryCount = 0
  let retryAfterMs: number | undefined

  while (
    !shouldStopVideoPolling({
      status: current.status,
      aborted: input.signal.aborted,
      appQuitting: input.appQuitting(),
      now: input.now(),
      deadline: input.deadline
    })
  ) {
    await input.wait(getVideoPollDelayMs(retryCount, retryAfterMs), input.signal)
    retryAfterMs = undefined
    if (input.signal.aborted || input.appQuitting() || isTerminalVideoStatus(current.status)) {
      return current
    }
    if (input.now() >= input.deadline) break

    try {
      current = await input.poll(input.signal)
      retryCount = 0
      await input.onUpdate(current)
    } catch (error) {
      if (!isTransientVideoApiError(error)) throw error
      retryCount += 1
      retryAfterMs = error.retryAfterMs
    }
  }

  if (!input.signal.aborted && !input.appQuitting() && !isTerminalVideoStatus(current.status)) {
    throw new VideoApiError(undefined, 'TIMEOUT')
  }
  return current
}

export const VIDEO_SUBMIT_RETRY_DELAYS_MS = [5_000, 10_000, 20_000]
const MAX_SUBMIT_RETRY_AFTER_MS = 30_000

/** Retries a submit that the provider rejected with a temporary error (429/502/503/504). */
export async function submitVideoWithRetry<T>(input: {
  signal: AbortSignal
  wait: (delayMs: number, signal: AbortSignal) => Promise<void>
  submit: () => Promise<T>
  delaysMs?: readonly number[]
}): Promise<T> {
  const delays = input.delaysMs ?? VIDEO_SUBMIT_RETRY_DELAYS_MS
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await input.submit()
    } catch (error) {
      if (!isTransientVideoApiError(error) || attempt >= delays.length || input.signal.aborted) throw error
      await input.wait(Math.min(error.retryAfterMs ?? delays[attempt], MAX_SUBMIT_RETRY_AFTER_MS), input.signal)
      if (input.signal.aborted) throw error
    }
  }
}
