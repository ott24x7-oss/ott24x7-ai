import assert from 'node:assert/strict'
import { test } from 'node:test'
import worker, { isAllowedPath, upstreamRequestHeaders } from '../src/index.js'

void test('only API paths are forwarded', () => {
  assert.equal(isAllowedPath('/v1/chat/completions'), true)
  assert.equal(isAllowedPath('/v1beta/models'), true)
  assert.equal(isAllowedPath('/admin'), false)
  assert.equal(isAllowedPath('/v10/x'), false)
})

void test('client auth is forwarded but Cloudflare and hop headers are not', () => {
  const h = upstreamRequestHeaders(new Headers({ authorization: 'Bearer x', 'cf-connecting-ip': '1.2.3.4', host: 'api.ott24x7.com', 'content-type': 'application/json' }))
  assert.equal(h.get('authorization'), 'Bearer x')
  assert.equal(h.get('content-type'), 'application/json')
  assert.equal(h.get('cf-connecting-ip'), null)
  assert.equal(h.get('host'), null)
})

void test('forwards method, path, query and body, and rewrites self redirects', async () => {
  const seen = []
  globalThis.fetch = async (url, init) => {
    seen.push({ url, method: init.method, body: init.body ? await new Response(init.body).text() : null })
    return new Response('ok', { status: 302, headers: { location: 'https://heyroute.ai/v1/videos/t1/content?sig=a', 'set-cookie': 'a=b' } })
  }
  const res = await worker.fetch(new Request('https://api.ott24x7.com/v1/videos?x=1', { method: 'POST', body: '{"model":"m"}' }))
  assert.deepEqual(seen[0], { url: 'https://heyroute.ai/v1/videos?x=1', method: 'POST', body: '{"model":"m"}' })
  assert.equal(res.headers.get('location'), 'https://api.ott24x7.com/v1/videos/t1/content?sig=a')
  assert.equal(res.headers.get('set-cookie'), null)
})

void test('unknown paths are rejected without calling upstream', async () => {
  globalThis.fetch = async () => assert.fail('should not call upstream')
  const res = await worker.fetch(new Request('https://api.ott24x7.com/console'))
  assert.equal(res.status, 404)
})

void test('download links redirect to the signed GitHub asset found through the API', async () => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).endsWith('/releases/tags/v1.1.0')) {
      return Response.json({ assets: [{ name: 'OTT24x7-AI-Setup.exe', url: 'https://api.github.com/assets/9' }] })
    }
    return new Response(null, { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/x?sig=1' } })
  }
  const res = await worker.fetch(new Request('https://api.ott24x7.com/download/OTT24x7-AI-Setup.exe'))
  assert.equal(res.status, 302)
  assert.equal(res.headers.get('location'), 'https://release-assets.githubusercontent.com/x?sig=1')
  assert.ok(calls.every((url) => !url.includes('github.com/ott24x7-oss/ott24x7-ai/releases/download')))
})

void test('update manifest is served from our domain', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/releases/tags/v1.1.0')) {
      return Response.json({ assets: [{ name: 'desktop-version.json', url: 'https://api.github.com/assets/7' }] })
    }
    assert.equal(String(url), 'https://api.github.com/assets/7')
    return new Response('{"latestBuild":7}')
  }
  const res = await worker.fetch(new Request('https://api.ott24x7.com/update/desktop-version.json'))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { latestBuild: 7 })
})

void test('download falls back to the GitHub link when the API is unavailable', async () => {
  globalThis.fetch = async () => new Response('down', { status: 503 })
  const res = await worker.fetch(new Request('https://api.ott24x7.com/download/OTT24x7-AI.apk'))
  assert.equal(res.headers.get('location'), 'https://github.com/ott24x7-oss/ott24x7-ai/releases/latest/download/OTT24x7-AI.apk')
})

void test('only known release files are served', async () => {
  globalThis.fetch = async () => assert.fail('should not fetch')
  assert.equal((await worker.fetch(new Request('https://api.ott24x7.com/download/secret.txt'))).status, 404)
})

void test('update manifest comes from KV without calling GitHub', async () => {
  globalThis.fetch = async () => assert.fail('should not call GitHub')
  const env = { UPDATES: { get: async (key) => (key === 'version.json' ? '{"latestVersionCode":5}' : null) } }
  const res = await worker.fetch(new Request('https://api.ott24x7.com/update/version.json'), env)
  assert.deepEqual(await res.json(), { latestVersionCode: 5 })
})
