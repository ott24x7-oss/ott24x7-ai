import { describe, expect, it } from 'vitest'

import { miniAppIdForStudioTab, studioTabFromMiniAppId } from '../studioRouting'

describe('studio tab routing', () => {
  it('routes web tabs to their saved mini app sessions', () => {
    expect(miniAppIdForStudioTab('gemini')).toBe('gemini')
    expect(miniAppIdForStudioTab('flow')).toBe('google-flow')
    expect(miniAppIdForStudioTab('chatgpt-images')).toBe('chatgpt-images')
    expect(miniAppIdForStudioTab('designer')).toBe('microsoft-designer')
  })

  it('returns Generate for the default and unknown web app routes', () => {
    expect(studioTabFromMiniAppId(undefined)).toBe('generate')
    expect(studioTabFromMiniAppId('unknown-app')).toBe('generate')
  })
})
