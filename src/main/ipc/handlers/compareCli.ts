import { application } from '@application'
import type { compareCliRequestSchemas } from '@shared/ipc/schemas/compareCli'
import type { IpcHandlersFor } from '@shared/ipc/types'

export const compareCliHandlers: IpcHandlersFor<typeof compareCliRequestSchemas> = {
  'compare_cli.available': () => application.get('CompareCliService').available(),
  'compare_cli.run': async ({ id, requestId, prompt }, { senderId }) => {
    if (senderId == null) throw new Error('Compare CLI requires a managed window')
    await application.get('CompareCliService').run(senderId, requestId, id, prompt)
  },
  'compare_cli.cancel': async ({ requestId }, { senderId }) => {
    if (senderId != null) application.get('CompareCliService').cancel(senderId, requestId)
  }
}
