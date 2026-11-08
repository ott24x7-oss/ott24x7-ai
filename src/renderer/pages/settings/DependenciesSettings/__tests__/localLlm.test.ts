import { describe, expect, it, vi } from 'vitest'

import { syncInstalledOllamaModels } from '../localLlm'

describe('syncInstalledOllamaModels', () => {
  it('creates the preset provider, adds only new Ollama tags, and enables it without asking for a key', async () => {
    const ensureProvider = vi.fn().mockResolvedValue({ id: 'ollama', isEnabled: false })
    const addModels = vi.fn().mockResolvedValue(undefined)
    const enableProvider = vi.fn().mockResolvedValue(undefined)

    await syncInstalledOllamaModels(
      [{ name: 'qwen2.5-coder:3b' }, { name: 'qwen2.5-coder:7b' }],
      new Set(['qwen2.5-coder:3b']),
      undefined,
      ensureProvider,
      addModels,
      enableProvider
    )

    expect(ensureProvider).toHaveBeenCalledOnce()
    expect(addModels).toHaveBeenCalledWith([
      expect.objectContaining({
        providerId: 'ollama',
        modelId: 'qwen2.5-coder:7b',
        endpointTypes: ['ollama-chat'],
        supportsStreaming: true
      })
    ])
    expect(enableProvider).toHaveBeenCalledWith('ollama')
  })

  it('keeps an enabled provider and existing models unchanged', async () => {
    const ensureProvider = vi.fn()
    const addModels = vi.fn()
    const enableProvider = vi.fn()

    await syncInstalledOllamaModels(
      [{ name: 'qwen3:4b' }],
      new Set(['qwen3:4b']),
      { id: 'ollama', isEnabled: true },
      ensureProvider,
      addModels,
      enableProvider
    )

    expect(ensureProvider).not.toHaveBeenCalled()
    expect(addModels).not.toHaveBeenCalled()
    expect(enableProvider).not.toHaveBeenCalled()
  })
})
