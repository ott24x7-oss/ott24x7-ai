import type { cherryCloudRequestSchemas } from '@shared/ipc/schemas/cherryCloud'
import type { IpcHandlersFor } from '@shared/ipc/types'

const disabled = async () => {
  throw new Error('Cloud account features are disabled in this build.')
}

export const cherryCloudHandlers: IpcHandlersFor<typeof cherryCloudRequestSchemas> = {
  'cherry_cloud.status.get': disabled,
  'cherry_cloud.api_origin.get': disabled,
  'cherry_cloud.login.start': disabled,
  'cherry_cloud.login.cancel': disabled,
  'cherry_cloud.session.revoke': disabled,
  'cherry_cloud.models.sync': disabled,
  'cherry_cloud.account_plans.get': disabled
}
