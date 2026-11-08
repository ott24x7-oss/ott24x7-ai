import * as z from 'zod'

import { defineRoute } from '../define'

const modelName = z.string().trim().min(1).max(200)

export const ollamaRequestSchemas = {
  'ollama.get_status': defineRoute({
    input: z.void(),
    output: z.object({
      state: z.enum(['running', 'stopped', 'not-installed']),
      version: z.string().nullable(),
      device: z.object({
        totalMemoryBytes: z.number(),
        gpu: z.object({ name: z.string(), vramBytes: z.number() }).nullable()
      })
    })
  }),
  'ollama.list_models': defineRoute({
    input: z.void(),
    output: z.object({ models: z.array(z.object({ name: z.string(), size: z.number().optional() })) })
  }),
  'ollama.install': defineRoute({ input: z.void(), output: z.void() }),
  'ollama.start': defineRoute({ input: z.void(), output: z.void() }),
  'ollama.pull': defineRoute({
    input: z.object({ jobId: z.string().min(1), modelName }),
    output: z.object({ cancelled: z.boolean() })
  }),
  'ollama.cancel_pull': defineRoute({
    input: z.object({ jobId: z.string().min(1) }),
    output: z.object({ cancelled: z.boolean() })
  }),
  'ollama.delete_model': defineRoute({ input: z.object({ modelName }), output: z.void() })
}

export type OllamaEventSchemas = {
  'ollama.progress': {
    jobId: string
    operation: 'model-pull' | 'installer'
    modelName?: string
    status: string
    percent: number | null
  }
}
