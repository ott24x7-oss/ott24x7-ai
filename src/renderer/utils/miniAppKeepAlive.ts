export const DEFAULT_MAX_KEEP_ALIVE_MINI_APPS = 10

export const MINI_APP_ROUTE_PREFIX = '/app/mini-app/'

export function miniAppIdFromTabUrl(url: string | undefined): string | null {
  if (!url) return null
  if (url.startsWith(MINI_APP_ROUTE_PREFIX)) {
    const id = url.slice(MINI_APP_ROUTE_PREFIX.length).split(/[/?#]/, 1)[0]
    return id || null
  }
  if (url.startsWith('/app/studio')) {
    const queryStart = url.indexOf('?')
    if (queryStart === -1) return null
    return new URLSearchParams(url.slice(queryStart + 1).split('#', 1)[0]).get('miniApp')
  }
  return null
}

export function miniAppResourceKey(appId: string): string {
  return `miniapp:${appId}`
}

export function miniAppIdFromResourceKey(key: string): string {
  return key.slice('miniapp:'.length)
}
