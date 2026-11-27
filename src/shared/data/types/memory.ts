import * as z from 'zod'

export const MemoryIdSchema = z.uuidv4()
export const MemorySchema = z.strictObject({
  id: MemoryIdSchema,
  content: z.string().min(1),
  sourceTopicId: z.string().nullable(),
  sourceMessageId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
})
export type Memory = z.infer<typeof MemorySchema>
