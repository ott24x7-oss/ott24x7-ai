import { application } from '@application'
import type { videoGenerationRequestSchemas } from '@shared/ipc/schemas/videoGeneration'
import type { IpcHandlersFor } from '@shared/ipc/types'

export const videoGenerationHandlers: IpcHandlersFor<typeof videoGenerationRequestSchemas> = {
  'video.generation.list': async () => application.get('VideoGenerationService').list(),
  'video.generation.create': async (input) => application.get('VideoGenerationService').create(input),
  'video.generation.cancel': async ({ id }) => application.get('VideoGenerationService').cancel(id),
  'video.generation.delete': async ({ id }) => application.get('VideoGenerationService').delete(id),
  'video.generation.save': async ({ id }) => application.get('VideoGenerationService').save(id)
}
