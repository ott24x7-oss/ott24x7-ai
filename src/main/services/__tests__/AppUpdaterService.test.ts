import type { UpdateInfo } from 'builder-util-runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { appEditionState, netFetchMock, releaseNotesCheckMock, releaseNotesUpdaterInstances, trackAppUpdateMock } =
  vi.hoisted(() => ({
    appEditionState: { current: 'global' },
    netFetchMock: vi.fn(),
    releaseNotesCheckMock: vi.fn(),
    releaseNotesUpdaterInstances: [] as Array<Record<string, unknown>>,
    trackAppUpdateMock: vi.fn()
  }))

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    })
  }
}))

vi.mock('@data/PreferenceService', async () => {
  const { MockMainPreferenceServiceExport } = await import('@test-mocks/main/PreferenceService')
  return MockMainPreferenceServiceExport
})

vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  const result = mockApplicationFactory()
  const originalGet = result.application.get.getMockImplementation()!
  result.application.get.mockImplementation((name: string) => {
    if (name === 'AnalyticsService') {
      return { trackAppUpdate: trackAppUpdateMock }
    }
    return originalGet(name)
  })
  return result
})

vi.mock('@main/core/lifecycle', () => {
  class MockBaseService {}
  return {
    BaseService: MockBaseService,
    Injectable: () => (target: unknown) => target,
    ServicePhase: () => (target: unknown) => target,
    DependsOn: () => (target: unknown) => target,
    Phase: { Background: 'background', WhenReady: 'whenReady', BeforeReady: 'beforeReady' }
  }
})

vi.mock('@main/core/platform', () => ({
  isWin: false
}))

vi.mock('@main/utils/appEdition', () => ({
  getAppEdition: () => appEditionState.current
}))

vi.mock('@main/services/RegionService', () => ({
  regionService: { getCountry: vi.fn(async () => 'US') }
}))

vi.mock('@main/utils/systemInfo', () => ({
  generateUserAgent: vi.fn(() => 'test-user-agent'),
  getClientId: vi.fn(() => 'test-client-id')
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getVersion: vi.fn(() => '1.0.0')
  },
  net: { fetch: netFetchMock }
}))

vi.mock('electron-updater', () => {
  class MockAppUpdater {
    allowDowngrade = false
    autoDownload = true
    autoInstallOnAppQuit = true
    channel = ''
    forceDevUpdateConfig = false
    logger: unknown = null
    requestHeaders: Record<string, string> = {}

    constructor(public options?: unknown) {
      releaseNotesUpdaterInstances.push(this as unknown as Record<string, unknown>)
    }

    checkForUpdates() {
      return releaseNotesCheckMock()
    }
  }

  return {
    autoUpdater: {
      logger: null,
      forceDevUpdateConfig: false,
      autoDownload: false,
      autoInstallOnAppQuit: false,
      requestHeaders: {},
      on: vi.fn(),
      removeListener: vi.fn(),
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      quitAndInstall: vi.fn(),
      channel: '',
      allowDowngrade: false,
      disableDifferentialDownload: false,
      currentVersion: '1.0.0'
    },
    AppUpdater: MockAppUpdater,
    Logger: vi.fn(),
    NsisUpdater: vi.fn()
  }
})

import { MockMainPreferenceServiceUtils } from '@test-mocks/main/PreferenceService'
import { app, net } from 'electron'
import { autoUpdater } from 'electron-updater'

import { application } from '@application'
import { regionService } from '@main/services/RegionService'
import { UpgradeChannel } from '@shared/data/preference/preferenceTypes'
import { APP_NAME } from '@shared/utils/constants'

import { AppUpdaterService } from '../AppUpdaterService'

describe('AppUpdaterService', () => {
  let appUpdater: AppUpdaterService

  beforeEach(() => {
    vi.clearAllMocks()
    MockMainPreferenceServiceUtils.resetMocks()
    MockMainPreferenceServiceUtils.setPreferenceValue('app.dist.test_plan.enabled', false)
    MockMainPreferenceServiceUtils.setPreferenceValue('app.dist.test_plan.channel', UpgradeChannel.LATEST)
    vi.mocked(app.getVersion).mockReturnValue('1.0.0')
    vi.mocked(regionService.getCountry).mockResolvedValue('US')
    vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue(null)
    netFetchMock.mockReset()
    appEditionState.current = 'global'
    releaseNotesCheckMock.mockReset().mockResolvedValue(null)
    releaseNotesUpdaterInstances.length = 0
    autoUpdater.requestHeaders = {}
    autoUpdater.channel = ''
    autoUpdater.allowDowngrade = false
    autoUpdater.disableDifferentialDownload = false
    appUpdater = new AppUpdaterService()
  })

  describe('upgrade release notes', () => {
    const notes = '<!--LANG:en-->Notes<!--LANG:zh-CN-->说明<!--LANG:END-->'

    it('reports history as unavailable without making a network request', async () => {
      vi.mocked(app.getVersion).mockReturnValue('2.1.8')
      await expect(appUpdater.getUpgradeReleaseNotes('2.1.10')).resolves.toEqual({
        fromVersion: '2.1.8',
        toVersion: '2.1.10',
        historyStatus: 'unavailable',
        releases: []
      })
      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
      expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled()
      expect(net.fetch).not.toHaveBeenCalled()
      expect(releaseNotesCheckMock).not.toHaveBeenCalled()
    })

    it('keeps the release history unavailable even when a response is mocked', async () => {
      await expect(appUpdater.getUpgradeReleaseNotes('2.0.0')).resolves.toMatchObject({
        historyStatus: 'unavailable',
        releases: []
      })
      netFetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ version: '1.0.0', releaseNotes: notes }])))
      await expect(appUpdater.getUpgradeReleaseNotes('2.0.0')).resolves.toMatchObject({
        historyStatus: 'unavailable',
        releases: []
      })
      expect(net.fetch).not.toHaveBeenCalled()
    })

    it.each(['1.0.0', '0.9.0', 'invalid', '2.0.0-rc.1'])(
      'rejects unsupported target %s before fetching history',
      async (target) => {
        await expect(appUpdater.getUpgradeReleaseNotes(target)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
        expect(netFetchMock).not.toHaveBeenCalled()
      }
    )
  })

  describe('read-only update query', () => {
    it('reports the installed version as current without querying an updater', async () => {
      releaseNotesCheckMock.mockResolvedValue({ isUpdateAvailable: true, updateInfo: { version: '2.0.0' } })
      await expect(appUpdater.queryUpdateAvailability()).resolves.toEqual({
        status: 'current',
        currentVersion: '1.0.0'
      })
      expect(releaseNotesUpdaterInstances).toHaveLength(0)
      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
      expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled()
      expect(trackAppUpdateMock).not.toHaveBeenCalled()
      expect(net.fetch).not.toHaveBeenCalled()
    })

    it('does not contact the updater when requests fail or return no result', async () => {
      releaseNotesCheckMock.mockRejectedValueOnce(new Error('HTTP 503'))
      await expect(appUpdater.queryUpdateAvailability()).resolves.toEqual({ status: 'current', currentVersion: '1.0.0' })
      releaseNotesCheckMock.mockResolvedValueOnce(null)
      await expect(appUpdater.queryUpdateAvailability()).resolves.toEqual({ status: 'current', currentVersion: '1.0.0' })
      expect(releaseNotesUpdaterInstances).toHaveLength(0)
      expect(net.fetch).not.toHaveBeenCalled()
    })
  })

  describe('managed update feed', () => {
    it('uses the latest channel and global region outside China', async () => {
      await (appUpdater as any).configureUpdaterForCheck()

      expect(autoUpdater.channel).toBe(UpgradeChannel.LATEST)
      expect(autoUpdater.requestHeaders).toMatchObject({
        'User-Agent': 'test-user-agent',
        'Cache-Control': 'no-cache',
        'Client-Id': 'test-client-id',
        'App-Name': APP_NAME,
        'App-Version': 'v1.0.0',
        OS: process.platform,
        'X-Edition': 'global',
        'X-Region': 'global'
      })
      expect(autoUpdater.requestHeaders).not.toHaveProperty('X-Release-Channel')
      expect(autoUpdater.allowDowngrade).toBe(false)
      expect(autoUpdater.disableDifferentialDownload).toBe(false)
    })

    it('uses the China region for users in China', async () => {
      vi.mocked(regionService.getCountry).mockResolvedValue('CN')

      await (appUpdater as any).configureUpdaterForCheck()

      expect(autoUpdater.channel).toBe(UpgradeChannel.LATEST)
      expect(autoUpdater.requestHeaders).toMatchObject({
        'X-Region': 'cn'
      })
      expect(autoUpdater.requestHeaders).not.toHaveProperty('X-Release-Channel')
    })

    it('uses the China edition stable channel', async () => {
      appEditionState.current = 'cn'

      await (appUpdater as any).configureUpdaterForCheck()

      expect(autoUpdater.channel).toBe('latest-cn')
      expect(autoUpdater.requestHeaders).toMatchObject({
        'X-Edition': 'cn',
        'X-Region': 'global'
      })
    })

    it('keeps existing updater request headers', async () => {
      autoUpdater.requestHeaders = { Authorization: 'existing-header' }

      await (appUpdater as any).configureUpdaterForCheck()

      expect(autoUpdater.requestHeaders).toMatchObject({
        Authorization: 'existing-header',
        'X-Region': 'global'
      })
    })

    it.each([
      ['RC', UpgradeChannel.RC],
      ['Beta', UpgradeChannel.BETA]
    ])('requests the %s manifest when that test channel is enabled', async (_label, channel) => {
      MockMainPreferenceServiceUtils.setPreferenceValue('app.dist.test_plan.enabled', true)
      MockMainPreferenceServiceUtils.setPreferenceValue('app.dist.test_plan.channel', channel)

      await (appUpdater as any).configureUpdaterForCheck()

      expect(autoUpdater.channel).toBe(channel)
    })

    it.each([
      ['RC', UpgradeChannel.RC, 'rc-cn'],
      ['Beta', UpgradeChannel.BETA, 'beta-cn']
    ])(
      'requests the China edition %s manifest when that test channel is enabled',
      async (_label, channel, expected) => {
        appEditionState.current = 'cn'
        MockMainPreferenceServiceUtils.setPreferenceValue('app.dist.test_plan.enabled', true)
        MockMainPreferenceServiceUtils.setPreferenceValue('app.dist.test_plan.channel', channel)

        await (appUpdater as any).configureUpdaterForCheck()

        expect(autoUpdater.channel).toBe(expected)
      }
    )

    it('uses the selected test channel when the installed prerelease came from another channel', async () => {
      vi.mocked(app.getVersion).mockReturnValue('2.0.0-rc.1')
      MockMainPreferenceServiceUtils.setPreferenceValue('app.dist.test_plan.enabled', true)
      MockMainPreferenceServiceUtils.setPreferenceValue('app.dist.test_plan.channel', UpgradeChannel.BETA)

      await (appUpdater as any).configureUpdaterForCheck()

      expect(autoUpdater.channel).toBe(UpgradeChannel.BETA)
    })

    it('does not check the update feed when asked to check manually', async () => {
      await expect(appUpdater.checkForUpdates()).resolves.toEqual({ currentVersion: '1.0.0', updateInfo: null })
      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
      expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled()
      expect(net.fetch).not.toHaveBeenCalled()
      expect(trackAppUpdateMock).not.toHaveBeenCalled()
    })

    it('does not fetch release history from the managed release service', async () => {
      vi.mocked(regionService.getCountry).mockResolvedValue('CN')
      const releaseNotes = '<!--LANG:en-->Remote notes<!--LANG:zh-CN-->远端说明<!--LANG:END-->'
      const history = [{ releaseNotes, version: '1.1.0' }]
      netFetchMock.mockResolvedValue(new Response(JSON.stringify(history)))

      await expect(appUpdater.getReleaseHistory()).resolves.toBeNull()
      expect(net.fetch).not.toHaveBeenCalled()
      expect(releaseNotesUpdaterInstances).toHaveLength(0)
    })

    it('does not fetch latest release notes for the China edition', async () => {
      appEditionState.current = 'cn'
      MockMainPreferenceServiceUtils.setPreferenceValue('app.dist.test_plan.enabled', true)
      MockMainPreferenceServiceUtils.setPreferenceValue('app.dist.test_plan.channel', UpgradeChannel.RC)
      releaseNotesCheckMock.mockResolvedValue(null)

      await expect(appUpdater.getLatestReleaseNotes()).resolves.toBeNull()

      expect(releaseNotesUpdaterInstances).toHaveLength(0)
      expect(net.fetch).not.toHaveBeenCalled()
    })

    it('does not merge channel notes when release checks are disabled', async () => {
      const stableNotes = '<!--LANG:en-->Stable notes<!--LANG:zh-CN-->稳定版说明<!--LANG:END-->'
      const rcNotes = '<!--LANG:en-->RC notes<!--LANG:zh-CN-->测试版说明<!--LANG:END-->'
      netFetchMock.mockResolvedValue(new Response(JSON.stringify([{ releaseNotes: stableNotes, version: '1.1.0' }])))
      releaseNotesCheckMock.mockResolvedValue({
        isUpdateAvailable: true,
        updateInfo: { releaseNotes: rcNotes, version: '1.2.0-rc.1' }
      })

      await expect(appUpdater.getReleaseHistory()).resolves.toBeNull()
      expect(net.fetch).not.toHaveBeenCalled()
      expect(releaseNotesUpdaterInstances).toHaveLength(0)
    })

    it('does not request updater notes when release history is unavailable', async () => {
      netFetchMock.mockRejectedValue(new Error('offline'))
      releaseNotesCheckMock.mockResolvedValue({
        isUpdateAvailable: true,
        updateInfo: { releaseNotes: 'New release notes', version: '1.1.0' }
      })

      await expect(appUpdater.getReleaseHistory()).resolves.toBeNull()
      expect(net.fetch).not.toHaveBeenCalled()
      expect(releaseNotesUpdaterInstances).toHaveLength(0)
    })

    it('falls back to bundled history when the managed response is invalid', async () => {
      netFetchMock.mockResolvedValue(new Response(JSON.stringify([{ releaseNotes: 'English only', version: '1.1.0' }])))

      await expect(appUpdater.getReleaseHistory()).resolves.toBeNull()
    })

    it('falls back to bundled history when the managed request fails', async () => {
      netFetchMock.mockRejectedValue(new Error('offline'))

      await expect(appUpdater.getReleaseHistory()).resolves.toBeNull()
    })

    it('rejects release history larger than the response limit before reading it', async () => {
      const text = vi.fn()
      netFetchMock.mockResolvedValue({
        headers: new Headers({ 'content-length': String(1024 * 1024 + 1) }),
        ok: true,
        status: 200,
        text
      })

      await expect(appUpdater.getReleaseHistory()).resolves.toBeNull()
      expect(text).not.toHaveBeenCalled()
    })
  })

  describe('processReleaseInfo', () => {
    it('localizes marked release notes', () => {
      MockMainPreferenceServiceUtils.setPreferenceValue('app.language', 'zh-CN')
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: '<!--LANG:en-->English notes<!--LANG:zh-CN-->中文说明<!--LANG:END-->'
      } as UpdateInfo

      const result = (appUpdater as any).processReleaseInfo(releaseInfo)

      expect(result.releaseNotes).toBe('中文说明')
    })

    it('leaves unmarked release notes unchanged', () => {
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: 'Simple release notes'
      } as UpdateInfo

      expect((appUpdater as any).processReleaseInfo(releaseInfo).releaseNotes).toBe('Simple release notes')
    })

    it('leaves array release notes unchanged', () => {
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: [
          { version: '1.0.0', note: 'Note 1' },
          { version: '1.0.1', note: 'Note 2' }
        ]
      } as UpdateInfo

      expect((appUpdater as any).processReleaseInfo(releaseInfo).releaseNotes).toEqual(releaseInfo.releaseNotes)
    })

    it('leaves null release notes unchanged', () => {
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: null
      } as UpdateInfo

      expect((appUpdater as any).processReleaseInfo(releaseInfo).releaseNotes).toBeNull()
    })

    it('leaves marked release notes unchanged when language lookup fails', () => {
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: '<!--LANG:en-->English notes<!--LANG:zh-CN-->中文说明<!--LANG:END-->'
      } as UpdateInfo
      vi.mocked(application.get('PreferenceService').get).mockImplementationOnce(() => {
        throw new Error('Test error')
      })

      expect((appUpdater as any).processReleaseInfo(releaseInfo).releaseNotes).toBe(releaseInfo.releaseNotes)
    })
  })
})
