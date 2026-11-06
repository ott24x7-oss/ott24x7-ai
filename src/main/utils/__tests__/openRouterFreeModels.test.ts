import { describe, expect, it, vi } from 'vitest'

import {
  cleanOpenRouterModelName,
  fetchOpenRouterFreeModels,
  getOpenRouterStarterModelIds,
  OPENROUTER_KEY_URL,
  parseOpenRouterFreeModels,
  verifyOpenRouterKey
} from '../openRouterFreeModels'

describe('OpenRouter free models', () => {
  it('keeps only zero-priced text models and cleans duplicate names', () => {
    const models = parseOpenRouterFreeModels({
      data: [
        {
          id: 'model/free',
          name: 'Free Model (free)',
          context_length: 128000,
          pricing: { prompt: '0', completion: 0 },
          architecture: { output_modalities: ['text'] }
        },
        {
          id: 'model/paid',
          name: 'Paid',
          pricing: { prompt: '0.000001', completion: '0' },
          architecture: { output_modalities: ['text'] }
        },
        {
          id: 'model/image',
          name: 'Image only',
          pricing: { prompt: 0, completion: 0 },
          architecture: { output_modalities: ['image'] }
        },
        {
          id: 'model/free',
          name: 'Duplicate',
          pricing: { prompt: 0, completion: 0 }
        },
        {
          id: 'model/legacy',
          name: 'Legacy (FREE)',
          pricing: { prompt: '0.0', completion: '0.000' }
        }
      ]
    })

    expect(models).toEqual([
      { id: 'model/free', name: 'Free Model', contextLength: 128000 },
      { id: 'model/legacy', name: 'Legacy', contextLength: 0 }
    ])
  })

  it('sorts starter models by largest context and returns at most four ids', () => {
    const models = [
      { id: 'small', name: 'Small', contextLength: 8 },
      { id: 'large', name: 'Large', contextLength: 100 },
      { id: 'middle', name: 'Middle', contextLength: 50 },
      { id: 'largest', name: 'Largest', contextLength: 200 },
      { id: 'other', name: 'Other', contextLength: 5 }
    ]

    expect(getOpenRouterStarterModelIds(models)).toEqual(['largest', 'large', 'middle', 'small'])
  })

  it('strips only a trailing free label', () => {
    expect(cleanOpenRouterModelName('A Model (free)')).toBe('A Model')
    expect(cleanOpenRouterModelName('A (free) Model')).toBe('A (free) Model')
  })

  it('reports a 401 as an invalid key without returning or logging the key', async () => {
    const apiKey = 'sk-or-test-secret'
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 401 }))

    const result = await verifyOpenRouterKey(apiKey, fetcher)

    expect(fetcher).toHaveBeenCalledWith(
      OPENROUTER_KEY_URL,
      expect.objectContaining({ headers: { Authorization: `Bearer ${apiKey}` } })
    )
    expect(result).toEqual({ ok: false, reason: 'invalid-key' })
    expect(JSON.stringify(result)).not.toContain(apiKey)
  })

  it('does not expose a transport error that contains a key', async () => {
    const apiKey = 'sk-or-test-secret'
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error(`failed for ${apiKey}`))

    const result = await verifyOpenRouterKey(apiKey, fetcher)

    expect(result).toEqual({ ok: false, reason: 'unavailable' })
    expect(JSON.stringify(result)).not.toContain(apiKey)
  })

  it('returns filtered models from the public models endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'free', pricing: { prompt: 0, completion: 0 } }] }))
    )

    await expect(fetchOpenRouterFreeModels(fetcher)).resolves.toEqual({
      ok: true,
      models: [{ id: 'free', name: 'free', contextLength: 0 }]
    })
  })
})
