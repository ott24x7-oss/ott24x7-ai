import * as z from 'zod'

import { MEMORY_CONTENT_LIMIT } from '../../../utils/memory'
import { MemoryIdSchema, MemorySchema, type Memory } from '../../types/memory'

const MemoryContentSchema = z.string().trim().min(1).max(MEMORY_CONTENT_LIMIT)

export const CreateMemorySchema = MemorySchema.pick({
  content: true,
  sourceTopicId: true,
  sourceMessageId: true
}).extend({
  content: MemoryContentSchema
})
export type CreateMemoryDto = z.infer<typeof CreateMemorySchema>
export const UpdateMemorySchema = z
  .strictObject({ content: MemoryContentSchema.optional() })
  .refine((value) => value.content !== undefined, 'content is required')
export type UpdateMemoryDto = z.infer<typeof UpdateMemorySchema>

export type MemorySchemas = {
  '/memories': {
    GET: { response: Memory[] }
    POST: { body: CreateMemoryDto; response: Memory }
    DELETE: { response: void }
  }
  '/memories/:id': {
    PATCH: { params: { id: string }; body: UpdateMemoryDto; response: Memory }
    DELETE: { params: { id: string }; response: void }
  }
}

export { MemoryIdSchema }
