import * as z from 'zod'

import { defineRoute } from '../define'

const FreeModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  contextLength: z.number().int().nonnegative()
})

export const openrouterRequestSchemas = {
  'openrouter.free_models.has_key': defineRoute({ input: z.void(), output: z.boolean() }),
  'openrouter.free_models.verify_key': defineRoute({
    input: z.strictObject({ apiKey: z.string().trim().min(1).max(500) }),
    output: z.discriminatedUnion('ok', [
      z.object({ ok: z.literal(true) }),
      z.object({ ok: z.literal(false), reason: z.enum(['invalid-key', 'unavailable']) })
    ])
  }),
  'openrouter.free_models.list': defineRoute({
    input: z.void(),
    output: z.discriminatedUnion('ok', [
      z.object({ ok: z.literal(true), models: z.array(FreeModelSchema) }),
      z.object({ ok: z.literal(false), reason: z.literal('unavailable') })
    ])
  })
}
