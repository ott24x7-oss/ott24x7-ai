import * as z from 'zod'

import type { VideoGenerationRecord } from '@shared/types/videoGeneration'
import { VideoGenerationRecordSchema } from '@shared/types/videoGeneration'

import { defineRoute } from '../define'

export const videoGenerationRequestSchemas = {
  'video.generation.list': defineRoute({ input: z.void(), output: z.array(VideoGenerationRecordSchema) }),
  'video.generation.create': defineRoute({
    input: z.object({
      modelId: z.string().min(1),
      prompt: z.string().trim().min(1).max(8000),
      duration: z.number().int().positive().max(60),
      ratio: z.string().optional(),
      resolution: z.enum(['480p', '720p', '1080p']).optional(),
      generateAudio: z.boolean(),
      inputReference: z.string().max(20_000_000).optional()
    }),
    output: VideoGenerationRecordSchema
  }),
  'video.generation.cancel': defineRoute({ input: z.object({ id: z.string().uuid() }), output: z.void() }),
  'video.generation.delete': defineRoute({ input: z.object({ id: z.string().uuid() }), output: z.void() }),
  'video.generation.save': defineRoute({ input: z.object({ id: z.string().uuid() }), output: z.boolean() })
}

export type VideoGenerationEventSchemas = {
  'video.generation.updated': VideoGenerationRecord
}
