import { describe, expect, it } from 'vitest'

import { miniAppIdFromTabUrl } from '../miniAppKeepAlive'

describe('miniAppIdFromTabUrl', () => {
  it('reads the selected Studio web tab so it participates in the shared Mini App runtime', () => {
    expect(miniAppIdFromTabUrl('/app/studio?miniApp=google-flow')).toBe('google-flow')
    expect(miniAppIdFromTabUrl('/app/studio?miniApp=gemini#section')).toBe('gemini')
  })

  it('keeps the existing Mini App route parsing and ignores Studio Generate', () => {
    expect(miniAppIdFromTabUrl('/app/mini-app/openai')).toBe('openai')
    expect(miniAppIdFromTabUrl('/app/studio')).toBeNull()
  })
})
