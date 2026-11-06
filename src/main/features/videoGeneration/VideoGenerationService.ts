import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { copyFile, mkdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { dialog } from 'electron'

import { application } from '@application'
import { loggerService } from '@logger'
import { customFetch } from '@main/ai/utils/customFetch'
import { getBaseUrl, getExtraHeaders, getProviderAppHeaders } from '@main/ai/utils/provider'
import { BaseService, Injectable, Phase, ServicePhase } from '@main/core/lifecycle'
import { modelService } from '@main/data/services/ModelService'
import { providerService } from '@main/data/services/ProviderService'
import { mergeHeaders } from '@main/utils/http'
import type { Model } from '@shared/data/types/model'
import { ENDPOINT_TYPE, parseUniqueModelId } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'
import { AbsoluteFilePathSchema } from '@shared/types/file'
import type { CreateVideoGenerationInput, VideoApiStyle, VideoGenerationRecord } from '@shared/types/videoGeneration'
import { VideoGenerationRecordSchema } from '@shared/types/videoGeneration'
import { toFileUrl } from '@shared/utils/file'
import { getRawModelId, isGenerateVideoModel } from '@shared/utils/model'
import { getVideoModelOptions, getVideoResumeAction } from '@shared/utils/videoGeneration'

import {
  buildVideoRequestBody,
  extractVideoUrl,
  getVideoApiPath,
  getVideoApiUrl,
  mapVideoErrorCode,
  parseRetryAfter,
  parseVideoStatus,
  parseVideoSubmission,
  submitWithVideoApiFallback,
  VideoApiError
} from './videoApi'
import { pollVideoTask } from './videoPolling'

const logger = loggerService.withContext('VideoGenerationService')
const VIDEO_TEMP_FILENAME = 'video-generations.tmp.json'
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000

interface PersistedVideoState {
  records: VideoGenerationRecord[]
  preferredApiStyles: Record<string, VideoApiStyle>
}

interface ResolvedVideoProvider {
  model: Model
  provider: Provider
  modelApiId: string
  baseUrl: string
  headers: Record<string, string>
}

interface SubmissionResult {
  taskId: string
  style: VideoApiStyle
  status: ReturnType<typeof parseVideoStatus>
  outputUrl?: string
}

interface PolledVideoTask {
  status: VideoGenerationRecord['status']
  progress?: number
  errorCode?: VideoGenerationRecord['errorCode']
  outputUrl?: string
}

@Injectable('VideoGenerationService')
@ServicePhase(Phase.WhenReady)
export class VideoGenerationService extends BaseService {
  private readonly records = new Map<string, VideoGenerationRecord>()
  private readonly preferredApiStyles = new Map<string, VideoApiStyle>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly workers = new Map<string, Promise<void>>()
  private persistQueue: Promise<void> = Promise.resolve()

  protected async onInit(): Promise<void> {
    await this.loadState()
    for (const record of this.records.values()) {
      if (getVideoResumeAction(record) === 'poll') this.startWorker(record.id)
      else if (!['completed', 'failed', 'cancelled'].includes(record.status)) {
        this.updateRecord(record.id, { status: 'failed', errorCode: 'TIMEOUT' })
      }
    }
    await this.persistState()
  }

  protected async onStop(): Promise<void> {
    for (const controller of this.controllers.values()) controller.abort()
    await Promise.allSettled(this.workers.values())
    this.controllers.clear()
    this.workers.clear()
  }

  list(): VideoGenerationRecord[] {
    return [...this.records.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async create(input: CreateVideoGenerationInput): Promise<VideoGenerationRecord> {
    const resolved = this.resolveProvider(input.modelId)
    const modelOptions = getVideoModelOptions(resolved.modelApiId)
    if (!modelOptions.durations.includes(input.duration)) throw new VideoApiError(undefined, 'INVALID_REQUEST')
    if (input.ratio && (!modelOptions.supportsRatio || !modelOptions.ratios.includes(input.ratio))) {
      throw new VideoApiError(undefined, 'INVALID_REQUEST')
    }
    if (input.resolution && !modelOptions.resolutions.includes(input.resolution)) {
      throw new VideoApiError(undefined, 'INVALID_REQUEST')
    }
    if (input.inputReference && !modelOptions.supportsImageReference) {
      throw new VideoApiError(undefined, 'INVALID_REQUEST')
    }

    const now = new Date().toISOString()
    const record = VideoGenerationRecordSchema.parse({
      id: randomUUID(),
      providerId: resolved.provider.id,
      modelId: resolved.model.id,
      modelName: resolved.model.name,
      prompt: input.prompt.trim(),
      duration: input.duration,
      ratio: input.ratio ?? 'auto',
      ...(input.resolution ? { resolution: input.resolution } : {}),
      generateAudio: input.generateAudio,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      startedAt: Date.now()
    })

    this.records.set(record.id, record)
    await this.persistState()
    this.startWorker(record.id, input.inputReference)
    return record
  }

  async cancel(id: string): Promise<void> {
    const record = this.requireRecord(id)
    if (['completed', 'failed', 'cancelled'].includes(record.status)) return
    this.updateRecord(id, { status: 'cancelled', progress: undefined, errorCode: undefined })
    this.controllers.get(id)?.abort()
    await this.persistState()
  }

  async delete(id: string): Promise<void> {
    const record = this.requireRecord(id)
    if (!['completed', 'failed', 'cancelled'].includes(record.status)) {
      throw new VideoApiError(undefined, 'INVALID_REQUEST')
    }
    if (record.status === 'completed') {
      const videoPath = application.getPath('feature.video_generation.data', `${record.id}.mp4`)
      await unlink(videoPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
      })
    }
    this.records.delete(id)
    await this.persistState()
  }

  async save(id: string): Promise<boolean> {
    const record = this.requireRecord(id)
    if (record.status !== 'completed') return false
    const source = application.getPath('feature.video_generation.data', `${record.id}.mp4`)
    const result = await dialog.showSaveDialog({
      defaultPath: `${safeFilename(record.prompt)}.mp4`,
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }]
    })
    if (result.canceled || !result.filePath) return false
    await copyFile(source, result.filePath)
    return true
  }

  private startWorker(id: string, inputReference?: string): void {
    if (this.workers.has(id)) return
    const controller = new AbortController()
    this.controllers.set(id, controller)
    const worker = this.runJob(id, inputReference, controller.signal).finally(() => {
      this.controllers.delete(id)
      this.workers.delete(id)
    })
    this.workers.set(id, worker)
  }

  private async runJob(id: string, inputReference: string | undefined, signal: AbortSignal): Promise<void> {
    const record = this.requireRecord(id)
    try {
      const resolved = this.resolveProvider(record.modelId)
      const submission =
        record.taskId && record.apiStyle
          ? {
              taskId: record.taskId,
              style: record.apiStyle,
              status: {
                status: record.status,
                ...(record.progress == null ? {} : { progress: record.progress }),
                ...(record.errorCode ? { errorCode: record.errorCode } : {})
              }
            }
          : await this.submit(record, resolved, inputReference, signal)
      record.apiStyle = submission.style
      record.taskId = submission.taskId
      record.status = submission.status.status === 'completed' ? 'in_progress' : submission.status.status
      record.progress = submission.status.progress
      record.errorCode = submission.status.errorCode
      this.preferredApiStyles.set(record.providerId, submission.style)
      await this.publishAndPersist(record)

      if (record.status === 'failed' || record.status === 'cancelled') return
      let outputUrl = submission.outputUrl
      let providerCompleted = submission.status.status === 'completed'
      if (!providerCompleted) {
        const deadline = record.startedAt + getVideoModelOptions(resolved.modelApiId).timeoutMs
        const finalState = await pollVideoTask<PolledVideoTask>({
          initial: {
            status: record.status,
            ...(record.progress == null ? {} : { progress: record.progress }),
            ...(record.errorCode ? { errorCode: record.errorCode } : {})
          },
          deadline,
          now: Date.now,
          signal,
          appQuitting: () => application.isQuitting,
          wait: waitForPoll,
          poll: (pollSignal) => this.poll(record, resolved, pollSignal),
          onUpdate: (value) => {
            record.status = value.status === 'completed' ? 'in_progress' : value.status
            record.progress = value.progress
            record.errorCode = value.errorCode
            outputUrl = value.outputUrl ?? outputUrl
            return this.publishAndPersist(record)
          }
        })
        if (signal.aborted || application.isQuitting) return
        record.status = finalState.status === 'completed' ? 'in_progress' : finalState.status
        record.progress = finalState.progress
        record.errorCode = finalState.errorCode
        outputUrl = finalState.outputUrl ?? outputUrl
        providerCompleted = finalState.status === 'completed'
      }

      if (signal.aborted || application.isQuitting || record.status === 'cancelled') return
      if (record.status === 'failed') {
        await this.publishAndPersist(record)
        return
      }
      if (providerCompleted) {
        await this.downloadVideo(record, resolved, submission.style, outputUrl, signal)
      }
    } catch (error) {
      if (signal.aborted || application.isQuitting) return
      const current = this.records.get(id)
      if (!current || current.status === 'cancelled') return
      current.status = 'failed'
      current.errorCode =
        error instanceof VideoApiError ? error.errorCode : mapVideoErrorCode({ message: getErrorName(error) })
      current.progress = undefined
      await this.publishAndPersist(current)
      logger.warn('Video generation job failed', {
        jobId: id,
        providerId: current.providerId,
        modelId: current.modelId,
        errorCode: current.errorCode
      })
    }
  }

  private async submit(
    record: VideoGenerationRecord,
    resolved: ResolvedVideoProvider,
    inputReference: string | undefined,
    signal: AbortSignal
  ): Promise<SubmissionResult> {
    const bodyInput: CreateVideoGenerationInput = {
      modelId: record.modelId,
      prompt: record.prompt,
      duration: record.duration,
      ...(record.ratio !== 'auto' ? { ratio: record.ratio } : {}),
      ...(record.resolution ? { resolution: record.resolution } : {}),
      generateAudio: record.generateAudio,
      ...(inputReference ? { inputReference } : {})
    }
    const preferred = this.preferredApiStyles.get(record.providerId)
    const { style, result } = await submitWithVideoApiFallback(preferred, async (apiStyle) => {
      const payload = await this.requestJson(
        getVideoApiUrl(resolved.baseUrl, getVideoApiPath(apiStyle)),
        'POST',
        buildVideoRequestBody(apiStyle, { ...bodyInput, model: resolved.modelApiId }),
        resolved.headers,
        signal
      )
      const parsed = parseVideoSubmission(payload)
      if (!parsed) throw new VideoApiError(undefined, 'INVALID_REQUEST')
      return { ...parsed, outputUrl: extractVideoUrl(payload) }
    })
    return { ...result, style }
  }

  private async poll(
    record: VideoGenerationRecord,
    resolved: ResolvedVideoProvider,
    signal: AbortSignal
  ): Promise<PolledVideoTask> {
    if (!record.taskId || !record.apiStyle) throw new VideoApiError(undefined, 'INVALID_REQUEST')
    const path =
      record.apiStyle === 'openai'
        ? `/videos/${encodeURIComponent(record.taskId)}`
        : `/video/generations/${encodeURIComponent(record.taskId)}`
    const payload = await this.requestJson(
      getVideoApiUrl(resolved.baseUrl, path),
      'GET',
      undefined,
      resolved.headers,
      signal
    )
    const status = parseVideoStatus(payload)
    return {
      status: status.status,
      ...(status.progress == null ? {} : { progress: status.progress }),
      ...(status.errorCode ? { errorCode: status.errorCode } : {}),
      ...(extractVideoUrl(payload) ? { outputUrl: extractVideoUrl(payload) } : {})
    }
  }

  private async downloadVideo(
    record: VideoGenerationRecord,
    resolved: ResolvedVideoProvider,
    apiStyle: VideoApiStyle,
    outputUrl: string | undefined,
    signal: AbortSignal
  ): Promise<void> {
    const downloadUrl =
      apiStyle === 'openai'
        ? getVideoApiUrl(resolved.baseUrl, `/videos/${encodeURIComponent(record.taskId ?? '')}/content`)
        : outputUrl
    if (!downloadUrl || !/^https?:\/\//i.test(downloadUrl)) throw new VideoApiError(undefined, 'GENERATION_FAILED')

    const destination = application.getPath('feature.video_generation.data', `${record.id}.mp4`)
    const temporary = application.getPath('feature.video_generation.data', `${record.id}.tmp.mp4`)
    const headers = new Headers(resolved.headers)
    if (apiStyle === 'task' && new URL(downloadUrl).origin !== new URL(resolved.baseUrl).origin) {
      headers.delete('authorization')
      headers.delete('x-api-key')
    }
    const response = await customFetch(downloadUrl, {
      method: 'GET',
      headers,
      signal: requestSignal(signal),
      cache: 'no-store'
    })
    if (!response.ok) {
      const body = await response.json().catch(() => undefined)
      throw this.createHttpError(response.status, body, response.headers.get('retry-after'))
    }
    const contentType = response.headers.get('content-type')?.toLowerCase()
    if (contentType && !contentType.startsWith('video/') && !contentType.includes('octet-stream')) {
      throw new VideoApiError(response.status, 'GENERATION_FAILED')
    }
    if (!response.body) throw new VideoApiError(response.status, 'GENERATION_FAILED')

    await mkdir(path.dirname(destination), { recursive: true })
    try {
      await pipeline(Readable.from(response.body as unknown as AsyncIterable<Uint8Array>), createWriteStream(temporary))
      await rm(destination, { force: true })
      await rename(temporary, destination)
    } catch (error) {
      await rm(temporary, { force: true })
      throw error
    }
    record.videoUrl = toFileUrl(AbsoluteFilePathSchema.parse(destination))
    record.status = 'completed'
    record.progress = 100
    record.errorCode = undefined
    await this.publishAndPersist(record)
  }

  private async requestJson(
    url: string,
    method: 'GET' | 'POST',
    body: Record<string, unknown> | undefined,
    headers: Record<string, string>,
    signal: AbortSignal
  ): Promise<unknown> {
    const response = await customFetch(url, {
      method,
      headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: requestSignal(signal),
      cache: 'no-store'
    })
    const payload = await response.json().catch(() => undefined)
    if (!response.ok) throw this.createHttpError(response.status, payload, response.headers.get('retry-after'))
    return payload
  }

  private createHttpError(status: number, payload: unknown, retryAfter: string | null): VideoApiError {
    const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
    const error = data.error && typeof data.error === 'object' ? (data.error as Record<string, unknown>) : {}
    const code = [data.fail_code, data.code, error.code].find((value) => typeof value === 'string')?.toString()
    const modelNotFound = code?.toLowerCase() === 'model_not_found'
    return new VideoApiError(
      status,
      mapVideoErrorCode({ status, fail_code: data.fail_code, code, error: data.error, message: data.message }),
      parseRetryAfter(retryAfter),
      [429, 502, 503, 504].includes(status),
      [404, 405].includes(status) && !modelNotFound
    )
  }

  private resolveProvider(modelId: string): ResolvedVideoProvider {
    const parsed = parseUniqueModelId(modelId as Model['id'])
    const model = modelService.getByKey(parsed.providerId, parsed.modelId)
    const provider = providerService.getByProviderId(parsed.providerId)
    if (!model.isEnabled || model.isHidden || !isGenerateVideoModel(model) || !provider.isEnabled) {
      throw new VideoApiError(undefined, 'MODEL_UNSUPPORTED')
    }
    if (!providerService.getApiKeys(provider.id, { enabled: true }).length) {
      throw new VideoApiError(undefined, 'INVALID_REQUEST')
    }
    const apiKey = providerService.resolveApiKey(provider.id).value
    if (!apiKey) throw new VideoApiError(undefined, 'INVALID_REQUEST')

    // Video generation uses the provider's video-specific host when configured,
    // and otherwise shares its configured API host. The request dialect is
    // resolved by this service's HeyRoute-compatible OpenAI/task fallback.
    const baseUrl = getBaseUrl(provider, ENDPOINT_TYPE.OPENAI_VIDEO_GENERATION)
    if (!baseUrl) throw new VideoApiError(undefined, 'MODEL_UNSUPPORTED')
    const modelApiId = getRawModelId(model)
    const headers = mergeHeaders(getProviderAppHeaders(provider), getExtraHeaders(provider), {
      Authorization: `Bearer ${apiKey}`,
      'X-Api-Key': apiKey
    })
    return { provider, model, modelApiId, baseUrl, headers }
  }

  private requireRecord(id: string): VideoGenerationRecord {
    const record = this.records.get(id)
    if (!record) throw new VideoApiError(undefined, 'INVALID_REQUEST')
    return record
  }

  private updateRecord(id: string, updates: Partial<VideoGenerationRecord>): VideoGenerationRecord {
    const record = this.requireRecord(id)
    Object.assign(record, updates, { updatedAt: new Date().toISOString() })
    this.publish(record)
    return record
  }

  private async publishAndPersist(record: VideoGenerationRecord): Promise<void> {
    record.updatedAt = new Date().toISOString()
    this.publish(record)
    await this.persistState()
  }

  private publish(record: VideoGenerationRecord): void {
    application.get('IpcApiService').broadcast('video.generation.updated', { ...record })
  }

  private async loadState(): Promise<void> {
    const statePath = application.getPath('feature.video_generation.jobs_file')
    let serialized: string
    try {
      serialized = await readFile(statePath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }

    try {
      const state = JSON.parse(serialized) as PersistedVideoState
      for (const item of state.records ?? []) {
        const record = VideoGenerationRecordSchema.parse(item)
        this.records.set(record.id, record)
      }
      for (const [providerId, style] of Object.entries(state.preferredApiStyles ?? {})) {
        if (style === 'openai' || style === 'task') this.preferredApiStyles.set(providerId, style)
      }
    } catch (error) {
      logger.warn('Could not read saved video generation records', { errorType: getErrorName(error) })
    }
  }

  private async persistState(): Promise<void> {
    const statePath = application.getPath('feature.video_generation.jobs_file')
    const temporaryPath = application.getPath('feature.video_generation.data', VIDEO_TEMP_FILENAME)
    const snapshot: PersistedVideoState = {
      records: [...this.records.values()],
      preferredApiStyles: Object.fromEntries(this.preferredApiStyles)
    }
    const write = this.persistQueue
      .catch(() => undefined)
      .then(async () => {
        await mkdir(path.dirname(statePath), { recursive: true })
        await writeFile(temporaryPath, JSON.stringify(snapshot), 'utf8')
        await rename(temporaryPath, statePath)
      })
    this.persistQueue = write
    await write
  }
}

function requestSignal(signal: AbortSignal): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
}

function waitForPoll(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve()
    }
    const timer = setTimeout(finish, delayMs)
    const onAbort = () => {
      finish()
    }
    signal.addEventListener('abort', onAbort, { once: true })
    timer.unref?.()
  })
}

function safeFilename(prompt: string): string {
  const invalidFilenameCharacters = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])
  const cleaned = Array.from(prompt)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint > 0x1f && !invalidFilenameCharacters.has(character)
    })
    .join('')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 64)
  return cleaned || 'video-generation'
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error
}
