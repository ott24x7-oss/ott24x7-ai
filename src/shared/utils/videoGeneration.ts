import type { Model } from '@shared/data/types/model'
import { MODEL_CAPABILITY } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'
import type { VideoGenerationRecord, VideoGenerationStatus } from '@shared/types/videoGeneration'

const COMMON_DURATIONS = [4, 5, 8, 10]
const COMMON_RATIOS = ['16:9', '9:16', '1:1']

export interface VideoModelOptions {
  durations: number[]
  ratios: string[]
  resolutions: Array<'480p' | '720p' | '1080p'>
  supportsAudio: boolean
  supportsImageReference: boolean
  supportsRatio: boolean
  timeoutMs: number
}

function bareModelId(modelId: string): string {
  return (modelId.split('::').at(-1)?.split('/').at(-1) ?? modelId).toLowerCase()
}

export function getVideoModelOptions(modelId: string): VideoModelOptions {
  const id = bareModelId(modelId)
  const options: VideoModelOptions = {
    durations: [...COMMON_DURATIONS],
    ratios: [...COMMON_RATIOS],
    resolutions: [],
    supportsAudio: true,
    supportsImageReference: false,
    supportsRatio: true,
    timeoutMs: 20 * 60 * 1000
  }

  if (id === 'grok-video') {
    return { ...options, durations: [6, 10, 15], ratios: [], supportsAudio: false, supportsRatio: false }
  }

  if (id === 'grok-imagine-video') {
    return {
      ...options,
      durations: Array.from({ length: 15 }, (_, index) => index + 1),
      ratios: ['16:9', '9:16', '1:1', '4:3', '3:2', '2:3', '3:4'],
      resolutions: ['480p', '720p'],
      supportsImageReference: true
    }
  }

  if (id === 'grok-imagine-video-1.5') {
    return {
      ...options,
      durations: Array.from({ length: 15 }, (_, index) => index + 1),
      ratios: ['16:9', '9:16', '1:1', '4:3', '3:2', '2:3', '3:4'],
      resolutions: ['1080p'],
      supportsImageReference: true
    }
  }

  if (id === 'seedance-2.5') {
    return {
      ...options,
      durations: Array.from({ length: 27 }, (_, index) => index + 4),
      ratios: [],
      supportsRatio: false,
      supportsImageReference: true
    }
  }

  if (id === 'seedance-2.0') {
    return { ...options, durations: [15] }
  }

  if (id.startsWith('minimax-h3-')) {
    return { ...options, timeoutMs: 30 * 60 * 1000 }
  }

  return options
}

export function getVideoCostEstimate(modelId: string, duration: number, resolution?: string): number | undefined {
  const id = bareModelId(modelId)
  const rate = id === 'grok-video' ? 0.2 : id === 'grok-imagine-video' && resolution === '480p' ? 1 : undefined
  return rate == null ? undefined : rate * duration
}

export function filterVideoGenerationModels(models: readonly Model[], providers: readonly Provider[]): Model[] {
  const providersById = new Map(providers.map((provider) => [provider.id, provider]))
  return models.filter((model) => {
    const provider = providersById.get(model.providerId)
    return (
      model.isEnabled &&
      !model.isHidden &&
      model.capabilities.includes(MODEL_CAPABILITY.VIDEO_GENERATION) &&
      provider?.isEnabled === true &&
      provider.apiKeys.some((apiKey) => apiKey.isEnabled)
    )
  })
}

export function isTerminalVideoStatus(status: VideoGenerationStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

export function shouldStopVideoPolling(input: {
  status: VideoGenerationStatus
  aborted: boolean
  appQuitting: boolean
  now: number
  deadline: number
}): boolean {
  return isTerminalVideoStatus(input.status) || input.aborted || input.appQuitting || input.now >= input.deadline
}

export function getVideoPollDelayMs(retryCount: number, retryAfterMs?: number): number {
  if (retryAfterMs != null && Number.isFinite(retryAfterMs)) return Math.max(0, retryAfterMs)
  return Math.min(15_000 * 2 ** Math.max(0, retryCount), 60_000)
}

export function getVideoResumeAction(record: VideoGenerationRecord): 'poll' | 'none' {
  return !isTerminalVideoStatus(record.status) && Boolean(record.taskId) ? 'poll' : 'none'
}
