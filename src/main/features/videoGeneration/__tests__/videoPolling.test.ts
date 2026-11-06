import type { VideoGenerationStatus } from '@shared/types/videoGeneration'

import { VideoApiError } from '../videoApi'
import { pollVideoTask } from '../videoPolling'

describe('video task polling', () => {
  it('polls queued to in-progress to completed and returns each user-visible update', async () => {
    let now = 0
    const waits: number[] = []
    const updates: string[] = []
    const states = [
      { status: 'in_progress' as const, progress: 12 },
      { status: 'completed' as const, progress: 100 }
    ]
    const result = await pollVideoTask<{ status: VideoGenerationStatus; progress?: number }>({
      initial: { status: 'queued' as const },
      deadline: 90_000,
      now: () => now,
      signal: new AbortController().signal,
      appQuitting: () => false,
      wait: async (delay) => {
        waits.push(delay)
        now += delay
      },
      poll: async () => states.shift()!,
      onUpdate: ({ status }) => {
        updates.push(status)
      }
    })

    expect(result.status).toBe('completed')
    expect(waits).toEqual([15_000, 15_000])
    expect(updates).toEqual(['in_progress', 'completed'])
  })

  it('backs off a throttled poll, then stops when the provider reports failure', async () => {
    let now = 0
    const waits: number[] = []
    const updates: string[] = []
    let call = 0
    const result = await pollVideoTask<{ status: VideoGenerationStatus }>({
      initial: { status: 'queued' as const },
      deadline: 120_000,
      now: () => now,
      signal: new AbortController().signal,
      appQuitting: () => false,
      wait: async (delay) => {
        waits.push(delay)
        now += delay
      },
      poll: async () => {
        call += 1
        if (call === 1) throw new VideoApiError(429, 'SERVICE_UNAVAILABLE', 45_000, true)
        return { status: 'failed' as const }
      },
      onUpdate: ({ status }) => {
        updates.push(status)
      }
    })

    expect(waits).toEqual([15_000, 45_000])
    expect(updates).toEqual(['failed'])
    expect(result.status).toBe('failed')
  })

  it('stops without another request when cancellation or app shutdown aborts the tracker', async () => {
    const controller = new AbortController()
    let polls = 0
    const result = await pollVideoTask<{ status: VideoGenerationStatus }>({
      initial: { status: 'in_progress' as const },
      deadline: 60_000,
      now: () => 0,
      signal: controller.signal,
      appQuitting: () => false,
      wait: async () => controller.abort(),
      poll: async () => {
        polls += 1
        return { status: 'completed' as const }
      },
      onUpdate: () => undefined
    })

    expect(polls).toBe(0)
    expect(result.status).toBe('in_progress')
  })
})
