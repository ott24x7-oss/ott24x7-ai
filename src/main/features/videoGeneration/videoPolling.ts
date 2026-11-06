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
