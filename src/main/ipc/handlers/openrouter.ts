import { providerService } from '@data/services/ProviderService'
import { fetchOpenRouterFreeModels, verifyOpenRouterKey } from '@main/utils/openRouterFreeModels'
import type { openrouterRequestSchemas } from '@shared/ipc/schemas/openrouter'
import type { IpcHandlersFor } from '@shared/ipc/types'

export const openrouterHandlers: IpcHandlersFor<typeof openrouterRequestSchemas> = {
  'openrouter.free_models.has_key': async () => providerService.getApiKeys('openrouter').length > 0,
  'openrouter.free_models.verify_key': async ({ apiKey }) => verifyOpenRouterKey(apiKey),
  'openrouter.free_models.list': async () => fetchOpenRouterFreeModels()
}
