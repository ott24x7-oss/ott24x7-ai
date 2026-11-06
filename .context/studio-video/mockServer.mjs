import { createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '../..')
const sampleVideo = path.join(projectRoot, 'scripts/e2e/regression/fixtures/media/sample-5s.mp4')
const port = Number(process.env.VIDEO_MOCK_PORT ?? 8788)
const onlyStyle = process.env.VIDEO_MOCK_STYLE
const tasks = new Map()
let nextId = 1

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
  const pathname = url.pathname

  if (pathname === '/mock/sample.mp4' && request.method === 'GET') {
    response.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store' })
    createReadStream(sampleVideo).pipe(response)
    return
  }

  if (pathname === '/v1/models' && request.method === 'GET') {
    return sendJson(response, 200, {
      object: 'list',
      data: [{ id: 'grok-imagine-video', object: 'model', owned_by: 'studio-video-mock' }]
    })
  }

  if (pathname === '/v1/videos' && request.method === 'POST') {
    if (onlyStyle === 'task') return sendJson(response, 405, { error: { code: 'route_not_available' } })
    const body = await readJson(request)
    const task = createTask('openai', body)
    return sendJson(response, 200, { task_id: task.id, status: 'queued' })
  }

  if (pathname === '/v1/video/generations' && request.method === 'POST') {
    if (onlyStyle === 'openai') return sendJson(response, 404, { error: { code: 'route_not_available' } })
    const body = await readJson(request)
    const task = createTask('task', body)
    return sendJson(response, 200, { task_id: task.id, status: 'queued' })
  }

  const openAiMatch = pathname.match(/^\/v1\/videos\/([^/]+)$/)
  const taskMatch = pathname.match(/^\/v1\/video\/generations\/([^/]+)$/)
  const contentMatch = pathname.match(/^\/v1\/videos\/([^/]+)\/content$/)

  if (request.method === 'GET' && contentMatch) {
    const task = tasks.get(contentMatch[1])
    if (!task || task.style !== 'openai') return sendJson(response, 404, { error: { code: 'task_not_found' } })
    return sendVideo(response)
  }

  if (request.method === 'GET' && (openAiMatch || taskMatch)) {
    const match = openAiMatch ?? taskMatch
    const task = tasks.get(match[1])
    if (!task || task.style !== (openAiMatch ? 'openai' : 'task')) {
      return sendJson(response, 404, { error: { code: 'task_not_found' } })
    }
    task.pollCount += 1
    if (task.fail) {
      return sendJson(response, 200, { status: 'failed', fail_code: 'prompt_blocked' })
    }
    if (task.pollCount === 1) return sendJson(response, 200, { status: 'in_progress', progress: 0.42 })
    if (openAiMatch) return sendJson(response, 200, { status: 'completed', progress: 100 })
    return sendJson(response, 200, { status: 'succeeded', progress: 100, video_url: `http://127.0.0.1:${port}/mock/sample.mp4` })
  }

  sendJson(response, 404, { error: { code: 'not_found' } })
})

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Studio video mock listening on http://127.0.0.1:${port}/v1\n`)
  process.stdout.write(`Supported style: ${onlyStyle ?? 'openai and task'}; prompt containing [mock-fail] returns prompt_blocked.\n`)
})

server.on('close', () => process.stdout.write('Studio video mock stopped.\n'))

function createTask(style, body) {
  const id = `mock-video-${nextId++}`
  const prompt = typeof body?.prompt === 'string' ? body.prompt : ''
  const task = { id, style, prompt, pollCount: 0, fail: prompt.includes('[mock-fail]') }
  tasks.set(id, task)
  return task
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(data))
}

function sendVideo(response) {
  response.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store' })
  createReadStream(sampleVideo).pipe(response)
}
