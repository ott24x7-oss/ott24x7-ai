// Reverse proxy: https://api.ott24x7.com/v1/... -> https://heyroute.ai/v1/...
// Streams bodies both ways (SSE chat, video downloads). Never logs headers or bodies.
import { handleRelease, releaseRoute } from './releases.js'

const UPSTREAM = 'https://heyroute.ai'
const ALLOWED_PREFIXES = ['/v1/', '/v1beta/']
const HOP_HEADERS = ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'te', 'trailer']

export function isAllowedPath(pathname) {
  return ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || pathname === '/v1'
}

export function upstreamRequestHeaders(incoming) {
  const headers = new Headers()
  for (const [name, value] of incoming) {
    const lower = name.toLowerCase()
    if (HOP_HEADERS.includes(lower) || lower.startsWith('cf-') || lower === 'x-forwarded-for' || lower === 'x-real-ip') continue
    headers.set(name, value)
  }
  return headers
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/' || url.pathname === '/health') {
      return Response.json({ ok: true, service: 'OTT24x7 AI API' })
    }
    const release = request.method === 'GET' || request.method === 'HEAD' ? releaseRoute(url.pathname) : null
    if (release) return handleRelease(release, env)
    if (!isAllowedPath(url.pathname)) {
      return Response.json({ error: { message: 'Not found', type: 'invalid_request_error' } }, { status: 404 })
    }

    const target = UPSTREAM + url.pathname + url.search
    const init = {
      method: request.method,
      headers: upstreamRequestHeaders(request.headers),
      redirect: 'manual'
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body
    }

    const upstream = await fetch(target, init)
    const headers = new Headers(upstream.headers)
    headers.delete('set-cookie')
    // Keep downloads on our domain when upstream redirects back to itself.
    const location = headers.get('location')
    if (location && location.startsWith(UPSTREAM)) headers.set('location', url.origin + location.slice(UPSTREAM.length))
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
  }
}
