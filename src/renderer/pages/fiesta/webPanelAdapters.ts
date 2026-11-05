import type { WebviewTag } from 'electron'

import type { CompareDeliveryStatus } from '@renderer/types/compare'

export interface WebPanelAdapter {
  appIds: readonly string[]
  inputSelectors: readonly string[]
  sendSelectors: readonly string[]
  readySelectors: readonly string[]
  lastAnswerSelector?: string
  stopSelector?: string
  enterToSend: boolean
}

export const WEB_PANEL_ADAPTERS: readonly WebPanelAdapter[] = [
  {
    appIds: ['chatgpt', 'openai'],
    inputSelectors: [
      '#prompt-textarea',
      '[data-testid="prompt-textarea"]',
      'div[contenteditable="true"][data-lexical-editor="true"]'
    ],
    sendSelectors: ['[data-testid="send-button"]', 'button[aria-label*="Send prompt"]'],
    readySelectors: [
      '#prompt-textarea',
      '[data-testid="prompt-textarea"]',
      'div[contenteditable="true"][data-lexical-editor="true"]'
    ],
    lastAnswerSelector: '[data-message-author-role="assistant"]',
    stopSelector: 'button[data-testid="stop-button"]',
    enterToSend: true
  },
  {
    appIds: ['claude', 'anthropic'],
    inputSelectors: ['.ProseMirror[contenteditable="true"]', '[contenteditable="true"][data-placeholder]'],
    sendSelectors: ['button[aria-label*="Send message"]', 'button[data-testid*="send"]'],
    readySelectors: ['.ProseMirror[contenteditable="true"]', '[contenteditable="true"][data-placeholder]'],
    lastAnswerSelector: '[data-testid="chat-message"] .font-claude-response',
    stopSelector: 'button[aria-label*="Stop"]',
    enterToSend: true
  },
  {
    appIds: ['gemini'],
    inputSelectors: [
      '.ql-editor[contenteditable="true"]',
      'rich-textarea [contenteditable="true"]',
      'rich-textarea .ql-editor',
      'textarea'
    ],
    sendSelectors: ['button[aria-label*="Send message"]', 'button[aria-label*="Send"]'],
    readySelectors: ['.ql-editor[contenteditable="true"]', 'rich-textarea'],
    lastAnswerSelector: 'model-response',
    stopSelector: 'button[aria-label*="Stop"]',
    enterToSend: true
  },
  {
    appIds: ['deepseek'],
    inputSelectors: ['textarea#chat-input', 'textarea[placeholder*="Message"]', 'textarea'],
    sendSelectors: ['button[aria-label*="Send"]', 'button[data-testid*="send"]'],
    readySelectors: ['textarea#chat-input', 'textarea[placeholder*="Message"]', 'textarea'],
    lastAnswerSelector: '.ds-markdown',
    stopSelector: 'button[aria-label*="Stop"]',
    enterToSend: true
  },
  {
    appIds: ['grok', 'grok-x'],
    inputSelectors: ['textarea[aria-label*="Ask"]', 'textarea[placeholder*="Ask"]', '[contenteditable="true"]'],
    sendSelectors: ['button[aria-label*="Submit"]', 'button[aria-label*="Send"]'],
    readySelectors: ['textarea[aria-label*="Ask"]', 'textarea[placeholder*="Ask"]', '[contenteditable="true"]'],
    lastAnswerSelector: '[data-testid="conversation-turn"] [data-message-author-role="assistant"]',
    stopSelector: 'button[aria-label*="Stop"]',
    enterToSend: true
  },
  {
    appIds: ['copilot', 'bing', 'github-copilot'],
    inputSelectors: ['textarea[aria-label*="Message"]', '#userInput', '[contenteditable="true"]'],
    sendSelectors: ['button[aria-label*="Send"]', 'button[data-testid*="send"]'],
    readySelectors: ['#userInput', 'textarea[aria-label*="Message"]', '[contenteditable="true"]'],
    lastAnswerSelector: 'cib-message-group[source="bot"]',
    stopSelector: 'button[aria-label*="Stop"]',
    enterToSend: true
  },
  {
    appIds: ['perplexity'],
    inputSelectors: ['textarea[placeholder*="Ask"]', 'textarea[aria-label*="Ask"]', '[contenteditable="true"]'],
    sendSelectors: ['button[aria-label*="Submit"]', 'button[aria-label*="Send"]'],
    readySelectors: ['textarea[placeholder*="Ask"]', 'textarea[aria-label*="Ask"]', '[contenteditable="true"]'],
    lastAnswerSelector: '[data-testid="answer"]',
    stopSelector: 'button[aria-label*="Stop"]',
    enterToSend: true
  }
]

const genericAdapter: WebPanelAdapter = {
  appIds: [],
  inputSelectors: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
  sendSelectors: ['button[type="submit"]', 'button[aria-label*="Send"]', 'button[aria-label*="Submit"]'],
  readySelectors: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
  enterToSend: true
}

export function getWebPanelAdapter(appId: string): WebPanelAdapter {
  return WEB_PANEL_ADAPTERS.find((adapter) => adapter.appIds.includes(appId.toLowerCase())) ?? genericAdapter
}

export interface WebSendResult {
  appId: string
  status: WebPanelSendStatus
}

export type WebPanelSendStatus = 'sent' | 'login-needed' | 'input-not-found' | 'failed'

interface InjectionResult {
  status: Exclude<WebPanelSendStatus, 'failed'>
  clicked?: boolean
}

export function mapWebPanelSendStatus(status: WebPanelSendStatus): CompareDeliveryStatus {
  if (status === 'sent') return 'sent'
  if (status === 'login-needed') return 'login-needed'
  return 'copied'
}

export async function sendPromptToWebPanel(
  webview: Pick<WebviewTag, 'focus' | 'executeJavaScript' | 'sendInputEvent'>,
  appId: string,
  prompt: string
): Promise<WebPanelSendStatus> {
  const adapter = getWebPanelAdapter(appId)
  const result = (await webview.executeJavaScript(buildInsertPromptScript(adapter, prompt), true)) as InjectionResult
  if (result?.status !== 'sent') return result?.status ?? 'input-not-found'
  if (result.clicked) return 'sent'
  if (!adapter.enterToSend) return 'input-not-found'

  webview.focus()
  await webview.sendInputEvent({ type: 'keyDown', keyCode: 'ENTER' })
  await webview.sendInputEvent({ type: 'keyUp', keyCode: 'ENTER' })
  return 'sent'
}

export async function sendPromptToWebPanels(
  targets: readonly { appId: string; webview: Pick<WebviewTag, 'focus' | 'executeJavaScript' | 'sendInputEvent'> }[],
  prompt: string,
  copyPrompt: (prompt: string) => Promise<void>
): Promise<WebSendResult[]> {
  const results = await Promise.all(
    targets.map(async ({ appId, webview }): Promise<WebSendResult> => {
      try {
        return { appId, status: await sendPromptToWebPanel(webview, appId, prompt) }
      } catch {
        return { appId, status: 'failed' }
      }
    })
  )
  if (results.some((result) => result.status !== 'sent')) await copyPrompt(prompt)
  return results
}

export interface WebAnswerSnapshot {
  text: string
  generating: boolean
}

export async function readVisibleLastAnswer(
  webview: Pick<WebviewTag, 'executeJavaScript'>,
  appId: string
): Promise<string> {
  const adapter = getWebPanelAdapter(appId)
  if (!adapter.lastAnswerSelector) return ''
  const text = await webview.executeJavaScript(buildReadLastAnswerScript(adapter), true)
  return typeof text === 'string' ? text.trim() : ''
}

export async function readVisibleLastAnswerState(
  webview: Pick<WebviewTag, 'executeJavaScript'>,
  appId: string
): Promise<WebAnswerSnapshot> {
  const adapter = getWebPanelAdapter(appId)
  if (!adapter.lastAnswerSelector) return { text: '', generating: false }
  const value = await webview.executeJavaScript(buildReadLastAnswerStateScript(adapter), true)
  if (!value || typeof value !== 'object') return { text: '', generating: false }
  const snapshot = value as WebAnswerSnapshot
  return {
    text: typeof snapshot.text === 'string' ? snapshot.text.trim() : '',
    generating: Boolean(snapshot.generating)
  }
}

export async function waitForVisibleLastAnswer(
  webview: Pick<WebviewTag, 'executeJavaScript'>,
  appId: string,
  previousText: string,
  onText: (text: string) => void,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<string | null> {
  const startedAt = Date.now()
  let lastText = previousText
  let stableSince = 0
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000

  while (!options.signal?.aborted && Date.now() - startedAt < timeoutMs) {
    const snapshot = await readVisibleLastAnswerState(webview, appId)
    if (options.signal?.aborted) return null
    const hasNewAnswer = snapshot.text.length > 0 && snapshot.text !== previousText

    if (hasNewAnswer) {
      if (snapshot.text !== lastText) {
        lastText = snapshot.text
        stableSince = Date.now()
        onText(snapshot.text)
      } else if (Date.now() - stableSince >= 3_000) {
        return snapshot.text
      }

      if (!snapshot.generating) return snapshot.text
    }

    await new Promise<void>((resolve) => {
      const signal = options.signal
      const done = () => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }
      const timer = setTimeout(done, 500)
      const onAbort = () => {
        clearTimeout(timer)
        done()
      }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  return null
}

export function buildReadLastAnswerScript(adapter: WebPanelAdapter): string {
  if (!adapter.lastAnswerSelector) return '(() => "")()'
  const selector = JSON.stringify(adapter.lastAnswerSelector)

  return `(() => {
    const answer = Array.from(document.querySelectorAll(${selector})).at(-1);
    return answer instanceof HTMLElement ? answer.innerText.trim() : "";
  })()`
}

export function buildReadLastAnswerStateScript(adapter: WebPanelAdapter): string {
  if (!adapter.lastAnswerSelector) return '(() => ({ text: "", generating: false }))()'
  const answerSelector = JSON.stringify(adapter.lastAnswerSelector)
  const stopSelector = JSON.stringify(adapter.stopSelector ?? '')

  return `(() => {
    const answer = Array.from(document.querySelectorAll(${answerSelector})).at(-1);
    const stop = ${stopSelector} ? document.querySelector(${stopSelector}) : null;
    return {
      text: answer instanceof HTMLElement ? answer.innerText.trim() : "",
      generating: stop instanceof HTMLElement && !stop.hidden && stop.getAttribute("aria-disabled") !== "true" && !("disabled" in stop && stop.disabled)
    };
  })()`
}

export function buildInsertPromptScript(adapter: WebPanelAdapter, prompt: string): string {
  const inputSelectors = JSON.stringify([...adapter.inputSelectors, ...genericAdapter.inputSelectors])
  const sendSelectors = JSON.stringify([...adapter.sendSelectors, ...genericAdapter.sendSelectors])
  const readySelectors = JSON.stringify([...adapter.readySelectors, ...genericAdapter.readySelectors])
  const safePrompt = JSON.stringify(prompt)

  return `(() => {
    const inputSelectors = ${inputSelectors};
    const sendSelectors = ${sendSelectors};
    const readySelectors = ${readySelectors};
    const prompt = ${safePrompt};
    const queryDeep = (root, selector) => {
      const direct = root.querySelector(selector);
      if (direct) return direct;
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot) {
          const nested = queryDeep(element.shadowRoot, selector);
          if (nested) return nested;
        }
      }
      return null;
    };
    const loginPage = /(?:^|\\/)(?:login|log-in|signin|sign-in|auth)(?:\\/|$)/i.test(location.pathname) ||
      Boolean(document.querySelector('input[type="password"], input[autocomplete="current-password"]'));
    if (!readySelectors.some((selector) => queryDeep(document, selector))) {
      return { status: loginPage ? "login-needed" : "input-not-found" };
    }
    let input = null;
    for (const selector of inputSelectors) {
      input = queryDeep(document, selector);
      if (input) break;
    }
    if (!input || !(input instanceof HTMLElement)) return { status: loginPage ? "login-needed" : "input-not-found" };
    input.focus();
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      setter?.call(input, prompt);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(input);
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand('insertText', false, prompt);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    }
    let button = null;
    for (const selector of sendSelectors) {
      button = queryDeep(document, selector);
      if (button) break;
    }
    if (button instanceof HTMLButtonElement && !button.disabled) {
      button.click();
      return { status: "sent", clicked: true };
    }
    return { status: "sent", clicked: false };
  })()`
}
