import {
  VideoApiError,
  buildVideoRequestBody,
  extractVideoUrl,
  getVideoApiPath,
  getVideoApiStyleOrder,
  getVideoApiUrl,
  mapVideoErrorCode,
  parseRetryAfter,
  parseVideoStatus,
  parseVideoSubmission,
  submitWithVideoApiFallback
} from '../videoApi'

describe('video provider request contract', () => {
  it('builds HeyRoute OpenAI-style requests with supported model controls', () => {
    expect(
      buildVideoRequestBody('openai', {
        model: 'grok-imagine-video',
        prompt: 'A red kite floating above a quiet beach',
        duration: 8,
        ratio: '16:9',
        resolution: '480p',
        generateAudio: false,
        inputReference: 'data:image/png;base64,YQ=='
      })
    ).toEqual({
      model: 'grok-imagine-video',
      prompt: 'A red kite floating above a quiet beach',
      seconds: '8',
      ratio: '16:9',
      resolution: '480p',
      generate_audio: false,
      input_reference: 'data:image/png;base64,YQ=='
    })
  })

  it('builds task-style bodies and omits options rejected by grok-video', () => {
    expect(
      buildVideoRequestBody('task', {
        model: 'grok-imagine-video',
        prompt: 'A quiet beach at dusk',
        duration: 5,
        ratio: '9:16',
        resolution: '720p',
        generateAudio: true
      })
    ).toEqual({
      model: 'grok-imagine-video',
      prompt: 'A quiet beach at dusk',
      duration: 5,
      aspect_ratio: '9:16',
      size: '720p',
      generate_audio: true
    })

    expect(
      buildVideoRequestBody('openai', {
        model: 'grok-video',
        prompt: 'A quiet beach at dusk',
        duration: 6,
        ratio: '9:16',
        resolution: '1080p',
        generateAudio: true,
        inputReference: 'data:image/png;base64,YQ=='
      })
    ).toEqual({ model: 'grok-video', prompt: 'A quiet beach at dusk', seconds: '6' })
  })

  it('uses seedance reference-image shape and provider-relative API paths', () => {
    expect(
      buildVideoRequestBody('openai', {
        model: 'seedance-2.5',
        prompt: 'A paper boat moving downstream',
        duration: 15,
        generateAudio: true,
        inputReference: 'data:image/png;base64,YQ=='
      })
    ).toMatchObject({ images: [{ url: 'data:image/png;base64,YQ==', role: 'reference_image' }] })
    expect(getVideoApiPath('openai')).toBe('/videos')
    expect(getVideoApiPath('task')).toBe('/video/generations')
    expect(getVideoApiUrl('http://127.0.0.1:8787/v1/', '/videos')).toBe('http://127.0.0.1:8787/v1/videos')
  })
})

describe('video provider response contract', () => {
  it('parses task IDs and queued, in-progress, completed and failed states', () => {
    expect(parseVideoSubmission({ task_id: 'job-1', status: 'queued' })).toEqual({
      taskId: 'job-1',
      status: { status: 'queued' }
    })
    expect(parseVideoSubmission({ id: 'job-2', status: 'running', progress: 0.35 })).toEqual({
      taskId: 'job-2',
      status: { status: 'in_progress', progress: 35 }
    })
    expect(parseVideoStatus({ status: 'succeeded', progress: 100 })).toEqual({ status: 'completed', progress: 100 })
    expect(parseVideoStatus({ status: 'failed', fail_code: 'prompt_blocked' })).toEqual({
      status: 'failed',
      errorCode: 'CONTENT_POLICY'
    })
    expect(parseVideoSubmission({ status: 'queued' })).toBeUndefined()
  })

  it('extracts a signed result URL from every documented task response shape', () => {
    expect(extractVideoUrl({ url: 'https://cdn.example/video.mp4' })).toBe('https://cdn.example/video.mp4')
    expect(extractVideoUrl({ video_url: 'https://cdn.example/video.mp4' })).toBe('https://cdn.example/video.mp4')
    expect(extractVideoUrl({ data: [{ url: 'https://cdn.example/video.mp4' }] })).toBe('https://cdn.example/video.mp4')
    expect(extractVideoUrl({ output: { url: 'https://cdn.example/video.mp4' } })).toBe('https://cdn.example/video.mp4')
    expect(extractVideoUrl({ output: 'https://cdn.example/video.mp4' })).toBe('https://cdn.example/video.mp4')
    expect(extractVideoUrl({ output: 'not a URL' })).toBeUndefined()
  })

  it('tries OpenAI style first, falls back only for an unavailable route, and remembers preference order', async () => {
    expect(getVideoApiStyleOrder()).toEqual(['openai', 'task'])
    expect(getVideoApiStyleOrder('task')).toEqual(['task', 'openai'])
    const calls: string[] = []
    const result = await submitWithVideoApiFallback(undefined, async (style) => {
      calls.push(style)
      if (style === 'openai') throw new VideoApiError(405, 'INVALID_REQUEST', undefined, false, true)
      return 'accepted'
    })
    expect(calls).toEqual(['openai', 'task'])
    expect(result).toEqual({ style: 'task', result: 'accepted' })

    await expect(
      submitWithVideoApiFallback('openai', async () => {
        throw new VideoApiError(404, 'MODEL_UNSUPPORTED')
      })
    ).rejects.toBeInstanceOf(VideoApiError)
  })

  it('honors Retry-After and maps HTTP and provider failure codes without exposing provider text', () => {
    expect(parseRetryAfter('2')).toBe(2000)
    expect(parseRetryAfter(null)).toBeUndefined()
    expect(mapVideoErrorCode({ fail_code: 'prompt_blocked' })).toBe('CONTENT_POLICY')
    expect(mapVideoErrorCode({ status: 402 })).toBe('NO_CREDITS')
    expect(mapVideoErrorCode({ status: 404, code: 'model_not_found' })).toBe('MODEL_UNSUPPORTED')
    expect(mapVideoErrorCode({ fail_code: 'service_timeout' })).toBe('TIMEOUT')
    expect(mapVideoErrorCode({ fail_code: 'service_overloaded' })).toBe('SERVICE_UNAVAILABLE')
    expect(mapVideoErrorCode({ fail_code: 'invalid_request' })).toBe('INVALID_REQUEST')
    expect(mapVideoErrorCode({ message: 'unrecognized upstream response' })).toBe('GENERATION_FAILED')
  })
})
