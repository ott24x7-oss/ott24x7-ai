import { describe, expect, it } from 'vitest'

import { LOCAL_LLM_CATALOG, mergeOllamaTags, recommendLocalLlmModel } from '../localLlm'

describe('local LLM catalog', () => {
  it('marks small models for 8 GB systems and 7B models for 16 GB RAM or 6 GB VRAM', () => {
    expect(recommendLocalLlmModel(4, 8, null)).toBe('recommended')
    expect(recommendLocalLlmModel(4, 7.9, null)).toBeNull()
    expect(recommendLocalLlmModel(7, 16, null)).toBe('recommended')
    expect(recommendLocalLlmModel(7, 8, 6)).toBe('recommended')
    expect(recommendLocalLlmModel(7, 8, 4)).toBe('slower')
    expect(recommendLocalLlmModel(7, 8, null)).toBeNull()
  })

  it('merges installed tags into catalog entries and retains unlisted installed models', () => {
    const merged = mergeOllamaTags([
      { name: 'qwen2.5-coder:3b', size: 1_900_000_000 },
      { name: 'my-private-model:latest', size: 800_000_000 }
    ])

    expect(merged.catalog.find(({ id }) => id === 'qwen2.5-coder:3b')).toMatchObject({ installed: true })
    expect(merged.catalog.filter(({ installed }) => installed)).toHaveLength(1)
    expect(merged.other).toEqual([
      { name: 'my-private-model:latest', size: 800_000_000, category: 'other', speed: 'varies' }
    ])
    expect(LOCAL_LLM_CATALOG).toHaveLength(19)
  })
})
