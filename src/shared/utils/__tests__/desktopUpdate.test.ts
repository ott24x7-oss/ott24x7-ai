import { describe, expect, it } from 'vitest'

import {
  decideDesktopUpdate,
  DESKTOP_UPDATE_MANIFEST_URL,
  isAllowedDesktopInstallerUrl,
  OTT_DESKTOP_BUILD,
  parseDesktopUpdateManifest
} from '../desktopUpdate'

const manifest = {
  latestBuild: 4,
  minBuild: 2,
  version: '1.2',
  url: 'https://github.com/ott24x7-oss/ott24x7-ai/releases/latest/download/OTT24x7-AI-Setup.exe',
  notes: 'Security and stability fixes.'
}

describe('desktop update manifest', () => {
  it('keeps the product version independent from the desktop build number', () => {
    expect(OTT_DESKTOP_BUILD).toBe(2)
    expect(DESKTOP_UPDATE_MANIFEST_URL).toBe(
      'https://github.com/ott24x7-oss/ott24x7-ai/releases/latest/download/desktop-version.json'
    )
  })

  it('returns null for malformed JSON or required fields', () => {
    expect(parseDesktopUpdateManifest('{broken')).toBeNull()
    expect(parseDesktopUpdateManifest({ ...manifest, latestBuild: '4' })).toBeNull()
    expect(parseDesktopUpdateManifest({ ...manifest, notes: undefined })).toBeNull()
  })

  it('clamps minBuild to latestBuild so a bad minimum cannot lock users out', () => {
    expect(parseDesktopUpdateManifest({ ...manifest, latestBuild: 4, minBuild: 99 })).toMatchObject({
      latestBuild: 4,
      minBuild: 4
    })
  })

  it('accepts installer URLs only on the two HTTPS GitHub hosts', () => {
    expect(isAllowedDesktopInstallerUrl(manifest.url)).toBe(true)
    expect(isAllowedDesktopInstallerUrl('https://objects.githubusercontent.com/release/installer.exe')).toBe(true)
    expect(
      isAllowedDesktopInstallerUrl('https://release-assets.githubusercontent.com/github-production-release-asset/1/x')
    ).toBe(true)
    expect(isAllowedDesktopInstallerUrl('http://github.com/ott24x7-oss/installer.exe')).toBe(false)
    expect(isAllowedDesktopInstallerUrl('https://github.com.evil.example/installer.exe')).toBe(false)
    expect(isAllowedDesktopInstallerUrl('https://example.com/installer.exe')).toBe(false)
    expect(isAllowedDesktopInstallerUrl('https://user@github.com/installer.exe')).toBe(false)
  })

  it('decides forced, optional, and no update from build numbers', () => {
    const update = parseDesktopUpdateManifest(manifest)
    expect(decideDesktopUpdate(1, update)).toBe('FORCED')
    expect(decideDesktopUpdate(2, update)).toBe('OPTIONAL')
    expect(decideDesktopUpdate(4, update)).toBe('NONE')
    expect(decideDesktopUpdate(2, null)).toBe('NONE')
  })
})
