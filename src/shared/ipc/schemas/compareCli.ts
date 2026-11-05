import * as z from 'zod'

import type { CompareCliAvailability, CompareCliId } from '@shared/types/compareCli'

import { defineRoute } from '../define'

export const CompareCliIdSchema = z.enum(['claude', 'agy', 'codex'])

export const compareCliRequestSchemas = {
  'compare_cli.available': defineRoute({
    input: z.object({}),
    output: z.array(z.object({ id: CompareCliIdSchema, available: z.boolean() }))
  }),
  'compare_cli.run': defineRoute({
    input: z.object({
      id: CompareCliIdSchema,
      requestId: z.string().min(1).max(100),
      prompt: z.string().min(1).max(100_000)
    }),
    output: z.void()
  }),
  'compare_cli.cancel': defineRoute({ input: z.object({ requestId: z.string().min(1).max(100) }), output: z.void() })
}

export type CompareCliRequestSchemas = typeof compareCliRequestSchemas
export type CompareCliRunInput = { id: CompareCliId; requestId: string; prompt: string }
export type CompareCliErrorCode = 'launch' | 'failed' | 'timeout'
export type CompareCliStreamEvent =
  | { requestId: string; cliId: CompareCliId; type: 'delta'; text: string }
  | { requestId: string; cliId: CompareCliId; type: 'done' }
  | { requestId: string; cliId: CompareCliId; type: 'error'; code: CompareCliErrorCode }
  | { requestId: string; cliId: CompareCliId; type: 'cancelled' }

export type CompareFocusShortcutEvent = { key: string; ctrlKey: boolean }
export type CompareCliEventSchemas = {
  'compare_cli.stream': CompareCliStreamEvent
  'compare.focus_shortcut': CompareFocusShortcutEvent
}
export type CompareCliAvailabilityResponse = CompareCliAvailability[]
