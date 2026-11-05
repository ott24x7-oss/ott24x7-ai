import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }))

vi.mock('@renderer/ipc', () => ({ ipcApi: { request: requestMock } }))
vi.mock('react-i18next', () => {
  const t = (key: string, options?: Record<string, string | number>) =>
    options ? `${key}: ${Object.values(options).join(', ')}` : key
  return { useTranslation: () => ({ t }) }
})

import PerSiteProxySettings from '../PerSiteProxySettings'

describe('PerSiteProxySettings', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockImplementation((route: string) => (route === 'proxy.get_site_rules' ? Promise.resolve([]) : Promise.resolve(undefined)))
  })

  it('adds the Perplexity preset and reports the result of a proxy reachability test', async () => {
    const user = userEvent.setup()
    requestMock.mockImplementation((route: string) => {
      if (route === 'proxy.get_site_rules') return Promise.resolve([])
      if (route === 'proxy.test_site_rule') {
        return Promise.resolve({ target: 'https://perplexity.ai/', route: 'proxy', success: true, latencyMs: 42 })
      }
      return Promise.resolve(undefined)
    })
    render(<PerSiteProxySettings />)

    await user.click(await screen.findByRole('button', { name: 'settings.proxy.site.perplexity_preset' }))
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith('proxy.save_site_rules', [
      expect.objectContaining({
        id: expect.any(String),
        name: 'Perplexity',
        enabled: false,
        domains: ['perplexity.ai', 'www.perplexity.ai', 'pplx.ai', 'perplexity.com'],
        proxyUrl: '',
        password: ''
      })
    ]))

    await user.click(screen.getByRole('button', { name: 'settings.proxy.test.action' }))
    expect(await screen.findByRole('status')).toHaveTextContent('https://perplexity.ai/')
    expect(screen.getByRole('status')).toHaveTextContent('42')
  })

  it('keeps the password field masked while saving the URL without credentials', async () => {
    const user = userEvent.setup()
    render(<PerSiteProxySettings />)
    await user.click(await screen.findByRole('button', { name: 'common.add' }))

    const url = screen.getByPlaceholderText('socks5://127.0.0.1:1080')
    await user.type(url, 'http://alice:secret@proxy.example:8080')
    expect(url).toHaveValue('http://alice@proxy.example:8080')
    expect(screen.getByLabelText('settings.proxy.site.password')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('settings.proxy.site.password')).toHaveValue('secret')

    fireEvent.blur(url)
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith('proxy.save_site_rules', [
      expect.objectContaining({ proxyUrl: 'http://alice@proxy.example:8080', password: 'secret' })
    ]))
  })
})
