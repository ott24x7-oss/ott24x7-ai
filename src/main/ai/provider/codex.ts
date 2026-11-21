/**
 * Request shaping for the OpenAI Codex provider (ChatGPT backend codex
 * responses endpoint). Kept in its own module — free of the electron/app import
 * graph in `config.ts` — so the body/header coercion can be unit-tested
 * directly.
 */

const CODEX_REASONING_INCLUDE = 'reasoning.encrypted_content'

export interface CodexCredentials {
  accessToken: string
  accountId: string | null
}

/**
 * Rewrite a parsed OpenAI Responses payload (mutated in place and returned) into
 * the shape the ChatGPT codex backend requires: server-side `store` is rejected,
 * response length caps are not accepted, and encrypted reasoning must round-trip.
 */
export function coerceCodexRequestJson(json: Record<string, any>): Record<string, any> {
  json.store = false
  delete json.max_output_tokens
  const include = new Set<string>(Array.isArray(json.include) ? json.include : [])
  include.add(CODEX_REASONING_INCLUDE)
  json.include = [...include]
  return json
}

/**
 * Coerce a serialized Responses body via {@link coerceCodexRequestJson}.
 * Non-JSON bodies pass through untouched.
 */
export function coerceCodexRequestBody(body: BodyInit | null | undefined): BodyInit | null | undefined {
  if (typeof body !== 'string') return body
  try {
    return JSON.stringify(coerceCodexRequestJson(JSON.parse(body)))
  } catch {
    return body
  }
}

/**
 * Build the request headers for a codex call: the OAuth bearer token plus the
 * ChatGPT account id and the codex-specific beta/originator markers, layered
 * over whatever the SDK already set.
 */
export function buildCodexRequestHeaders(base: HeadersInit | undefined, creds: CodexCredentials): Headers {
  const headers = new Headers(base)
  headers.set('Authorization', `Bearer ${creds.accessToken}`)
  if (creds.accountId) headers.set('chatgpt-account-id', creds.accountId)
  headers.set('OpenAI-Beta', 'responses=experimental')
  headers.set('originator', 'cherry-studio')
  return headers
}

/**
 * The ChatGPT codex backend rejects non-streaming calls ("Stream must be set to
 * true"). One-shot callers (`generateText`: Combine, titles, translation) send
 * `stream: false` or omit it. Returns true when the body is such a call, so the
 * fetch wrapper can force streaming and fold the SSE reply back into JSON.
 */
export function isNonStreamingCodexBody(body: BodyInit | null | undefined): boolean {
  if (typeof body !== 'string') return false
  try {
    const json = JSON.parse(body)
    return Boolean(json) && typeof json === 'object' && json.stream !== true
  } catch {
    return false
  }
}

/** Set `stream: true` on a serialized Responses body. Non-JSON bodies pass through. */
export function forceCodexStreamingBody(body: BodyInit | null | undefined): BodyInit | null | undefined {
  if (typeof body !== 'string') return body
  try {
    const json = JSON.parse(body)
    json.stream = true
    return JSON.stringify(json)
  } catch {
    return body
  }
}

/**
 * Fold a Responses SSE stream into the JSON body a non-streaming call returns.
 * Uses the terminal `response.completed` event; when the backend leaves its
 * `output` empty, the items from `response.output_item.done` fill it in.
 * Returns null when the stream has no terminal response.
 */
export function collectCodexSseResponse(sse: string): { ok: boolean; body: Record<string, any> } | null {
  const items: Array<{ index: number; item: unknown }> = []
  let terminal: { ok: boolean; body: Record<string, any> } | null = null
  for (const block of sse.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (!data || data === '[DONE]') continue
    let event: Record<string, any>
    try {
      event = JSON.parse(data)
    } catch {
      continue
    }
    if (event.type === 'response.output_item.done' && event.item) {
      items.push({ index: typeof event.output_index === 'number' ? event.output_index : items.length, item: event.item })
    } else if ((event.type === 'response.completed' || event.type === 'response.done') && event.response) {
      terminal = { ok: true, body: event.response }
    } else if ((event.type === 'response.failed' || event.type === 'response.incomplete') && event.response) {
      terminal =
        event.type === 'response.incomplete'
          ? { ok: true, body: event.response }
          : { ok: false, body: { error: event.response.error ?? { message: 'Codex response failed' } } }
    } else if (event.type === 'error') {
      terminal = { ok: false, body: { error: event.error ?? { message: event.message ?? 'Codex error' } } }
    }
  }
  if (terminal?.ok && (!Array.isArray(terminal.body.output) || terminal.body.output.length === 0) && items.length) {
    terminal.body.output = items.sort((a, b) => a.index - b.index).map((entry) => entry.item)
  }
  return terminal
}

/** Turn a streamed codex reply into the JSON response a non-streaming caller expects. */
export async function toNonStreamingCodexResponse(response: Response): Promise<Response> {
  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || !type.includes('text/event-stream')) return response
  const collected = collectCodexSseResponse(await response.text())
  const body = collected ?? { error: { message: 'Response stream ended without a result.' } }
  const status = collected?.ok ? 200 : 502
  return new Response(JSON.stringify(collected ? collected.body : body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}
