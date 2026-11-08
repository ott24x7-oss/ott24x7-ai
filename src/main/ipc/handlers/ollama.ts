import { application } from '@application'
import type { ollamaRequestSchemas } from '@shared/ipc/schemas/ollama'
import type { IpcHandlersFor } from '@shared/ipc/types'

export const ollamaHandlers: IpcHandlersFor<typeof ollamaRequestSchemas> = {
  'ollama.get_status': () => application.get('OllamaService').getStatus(),
  'ollama.list_models': async () => ({ models: await application.get('OllamaService').listModels() }),
  'ollama.install': () => application.get('OllamaService').install(),
  'ollama.start': () => application.get('OllamaService').start(),
  'ollama.pull': ({ jobId, modelName }) => application.get('OllamaService').pullModel(jobId, modelName),
  'ollama.cancel_pull': async ({ jobId }) => application.get('OllamaService').cancelPull(jobId),
  'ollama.delete_model': ({ modelName }) => application.get('OllamaService').deleteModel(modelName)
}
