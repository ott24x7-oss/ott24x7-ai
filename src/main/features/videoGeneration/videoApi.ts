import type { VideoApiStyle, VideoGenerationErrorCode } from '@shared/types/videoGeneration'
import { getVideoModelOptions } from '@shared/utils/videoGeneration'

export interface VideoRequestOptions {
  model: string
  prompt: string
  duration: number
  ratio?: string
  resolution?: '480p' | '720p' | '1080p'
  generateAudio: boolean
  inputReference?: string
}

export interface ParsedVideoStatus {
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  errorCode?: VideoGenerationErrorCode
}

export class VideoApiError extends Error {
  constructor(
    readonly status: number | undefined,
    readonly errorCode: VideoGenerationErrorCode,
    readonly retryAfterMs?: number,
    readonly retryable = false,
    readonly canFallback = false
  ) {
    super(errorCode)
    this.name = 'VideoApiError'
  }
}

function modelLeaf(model: string): string {
  return (model.split('::').at(-1)?.split('/').at(-1) ?? model).toLowerCase()
}

export function buildVideoRequestBody(style: VideoApiStyle, input: VideoRequestOptions): Record<string, unknown> {
  const id = modelLeaf(input.model)
  const limits = getVideoModelOptions(input.model)

  if (style === 'task') {
    return {
      model: input.model,
      prompt: input.prompt,
      duration: input.duration,
      ...(limits.supportsRatio && input.ratio ? { aspect_ratio: input.ratio } : {}),
      ...(input.resolution && limits.resolutions.includes(input.resolution) ? { size: input.resolution } : {}),
      ...(limits.supportsAudio ? { generate_audio: input.generateAudio } : {}),
      ...(limits.supportsImageReference && input.inputReference ? { image: input.inputReference } : {})
    }
  }

  const body: Record<string, unknown> = { model: input.model, prompt: input.prompt, seconds: String(input.duration) }
  if (limits.supportsRatio && input.ratio) body.ratio = input.ratio
  if (input.resolution && limits.resolutions.includes(input.resolution)) body.resolution = input.resolution
  if (limits.supportsAudio) body.generate_audio = input.generateAudio
  if (limits.supportsImageReference && input.inputReference) {
    if (id === 'seedance-2.5') {
      body.images = [{ url: input.inputReference, role: 'reference_image' }]
    } else {
      body.input_reference = input.inputReference
    }
  }
  return body
}

export function getVideoApiPath(style: VideoApiStyle): string {
  return style === 'openai' ? '/videos' : '/video/generations'
}

export function getVideoApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

export function parseVideoSubmission(payload: unknown): { taskId: string; status: ParsedVideoStatus } | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const data = payload as Record<string, unknown>
  const taskId = typeof data.task_id === 'string' ? data.task_id : typeof data.id === 'string' ? data.id : undefined
  if (!taskId) return undefined
  return { taskId, status: parseVideoStatus(data) }
}

export function parseVideoStatus(payload: unknown): ParsedVideoStatus {
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const rawStatus = String(data.status ?? '').toLowerCase()
  const status = ['queued', 'pending', 'accepted'].includes(rawStatus)
    ? 'queued'
    : ['in_progress', 'processing', 'running'].includes(rawStatus)
      ? 'in_progress'
      : ['completed', 'complete', 'success', 'succeeded'].includes(rawStatus)
        ? 'completed'
        : ['cancelled', 'canceled'].includes(rawStatus)
          ? 'cancelled'
          : ['failed', 'error'].includes(rawStatus)
            ? 'failed'
            : 'in_progress'
  const numericProgress = Number(data.progress)
  const progress = Number.isFinite(numericProgress)
    ? Math.min(100, Math.max(0, numericProgress <= 1 ? numericProgress * 100 : numericProgress))
    : undefined

  return {
    status,
    ...(progress == null ? {} : { progress }),
    ...(status === 'failed' ? { errorCode: mapVideoErrorCode(data) } : {})
  }
}

export function extractVideoUrl(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const data = payload as Record<string, unknown>
  const firstData = Array.isArray(data.data) ? data.data[0] : undefined
  const values = [data.video_url, data.url, data.output, (firstData as Record<string, unknown> | undefined)?.url]
  for (const value of values) {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value
    if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).url === 'string') {
      const url = (value as Record<string, unknown>).url as string
      if (/^https?:\/\//i.test(url)) return url
    }
  }
  return undefined
}

export function getVideoApiStyleOrder(preferredStyle?: VideoApiStyle): VideoApiStyle[] {
  return preferredStyle === 'task' ? ['task', 'openai'] : ['openai', 'task']
}

export async function submitWithVideoApiFallback<T>(
  preferredStyle: VideoApiStyle | undefined,
  submit: (style: VideoApiStyle) => Promise<T>
): Promise<{ style: VideoApiStyle; result: T }> {
  const styles = getVideoApiStyleOrder(preferredStyle)
  for (let index = 0; index < styles.length; index += 1) {
    const style = styles[index]
    try {
      return { style, result: await submit(style) }
    } catch (error) {
      if (index === styles.length - 1 || !shouldFallbackToVideoApi(error)) throw error
    }
  }
  throw new Error('No video API style was available')
}

export function shouldFallbackToVideoApi(error: unknown): boolean {
  return error instanceof VideoApiError && error.canFallback
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined
}

export function mapVideoErrorCode(input: {
  status?: number
  fail_code?: unknown
  code?: unknown
  error?: unknown
  message?: unknown
}): VideoGenerationErrorCode {
  const code = [
    input.fail_code,
    input.code,
    typeof input.error === 'object' && input.error ? (input.error as Record<string, unknown>).code : null
  ]
    .find((candidate) => typeof candidate === 'string')
    ?.toString()
    .toLowerCase()
  const message = [
    input.message,
    typeof input.error === 'object' && input.error ? (input.error as Record<string, unknown>).message : input.error
  ]
    .find((candidate) => typeof candidate === 'string')
    ?.toString()
    .toLowerCase()
  const detail = `${code ?? ''} ${message ?? ''}`

  if (input.status === 402 || /no_credits|insufficient_(?:funds|quota)|credit|balance/.test(detail)) return 'NO_CREDITS'
  if (code === 'prompt_blocked' || /content.?policy|prompt.?blocked/.test(detail)) return 'CONTENT_POLICY'
  if (code === 'model_not_found' || /model.?not.?found|unsupported.?model/.test(detail) || input.status === 404) {
    return 'MODEL_UNSUPPORTED'
  }
  if (
    code === 'service_timeout' ||
    input.status === 408 ||
    input.status === 504 ||
    /timed? ?out|timeout/.test(detail)
  ) {
    return 'TIMEOUT'
  }
  if (
    ['service_unavailable', 'service_overloaded'].includes(code ?? '') ||
    [429, 502, 503].includes(input.status ?? 0)
  ) {
    return 'SERVICE_UNAVAILABLE'
  }
  if (code === 'invalid_request') return 'INVALID_REQUEST'
  return 'GENERATION_FAILED'
}

export function isTransientVideoApiError(error: unknown): error is VideoApiError {
  return error instanceof VideoApiError && error.retryable
}
