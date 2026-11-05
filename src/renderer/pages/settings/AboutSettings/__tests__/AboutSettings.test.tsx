import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  openExternalWebsite: vi.fn(),
  request: vi.fn(),
  search: {} as Record<string, unknown>,
  showDoctor: vi.fn()
}))

vi.unmock('@cherrystudio/ui')
vi.mock('@renderer/components/doctor', () => ({ DoctorPopup: { show: mocks.showDoctor } }))
vi.mock('@renderer/ipc', () => ({ ipcApi: { request: mocks.request } }))
vi.mock('@renderer/services/website', () => ({ openExternalWebsite: mocks.openExternalWebsite }))
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: '/settings/about' }),
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search
}))
vi.mock('@renderer/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light' }) }))
vi.mock('@renderer/components/icons/LogoAvatar', () => ({
  default: ({ logo, alt }: { logo: string; alt?: string }) => <img src={logo} alt={alt} />
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { AboutSettings } from '..'

async function renderAboutSettings() {
  render(<AboutSettings />)
  await waitFor(() => expect(mocks.request).toHaveBeenCalledWith('app.get_info'))
}

describe('AboutSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.search = {}
    mocks.request.mockResolvedValue({ isPortable: false, version: '2.0.0' })
    mocks.openExternalWebsite.mockResolvedValue(undefined)
  })

  it('shows OTT24x7 AI and the local debug action without external support links', async () => {
    const user = userEvent.setup()
    await renderAboutSettings()

    expect(screen.getByRole('heading', { name: 'OTT24x7 AI' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'OTT24x7 AI' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /repository|website|feedback|release|github/i })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'settings.about.debug.open' }))
    expect(mocks.request).toHaveBeenCalledWith('system.toggle_dev_tools')
  })

  it('opens the bundled AGPL license notice from the small About entry', async () => {
    const user = userEvent.setup()
    await renderAboutSettings()

    await user.click(screen.getByRole('button', { name: 'settings.about.open_source_licenses' }))

    expect(screen.getByRole('dialog', { name: 'settings.about.open_source_licenses' })).toBeVisible()
    expect(screen.getByText('settings.about.licenses.agpl_notice')).toBeVisible()
    expect(screen.getByText(/GNU AFFERO GENERAL PUBLIC LICENSE/i)).toBeVisible()
  })

  it('shows the AGPL notice, source link, and both store links', async () => {
    const user = userEvent.setup()
    await renderAboutSettings()

    expect(screen.getByText('settings.about.license_notice')).toBeVisible()
    const sourceLink = screen.getByRole('link', { name: 'settings.about.source_code' })
    expect(sourceLink).toHaveAttribute('href', 'https://github.com/ott24x7-oss/ott24x7-ai')
    expect(screen.getByRole('heading', { name: 'promos.our_stores' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'promos.ai_tools.button' })).toHaveAttribute(
      'href',
      'https://ott24x7.com/?utm_source=ott24x7-ai&utm_medium=app&utm_campaign=promo'
    )
    expect(screen.getByRole('link', { name: 'promos.office_keys.button' })).toHaveAttribute(
      'href',
      'https://keys24x7.com/?utm_source=ott24x7-ai&utm_medium=app&utm_campaign=promo'
    )

    await user.click(sourceLink)

    expect(mocks.openExternalWebsite).toHaveBeenCalledWith('https://github.com/ott24x7-oss/ott24x7-ai')
  })

  it('opens an externally requested Doctor panel and consumes only that query', async () => {
    mocks.search = { doctor: 'report', focusId: 'support' }

    await renderAboutSettings()

    await waitFor(() => expect(mocks.showDoctor).toHaveBeenCalledWith({ initialPanel: 'report' }))
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/settings/about',
      search: expect.any(Function),
      replace: true
    })

    const updateSearch = mocks.navigate.mock.calls[0][0].search as (
      previous: Record<string, unknown>
    ) => Record<string, unknown>
    expect(updateSearch({ doctor: 'report', focusId: 'support' })).toEqual({ focusId: 'support' })
  })
})
