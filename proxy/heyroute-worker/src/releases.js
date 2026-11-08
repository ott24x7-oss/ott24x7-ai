// Serves app update manifests and installers from our own domain, reading the GitHub release
// through the GitHub API (github.com/.../releases/download can be down while the API works).
export const REPO = 'ott24x7-oss/ott24x7-ai'
export const RELEASE_TAG = 'v1.1.0'
export const UPDATE_FILES = { 'desktop-version.json': true, 'version.json': true }
export const DOWNLOAD_FILES = { 'OTT24x7-AI-Setup.exe': true, 'OTT24x7-AI.apk': true }
const GITHUB_HEADERS = { 'user-agent': 'ott24x7-api-proxy', accept: 'application/vnd.github+json' }
const RELEASE_TTL = 300
const MANIFEST_TTL = 60
const REDIRECT_TTL = 120

export function releaseRoute(pathname) {
  const update = pathname.match(/^\/update\/([^/]+)$/)
  if (update && UPDATE_FILES[update[1]]) return { kind: 'update', name: update[1] }
  const download = pathname.match(/^\/download\/([^/]+)$/)
  if (download && DOWNLOAD_FILES[download[1]]) return { kind: 'download', name: download[1] }
  return null
}

function fallbackUrl(name) {
  return `https://github.com/${REPO}/releases/latest/download/${name}`
}

async function cached(key, ttl, load) {
  const cache = globalThis.caches?.default
  const cacheKey = new Request(`https://cache.ott24x7.internal/${key}`)
  const hit = cache && (await cache.match(cacheKey))
  if (hit) return hit.text()
  const value = await load()
  if (cache && value != null) {
    await cache.put(cacheKey, new Response(value, { headers: { 'cache-control': `max-age=${ttl}` } }))
  }
  return value
}

async function assetApiUrl(name) {
  const release = await cached(`release-${RELEASE_TAG}`, RELEASE_TTL, async () => {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${RELEASE_TAG}`, { headers: GITHUB_HEADERS })
    return res.ok ? res.text() : null
  })
  if (!release) return null
  const asset = JSON.parse(release).assets?.find((entry) => entry.name === name)
  return asset?.url ?? null
}

async function signedDownloadUrl(name) {
  return cached(`download-${name}`, REDIRECT_TTL, async () => {
    const api = await assetApiUrl(name)
    if (!api) return null
    const res = await fetch(api, { headers: { ...GITHUB_HEADERS, accept: 'application/octet-stream' }, redirect: 'manual' })
    return res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
  })
}

export async function handleRelease(route, env = {}) {
  try {
    if (route.kind === 'download') {
      const location = (await signedDownloadUrl(route.name)) || fallbackUrl(route.name)
      return new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store' } })
    }
    // Release scripts write each manifest to KV, so update checks never depend on GitHub.
    const stored = await env.UPDATES?.get(route.name)
    if (stored) {
      return new Response(stored, {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${MANIFEST_TTL}` }
      })
    }
    let failure = 'no asset'
    const body = await cached(`manifest-${route.name}`, MANIFEST_TTL, async () => {
      const api = await assetApiUrl(route.name)
      if (!api) return null
      // Small assets may be served inline instead of redirected, so let fetch follow either way.
      const res = await fetch(api, { headers: { ...GITHUB_HEADERS, accept: 'application/octet-stream' } })
      failure = `asset ${res.status}`
      return res.ok ? res.text() : null
    })
    if (body == null) return Response.json({ error: 'update manifest unavailable', detail: failure }, { status: 502 })
    return new Response(body, {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${MANIFEST_TTL}` }
    })
  } catch {
    return Response.json({ error: 'update service unavailable' }, { status: 502 })
  }
}
