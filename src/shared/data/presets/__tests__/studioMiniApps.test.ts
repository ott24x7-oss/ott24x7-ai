import { describe, expect, it } from 'vitest'

import { PRESETS_MINI_APPS } from '../miniApps'

describe('Studio Mini App presets', () => {
  it('provides the web destinations used by Studio and the built-in app list', () => {
    const byId = new Map(PRESETS_MINI_APPS.map((preset) => [preset.id, preset]))
    expect(byId.get('google-flow')?.url).toBe('https://labs.google/fx/tools/flow')
    expect(byId.get('chatgpt-images')?.url).toBe('https://chatgpt.com/images')
    expect(byId.get('microsoft-copilot')?.url).toBe('https://copilot.microsoft.com/')
    expect(byId.get('microsoft-designer')?.url).toBe('https://designer.microsoft.com/')
    expect(byId.get('meta-ai')?.url).toBe('https://www.meta.ai/')
    expect(byId.get('moonshot')?.url).toBe('https://www.kimi.com/')
    expect(byId.get('qwenlm')?.url).toBe('https://chat.qwen.ai')
    expect(byId.get('aistudio')?.url).toBe('https://aistudio.google.com/')
    expect(byId.get('notebooklm')?.url).toBe('https://notebooklm.google.com/')
  })
})
