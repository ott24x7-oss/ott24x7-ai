import type { CompareCliId } from '@shared/types/compareCli'

export interface CliParserState {
  buffer: string
  sawDelta: boolean
  emittedItems: Set<string>
}

export function createCliParserState(): CliParserState {
  return { buffer: '', sawDelta: false, emittedItems: new Set() }
}

export function buildCompareCliArgs(cliId: CompareCliId, prompt: string, cwd: string): string[] {
  switch (cliId) {
    case 'claude':
      return [
        '-p',
        prompt,
        '--output-format',
        'stream-json',
        '--verbose',
        '--include-partial-messages',
        '--tools',
        '',
        '--no-session-persistence'
      ]
    case 'agy':
      return ['-p', prompt, '--output-format', 'stream-json', '--mode', 'plan', '--sandbox', '--disable-slash-commands']
    case 'codex':
      return [
        '--ignore-user-config',
        '--sandbox',
        'read-only',
        '--ephemeral',
        '--disable',
        'apps',
        '--disable',
        'browser_use',
        '--disable',
        'browser_use_external',
        '--disable',
        'browser_use_full_cdp_access',
        '--disable',
        'code_mode',
        '--disable',
        'code_mode_host',
        '--disable',
        'computer_use',
        '--disable',
        'image_generation',
        '--disable',
        'multi_agent',
        '--disable',
        'plugins',
        '--disable',
        'shell_tool',
        '--disable',
        'sleep_tool',
        '--disable',
        'unified_exec',
        '--disable',
        'view_image',
        '--disable',
        'web_search_request',
        'exec',
        prompt,
        '--json',
        '-C',
        cwd,
        '--config',
        'include_apply_patch_tool=false'
      ]
  }
}

export function extractCliText(cliId: CompareCliId, rawLine: string, state: CliParserState): string[] {
  let event: any
  try {
    event = JSON.parse(rawLine)
  } catch {
    // The CLI output mode is NDJSON. Ignore any non-JSON startup or diagnostic text.
    return []
  }

  if (cliId === 'claude') return extractClaudeText(event, state)
  if (cliId === 'agy') return extractAgyText(event, state)
  return extractCodexText(event, state)
}

export function pushCliOutput(cliId: CompareCliId, chunk: string, state: CliParserState): string[] {
  state.buffer += chunk
  const lines = state.buffer.split(/\r?\n/)
  state.buffer = lines.pop() ?? ''
  return lines.flatMap((line) => (line.trim() ? extractCliText(cliId, line, state) : []))
}

export function flushCliOutput(cliId: CompareCliId, state: CliParserState): string[] {
  const last = state.buffer.trim()
  state.buffer = ''
  return last ? extractCliText(cliId, last, state) : []
}

function extractClaudeText(event: any, state: CliParserState): string[] {
  const delta = event?.event?.delta?.text ?? event?.delta?.text
  if (event?.type === 'stream_event' && event?.event?.type === 'content_block_delta' && typeof delta === 'string') {
    state.sawDelta = true
    return [delta]
  }
  if (!state.sawDelta && event?.type === 'result' && typeof event.result === 'string') return [event.result]
  if (!state.sawDelta && event?.type === 'assistant') return collectText(event.message?.content)
  return []
}

function extractAgyText(event: any, state: CliParserState): string[] {
  const delta = event?.delta?.text ?? event?.text_delta ?? event?.content_block?.text
  if (typeof delta === 'string' && ['text_delta', 'content_block_delta', 'assistant.delta'].includes(event?.type)) {
    state.sawDelta = true
    return [delta]
  }
  if (!state.sawDelta && ['assistant', 'message', 'content_block'].includes(event?.type)) {
    const content = collectText(event.message?.content ?? event.content)
    if (content.length) return content
  }
  if (!state.sawDelta && ['result', 'turn.completed'].includes(event?.type)) {
    const result = event.result ?? event.last_assistant_message ?? event.response
    return typeof result === 'string' ? [result] : collectText(result?.content)
  }
  return []
}

function extractCodexText(event: any, state: CliParserState): string[] {
  const itemId = event?.item_id ?? event?.item?.id ?? 'agent_message'
  if (event?.type === 'item.delta' && typeof event.delta === 'string') {
    state.sawDelta = true
    state.emittedItems.add(itemId)
    return [event.delta]
  }
  if (event?.type === 'item.completed') {
    const item = event.item
    if (item?.type === 'agent_message' && typeof item.text === 'string' && !state.emittedItems.has(item.id ?? itemId)) {
      state.emittedItems.add(item.id ?? itemId)
      return [item.text]
    }
  }
  if (!state.sawDelta && event?.type === 'turn.completed' && typeof event.last_assistant_message === 'string') {
    return [event.last_assistant_message]
  }
  return []
}

function collectText(content: unknown): string[] {
  if (typeof content === 'string') return [content]
  if (!Array.isArray(content)) return []
  return content.flatMap((item) => {
    if (typeof item === 'string') return [item]
    if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') return [item.text]
    return []
  })
}
