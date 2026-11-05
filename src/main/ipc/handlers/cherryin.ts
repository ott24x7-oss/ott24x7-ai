import type { cherryinRequestSchemas } from '@shared/ipc/schemas/cherryin'
import type { IpcHandlersFor } from '@shared/ipc/types'

function cherryInDisabled(): never {
  throw new Error('CherryIN integration is disabled in this build.')
}

export const cherryinHandlers: IpcHandlersFor<typeof cherryinRequestSchemas> = {
  'cherryin.sign_in': async () => cherryInDisabled(),
  'cherryin.get_balance': async () => cherryInDisabled(),
  'cherryin.logout': async () => cherryInDisabled()
}
