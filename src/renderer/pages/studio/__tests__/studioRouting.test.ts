import { describe, expect, it } from 'vitest'

import { miniAppIdForStudioTab, studioTabFromMiniAppId } from '../studioRouting'

describe('Studio tab routing', () => {
  it('keeps Video in Studio search state without treating it as a Mini App', () => {
    expect(studioTabFromMiniAppId(undefined, 'video')).toBe('video')
    expect(miniAppIdForStudioTab('video')).toBeUndefined()
  })

  it('continues to route Generate and saved Mini Apps', () => {
    expect(studioTabFromMiniAppId(undefined)).toBe('generate')
    expect(studioTabFromMiniAppId('google-flow')).toBe('flow')
    expect(miniAppIdForStudioTab('flow')).toBe('google-flow')
  })
})
