import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const ipcMocks = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('@renderer/ipc', () => ({
  ipcApi: { request: ipcMocks.request },
  useIpcOn: vi.fn()
}))

import { useDesktopUpdate, DesktopUpdateProvider } from '../DesktopUpdateProvider'

function UpdateCheckProbe() {
  const { checkForUpdates, optionalUpdateOpen, status } = useDesktopUpdate()

  return (
    <>
      <output role="status">
        {status?.decision ?? 'loading'}:{String(optionalUpdateOpen)}
      </output>
      <button type="button" onClick={() => void checkForUpdates()}>
        Check update
      </button>
    </>
  )
}

describe('DesktopUpdateProvider manual checks', () => {
  it('opens the existing optional update prompt when a manual check finds an update', async () => {
    const user = userEvent.setup()
    ipcMocks.request.mockResolvedValueOnce({ decision: 'NONE', currentBuild: 7 }).mockResolvedValueOnce({
      decision: 'OPTIONAL',
      currentBuild: 7,
      manifest: {
        latestBuild: 8,
        minBuild: 7,
        version: '1.8',
        url: 'https://api.ott24x7.com/download/OTT24x7-AI-Setup.exe',
        notes: 'Fixes'
      }
    })

    render(
      <DesktopUpdateProvider>
        <UpdateCheckProbe />
      </DesktopUpdateProvider>
    )

    expect(await screen.findByRole('status')).toHaveTextContent('NONE:false')
    await user.click(screen.getByRole('button', { name: 'Check update' }))

    expect(await screen.findByRole('status')).toHaveTextContent('OPTIONAL:true')
    expect(ipcMocks.request).toHaveBeenNthCalledWith(2, 'app.desktop_update.check')
  })
})
