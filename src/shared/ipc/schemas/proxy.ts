import * as z from 'zod'

import { defineRoute } from '../define'

const proxyConnectionTestResultSchema = z.object({
  target: z.string(),
  route: z.enum(['proxy', 'bypassed', 'direct', 'fallback']),
  success: z.boolean(),
  latencyMs: z.number().nonnegative().optional(),
  country: z.string().optional(),
  error: z
    .enum(['invalid_config', 'authentication_required', 'timeout', 'unreachable', 'http_error', 'connection_failed'])
    .optional()
})

const siteProxyRuleDraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  domains: z.array(z.string()),
  proxyUrl: z.string(),
  password: z.string()
})

export const proxyRequestSchemas = {
  'proxy.test_connection': defineRoute({
    input: z.object({
      mode: z.enum(['system', 'custom', 'none']),
      url: z.string(),
      bypassRules: z.string()
    }),
    output: proxyConnectionTestResultSchema
  }),
  'proxy.get_site_rules': defineRoute({
    input: z.void(),
    output: z.array(siteProxyRuleDraftSchema)
  }),
  'proxy.save_site_rules': defineRoute({
    input: z.array(siteProxyRuleDraftSchema),
    output: z.void()
  }),
  'proxy.test_site_rule': defineRoute({
    input: siteProxyRuleDraftSchema,
    output: proxyConnectionTestResultSchema
  })
}
