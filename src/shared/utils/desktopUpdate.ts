export const OTT_DESKTOP_BUILD = 6
export const DESKTOP_UPDATE_MANIFEST_URL =
  'https://github.com/ott24x7-oss/ott24x7-ai/releases/latest/download/desktop-version.json'

const ALLOWED_INSTALLER_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com'
])

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
