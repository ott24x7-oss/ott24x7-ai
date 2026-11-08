import { describe, expect, it, vi } from 'vitest'

import {
  decideDesktopUpdate,
  DESKTOP_UPDATE_MANIFEST_URL,
  DESKTOP_UPDATE_FALLBACK_MANIFEST_URL,
  DESKTOP_UPDATE_INSTALLER_URL,
  fetchDesktopUpdateManifest,
  getDesktopInstallerUrls,
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
    expect(OTT_DESKTOP_BUILD).toBe(9)
    expect(DESKTOP_UPDATE_MANIFEST_URL).toBe('https://api.ott24x7.com/update/desktop-version.json')
    expect(DESKTOP_UPDATE_FALLBACK_MANIFEST_URL).toBe(
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

  it('accepts HTTPS installer URLs only on the update and GitHub download hosts', () => {
    expect(isAllowedDesktopInstallerUrl(DESKTOP_UPDATE_INSTALLER_URL)).toBe(true)
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

  it('tries the own-domain manifest first and stops when it returns a valid manifest', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(manifest), { status: 200 }))

    await expect(fetchDesktopUpdateManifest(fetcher)).resolves.toMatchObject({ latestBuild: 4 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe(DESKTOP_UPDATE_MANIFEST_URL)
  })

  it.each([
    ['a server error', new Response('', { status: 503 })],
    ['invalid JSON', new Response('{broken', { status: 200 })]
  ])('falls back to GitHub when the own-domain manifest has %s', async (_reason, primaryResponse) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(primaryResponse)
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest), { status: 200 }))

    await expect(fetchDesktopUpdateManifest(fetcher)).resolves.toMatchObject({ latestBuild: 4 })
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      DESKTOP_UPDATE_MANIFEST_URL,
      DESKTOP_UPDATE_FALLBACK_MANIFEST_URL
    ])
  })

  it('returns no update after both manifest sources fail, without throwing', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
    const loaded = await fetchDesktopUpdateManifest(fetcher)

    expect(loaded).toBeNull()
    expect(decideDesktopUpdate(OTT_DESKTOP_BUILD, loaded)).toBe('NONE')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('tries the domain installer before the manifest URL', () => {
    expect(getDesktopInstallerUrls(manifest.url)).toEqual([DESKTOP_UPDATE_INSTALLER_URL, manifest.url])
  })

  it('decides forced, optional, and no update from build numbers', () => {
    const update = parseDesktopUpdateManifest(manifest)
    expect(decideDesktopUpdate(1, update)).toBe('FORCED')
    expect(decideDesktopUpdate(2, update)).toBe('OPTIONAL')
    expect(decideDesktopUpdate(4, update)).toBe('NONE')
    expect(decideDesktopUpdate(2, null)).toBe('NONE')
  })
})
