import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { detectOllamaState, OllamaClient } from '../ollamaClient'
import { OllamaPullManager } from '../OllamaPullManager'

let server: Server | undefined

async function startMockOllama(
  handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
): Promise<{ client: OllamaClient }> {
  server = createServer((request, response) => void handler(request, response))
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  return { client: new OllamaClient(`http://127.0.0.1:${address.port}`) }
}

afterEach(async () => {
  if (!server?.listening) return
  server.closeAllConnections()
  await new Promise<void>((resolve) => server!.close(() => resolve()))
})

describe('OllamaClient', () => {
  it('detects the mock Ollama server as running and distinguishes an installed stopped server', async () => {
    let running = true
    const { client } = await startMockOllama((_request, response) => {
      response.writeHead(running ? 200 : 503, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(running ? { version: '0.16.1' } : { error: 'stopped' }))
    })

    await expect(detectOllamaState(client, async () => null)).resolves.toEqual({ state: 'running', version: '0.16.1' })

    running = false
    await expect(detectOllamaState(client, async () => ({ serverPath: 'C:\\Ollama\\ollama.exe' }))).resolves.toEqual({
      state: 'stopped',
      version: null
    })
    await expect(detectOllamaState(client, async () => null)).resolves.toEqual({
      state: 'not-installed',
      version: null
    })
  })

  it('parses streamed pull progress and sends Ollama the selected model name', async () => {
    let requestBody = ''
    const { client } = await startMockOllama(async (request, response) => {
      for await (const chunk of request) requestBody += chunk.toString()
      response.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
      response.end(
        '{"status":"pulling model","completed":1,"total":4}\n{"status":"pulling model","completed":4,"total":4}\n{"status":"success"}\n'
      )
    })
    const progress: Array<{ status: string; percent: number | null }> = []

    await client.pull('qwen2.5-coder:0.5b', new AbortController().signal, (next) => progress.push(next))

    expect(JSON.parse(requestBody)).toEqual({ name: 'qwen2.5-coder:0.5b', stream: true })
    expect(progress.map(({ percent }) => percent)).toEqual([25, 100, 100])
  })

  it('cancels an active streamed pull when the user cancels its job', async () => {
    let requestStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => (requestStarted = resolve))
    const { client } = await startMockOllama((request, response) => {
      if (request.url !== '/api/pull') {
        response.writeHead(404).end()
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
      response.write('{"status":"pulling model"}\n')
      requestStarted?.()
      const timer = setInterval(() => response.write('{"status":"pulling model"}\n'), 25)
      response.on('close', () => clearInterval(timer))
    })
    const manager = new OllamaPullManager(client, vi.fn())
    const pulling = manager.pull('job-1', 'qwen3:4b')

    await started
    expect(manager.cancel('job-1')).toBe(true)
    await expect(pulling).resolves.toEqual({ cancelled: true })
    expect(manager.cancel('job-1')).toBe(false)
  })

  it('surfaces Ollama errors from failed pull requests and streamed pull responses', async () => {
    let pullRequests = 0
    const { client } = await startMockOllama((request, response) => {
      if (request.method === 'POST') {
        pullRequests += 1
        if (pullRequests === 1) {
          response.writeHead(500, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ error: 'model unavailable' }))
          return
        }
        response.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        response.end('{"error":"pull failed"}\n')
        return
      }
      response.writeHead(404).end()
    })

    await expect(client.pull('missing:model', new AbortController().signal, vi.fn())).rejects.toThrow(
      'model unavailable'
    )
    await expect(client.pull('missing:model', new AbortController().signal, vi.fn())).rejects.toThrow('pull failed')
  })

  it('deletes an installed model through the Ollama delete endpoint', async () => {
    let requestBody = ''
    const { client } = await startMockOllama(async (request, response) => {
      for await (const chunk of request) requestBody += chunk.toString()
      response.writeHead(200)
      response.end()
    })

    await client.delete('qwen2.5-coder:0.5b')

    expect(requestBody).toBe('{"name":"qwen2.5-coder:0.5b"}')
  })

  it('lists models returned by the Ollama tags API', async () => {
    const { client } = await startMockOllama((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ models: [{ name: 'qwen3:4b', size: 1024 }, { model: 'private:latest' }] }))
    })

    await expect(client.getTags()).resolves.toEqual([{ name: 'qwen3:4b', size: 1024 }, { name: 'private:latest' }])
  })
})
