import { memoryService } from '@data/services/MemoryService'
import { CreateMemorySchema, type MemorySchemas, UpdateMemorySchema } from '@shared/data/api/schemas/memories'
import type { HandlersFor } from '@shared/data/api/types'

export const memoryHandlers: HandlersFor<MemorySchemas> = {
  '/memories': {
    GET: async () => memoryService.list(),
    POST: async ({ body }) => memoryService.create(CreateMemorySchema.parse(body)),
    DELETE: async () => memoryService.forgetAll()
  },
  '/memories/:id': {
    PATCH: async ({ params, body }) => memoryService.update(params.id, UpdateMemorySchema.parse(body)),
    DELETE: async ({ params }) => memoryService.delete(params.id)
  }
}
