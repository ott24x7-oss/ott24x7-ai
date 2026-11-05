import { application } from '@application'
import type { proxyRequestSchemas } from '@shared/ipc/schemas/proxy'
import type { IpcHandlersFor } from '@shared/ipc/types'

export const proxyHandlers: IpcHandlersFor<typeof proxyRequestSchemas> = {
  'proxy.test_connection': async (request) => application.get('ProxyService').testConnection(request),
  'proxy.get_site_rules': async () => application.get('ProxyService').getSiteProxyRules(),
  'proxy.save_site_rules': async (request) => application.get('ProxyService').saveSiteProxyRules(request),
  'proxy.test_site_rule': async (request) => application.get('ProxyService').testSiteProxyRule(request)
}
