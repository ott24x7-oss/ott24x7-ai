export const OTT_DESKTOP_BUILD = 9
export const DESKTOP_UPDATE_MANIFEST_URL = 'https://api.ott24x7.com/update/desktop-version.json'
export const DESKTOP_UPDATE_FALLBACK_MANIFEST_URL =
  'https://github.com/ott24x7-oss/ott24x7-ai/releases/latest/download/desktop-version.json'
export const DESKTOP_UPDATE_INSTALLER_URL = 'https://api.ott24x7.com/download/OTT24x7-AI-Setup.exe'

const ALLOWED_INSTALLER_HOSTS = new Set([
  'api.ott24x7.com',
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com'
])

export function getDesktopUpdateManifestUrls(overrideUrl?: string): string[] {
  return [...new Set([overrideUrl?.trim() || DESKTOP_UPDATE_MANIFEST_URL, DESKTOP_UPDATE_FALLBACK_MANIFEST_URL])]
}

export async function fetchDesktopUpdateManifest(
  fetcher: typeof fetch,
  overrideUrl?: string
): Promise<DesktopUpdateManifest | null> {
  for (const url of getDesktopUpdateManifestUrls(overrideUrl)) {
    try {
      const response = await fetcher(url, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(8_000)
      })
      if (!response.ok) continue
      const manifest = parseDesktopUpdateManifest(await response.text())
      if (manifest) return manifest
    } catch {
      // Try the next manifest source.
    }
  }
  return null
}

export function getDesktopInstallerUrls(manifestUrl: string): string[] {
  return [...new Set([DESKTOP_UPDATE_INSTALLER_URL, manifestUrl])]
}

export interface DesktopUpdateManifest {
  latestBuild: number
  minBuild: number
  version: string
  url: string
  notes: string
}

export type DesktopUpdateDecision = 'NONE' | 'OPTIONAL' | 'FORCED'

export function isAllowedDesktopInstallerUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      ALLOWED_INSTALLER_HOSTS.has(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port
    )
  } catch {
    return false
  }
}

export function parseDesktopUpdateManifest(input: unknown): DesktopUpdateManifest | null {
  let value = input
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input)
    } catch {
      return null
    }
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const manifest = value as Record<string, unknown>
  const { latestBuild, minBuild, version, url, notes } = manifest

  if (
    typeof latestBuild !== 'number' ||
    !Number.isSafeInteger(latestBuild) ||
    latestBuild < 1 ||
    typeof minBuild !== 'number' ||
    !Number.isSafeInteger(minBuild) ||
    minBuild < 1 ||
    typeof version !== 'string' ||
    !version.trim() ||
    typeof url !== 'string' ||
    !isAllowedDesktopInstallerUrl(url) ||
    typeof notes !== 'string'
  ) {
    return null
  }

  return {
    latestBuild,
    minBuild: Math.min(minBuild, latestBuild),
    version: version.trim(),
    url,
    notes
  }
}

export function decideDesktopUpdate(
  currentBuild: number,
  manifest: DesktopUpdateManifest | null
): DesktopUpdateDecision {
  if (!manifest || currentBuild >= manifest.latestBuild) return 'NONE'
  return currentBuild < manifest.minBuild ? 'FORCED' : 'OPTIONAL'
}
