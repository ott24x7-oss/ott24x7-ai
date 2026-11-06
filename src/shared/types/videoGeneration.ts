import * as z from 'zod'

export const VIDEO_GENERATION_STATUSES = ['queued', 'in_progress', 'completed', 'failed', 'cancelled'] as const
export const VIDEO_GENERATION_ERROR_CODES = [
  'NO_CREDITS',
  'MODEL_UNSUPPORTED',
  'CONTENT_POLICY',
  'TIMEOUT',
  'SERVICE_UNAVAILABLE',
  'INVALID_REQUEST',
  'GENERATION_FAILED'
] as const

export const VideoGenerationRecordSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  modelId: z.string(),
  modelName: z.string(),
  prompt: z.string(),
  duration: z.number().int().positive(),
  ratio: z.string(),
  resolution: z.enum(['480p', '720p', '1080p']).optional(),
  generateAudio: z.boolean(),
  status: z.enum(VIDEO_GENERATION_STATUSES),
  progress: z.number().min(0).max(100).optional(),
  videoUrl: z.string().optional(),
  taskId: z.string().optional(),
  apiStyle: z.enum(['openai', 'task']).optional(),
  errorCode: z.enum(VIDEO_GENERATION_ERROR_CODES).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.number()
})

export type VideoGenerationStatus = (typeof VIDEO_GENERATION_STATUSES)[number]
export type VideoGenerationErrorCode = (typeof VIDEO_GENERATION_ERROR_CODES)[number]
export type VideoApiStyle = 'openai' | 'task'
export type VideoGenerationRecord = z.infer<typeof VideoGenerationRecordSchema>

export interface CreateVideoGenerationInput {
  modelId: string
  prompt: string
  duration: number
  ratio?: string
  resolution?: '480p' | '720p' | '1080p'
  generateAudio: boolean
  inputReference?: string
}
