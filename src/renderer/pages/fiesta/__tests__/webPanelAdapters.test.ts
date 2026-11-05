import { describe, expect, it, vi } from 'vitest'

import {
  getWebPanelAdapter,
  buildReadLastAnswerScript,
  readVisibleLastAnswer,
  sendPromptToWebPanels,
  sendPromptToWebPanel,
  WEB_PANEL_ADAPTERS
} from '../webPanelAdapters'

describe('web panel send adapters', () => {
  it('defines provider-specific inputs, send controls, and ready selectors', () => {
    expect(WEB_PANEL_ADAPTERS.map((adapter) => adapter.appIds[0])).toEqual([
      'chatgpt',
      'claude',
      'gemini',
      'deepseek',
      'grok',
      'copilot',
      'perplexity'
    ])
    for (const adapter of WEB_PANEL_ADAPTERS) {
      expect(adapter.inputSelectors.length).toBeGreaterThan(0)
      expect(adapter.sendSelectors.length).toBeGreaterThan(0)
      expect(adapter.readySelectors.length).toBeGreaterThan(0)
      expect(adapter.lastAnswerSelector).toBeTruthy()
    }
    expect(getWebPanelAdapter('openai')).toBe(getWebPanelAdapter('chatgpt'))
    expect(getWebPanelAdapter('grok-x')).toBe(getWebPanelAdapter('grok'))
    expect(getWebPanelAdapter('github-copilot')).toBe(getWebPanelAdapter('copilot'))
    expect(getWebPanelAdapter('user-custom-site').inputSelectors).toContain('textarea')
  })

  it('inserts prompt text with a user initiated send key when no send button is available', async () => {
    const webview = {
      focus: vi.fn(),
      executeJavaScript: vi.fn().mockResolvedValue({ inserted: true, clicked: false }),
      sendInputEvent: vi.fn()
    }
    const sent = await sendPromptToWebPanel(webview, 'gemini', 'Summarize this')

    expect(sent).toBe(true)
    expect(webview.executeJavaScript).toHaveBeenCalledWith(expect.stringContaining('Summarize this'), true)
    expect(webview.focus).toHaveBeenCalledOnce()
    expect(webview.sendInputEvent).toHaveBeenCalledTimes(2)
  })

  it('reads only the configured last assistant answer from a visible webview', async () => {
    const webview = { executeJavaScript: vi.fn().mockResolvedValue('Latest answer') }

    await expect(readVisibleLastAnswer(webview, 'chatgpt')).resolves.toBe('Latest answer')
    const script = String(webview.executeJavaScript.mock.calls[0][0])
    expect(script).toContain('data-message-author-role')
    expect(script).toContain('assistant')
    expect(script).toContain('.at(-1)')
    expect(script).not.toContain('document.body.innerText')
    expect(buildReadLastAnswerScript(getWebPanelAdapter('user-custom-site'))).toContain('""')
  })

  it('copies the prompt once when any visible web panel cannot accept it', async () => {
    const ok = {
      focus: vi.fn(),
      executeJavaScript: vi.fn().mockResolvedValue({ inserted: true, clicked: true }),
      sendInputEvent: vi.fn()
    }
    const failed = {
      focus: vi.fn(),
      executeJavaScript: vi.fn().mockResolvedValue({ inserted: false, clicked: false }),
      sendInputEvent: vi.fn()
    }
    const copyPrompt = vi.fn().mockResolvedValue(undefined)

    const results = await sendPromptToWebPanels(
      [
        { appId: 'openai', webview: ok },
        { appId: 'gemini', webview: failed }
      ],
      'Try this prompt',
      copyPrompt
    )

    expect(results).toEqual([
      { appId: 'openai', sent: true },
      { appId: 'gemini', sent: false }
    ])
    expect(copyPrompt).toHaveBeenCalledOnce()
    expect(copyPrompt).toHaveBeenCalledWith('Try this prompt')
  })
})
