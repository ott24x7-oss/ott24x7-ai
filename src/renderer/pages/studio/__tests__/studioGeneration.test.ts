import { describe, expect, it } from 'vitest'

import {
  getStudioGenerationStatusIndex,
  getStudioRevealMotion,
  getStudioTemplatePrompt,
  STUDIO_GENERATION_STATUS_KEYS
} from '../studioGeneration'

describe('Studio generation presentation contracts', () => {
  it('rotates generation status text every four seconds', () => {
    expect(STUDIO_GENERATION_STATUS_KEYS.map((_, index) => getStudioGenerationStatusIndex(index * 4000))).toEqual([
      0, 1, 2, 3
    ])
    expect(getStudioGenerationStatusIndex(16_000)).toBe(0)
  })

  it('removes reveal motion when reduced motion is requested', () => {
    expect(getStudioRevealMotion(2, true)).toEqual({ initial: false, transition: { duration: 0 } })
  })

  it('fills each requested inspiration chip with a starter prompt', () => {
    for (const template of ['poster', 'logo', 'product', 'thumbnail', 'anime', 'render', 'wallpaper', 'sticker']) {
      expect(getStudioTemplatePrompt(template, (key) => key)).toContain(template)
    }
    expect(getStudioTemplatePrompt('unknown', (key) => key)).toBe('')
  })
})
