// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showDoctor: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@cherrystudio/ui', async (importOriginal) => importOriginal())
vi.mock('@renderer/components/doctor', () => ({ DoctorPopup: { show: mocks.showDoctor } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { HelpMenu } from '../HelpMenu'

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('HelpMenu', () => {
  it('offers local diagnostics and opens them after closing the menu', async () => {
    const onRequestClose = vi.fn()
    const user = userEvent.setup()
    render(<HelpMenu onRequestClose={onRequestClose} />)

    await user.click(screen.getByRole('button', { name: 'help.title' }))
    const diagnostics = await screen.findByRole('button', { name: 'settings.doctor.entry.title' })

    expect(screen.queryByRole('button', { name: /help\.(guide|feedback|whats_new)/ })).not.toBeInTheDocument()

    await user.click(diagnostics)

    await waitFor(() => expect(mocks.showDoctor).toHaveBeenCalledWith({ initialPanel: 'checks' }))
    expect(onRequestClose).toHaveBeenCalledOnce()
  })
})
