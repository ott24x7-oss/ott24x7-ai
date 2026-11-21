import { describe, expect, it } from 'vitest'

import {
  buildCodexRequestHeaders,
  coerceCodexRequestBody,
  collectCodexSseResponse,
  forceCodexStreamingBody,
  isNonStreamingCodexBody,
  toNonStreamingCodexResponse
} from '../codex'

describe('coerceCodexRequestBody', () => {
  it('forces store:false and adds encrypted reasoning to include', () => {
    const out = coerceCodexRequestBody(JSON.stringify({ model: 'gpt-5.5', store: true }))
    const json = JSON.parse(out as string)
    expect(json.store).toBe(false)
    expect(json.include).toEqual(['reasoning.encrypted_content'])
  })

  it('drops max_output_tokens because the codex backend rejects it', () => {
    const out = coerceCodexRequestBody(JSON.stringify({ model: 'gpt-5.5', max_output_tokens: 32000 }))
    const json = JSON.parse(out as string)
    expect(json).not.toHaveProperty('max_output_tokens')
  })

  it('preserves existing include entries without duplicating', () => {
    const out = coerceCodexRequestBody(
      JSON.stringify({ include: ['file_search_call.results', 'reasoning.encrypted_content'] })
    )
    const json = JSON.parse(out as string)
    expect(json.include).toEqual(['file_search_call.results', 'reasoning.encrypted_content'])
  })

  it('passes through non-string and non-JSON bodies untouched', () => {
    expect(coerceCodexRequestBody(undefined)).toBeUndefined()
    expect(coerceCodexRequestBody('not json')).toBe('not json')
  })
})

describe('buildCodexRequestHeaders', () => {
  it('sets the bearer token, account id and codex markers', () => {
    const headers = buildCodexRequestHeaders(
      { 'content-type': 'application/json' },
      { accessToken: 'tok', accountId: 'acct-1' }
    )
    expect(headers.get('Authorization')).toBe('Bearer tok')
    expect(headers.get('chatgpt-account-id')).toBe('acct-1')
    expect(headers.get('OpenAI-Beta')).toBe('responses=experimental')
    expect(headers.get('originator')).toBe('cherry-studio')
    expect(headers.get('content-type')).toBe('application/json')
  })

  it('omits the account id header when none is known', () => {
    const headers = buildCodexRequestHeaders(undefined, { accessToken: 'tok', accountId: null })
    expect(headers.has('chatgpt-account-id')).toBe(false)
  })
})

const sse = (...events: object[]) => events.map((event) => `event: x
data: ${JSON.stringify(event)}

`).join('')

describe('codex one-shot requests', () => {
  it('detects non-streaming bodies and forces streaming', () => {
    expect(isNonStreamingCodexBody(JSON.stringify({ model: 'm' }))).toBe(true)
    expect(isNonStreamingCodexBody(JSON.stringify({ model: 'm', stream: false }))).toBe(true)
    expect(isNonStreamingCodexBody(JSON.stringify({ model: 'm', stream: true }))).toBe(false)
    expect(isNonStreamingCodexBody(undefined)).toBe(false)
    expect(isNonStreamingCodexBody('not json')).toBe(false)
    expect(JSON.parse(forceCodexStreamingBody(JSON.stringify({ model: 'm' })) as string).stream).toBe(true)
  })

  it('folds the SSE stream into the completed response, filling empty output', () => {
    const message = { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Final' }] }
    const out = collectCodexSseResponse(
      sse(
        { type: 'response.created', response: { id: 'r1' } },
        { type: 'response.output_text.delta', delta: 'Fi' },
        { type: 'response.output_item.done', output_index: 0, item: message },
        { type: 'response.completed', response: { id: 'r1', status: 'completed', output: [] } }
      )
    )
    expect(out).toEqual({ ok: true, body: { id: 'r1', status: 'completed', output: [message] } })
  })

  it('reports failed responses as errors', () => {
    const out = collectCodexSseResponse(
      sse({ type: 'response.failed', response: { error: { code: 'model_not_found', message: 'nope' } } })
    )
    expect(out).toEqual({ ok: false, body: { error: { code: 'model_not_found', message: 'nope' } } })
    expect(collectCodexSseResponse('')).toBeNull()
  })

  it('returns a JSON response for an event stream and passes other responses through', async () => {
    const streamed = new Response(sse({ type: 'response.completed', response: { id: 'r2', output: [{ a: 1 }] } }), {
      headers: { 'content-type': 'text/event-stream' }
    })
    const converted = await toNonStreamingCodexResponse(streamed)
    expect(converted.status).toBe(200)
    expect(await converted.json()).toEqual({ id: 'r2', output: [{ a: 1 }] })

    const plain = new Response('{"error":{}}', { status: 400, headers: { 'content-type': 'application/json' } })
    expect(await toNonStreamingCodexResponse(plain)).toBe(plain)
  })
})
