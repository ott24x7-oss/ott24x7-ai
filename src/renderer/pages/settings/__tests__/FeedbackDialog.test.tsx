import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as CherryStudioUi from '@cherrystudio/ui'
import enUs from '@renderer/i18n/locales/en-us.json'

const mocks = vi.hoisted(() => ({
  ipcRequest: vi.fn(),
  loggerError: vi.fn(),
  openRoute: vi.fn(),
  showDoctor: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('@cherrystudio/ui', async (importOriginal) => importOriginal<typeof CherryStudioUi>())

vi.mock('@logger', () => ({
  loggerService: { withContext: () => ({ error: mocks.loggerError }) }
}))

vi.mock('@renderer/ipc', () => ({
  ipcApi: {
    request: (...args: unknown[]) => mocks.ipcRequest(...args)
  }
}))

vi.mock('@renderer/components/doctor', () => ({
  DoctorPopup: { show: (...args: unknown[]) => mocks.showDoctor(...args) }
}))

vi.mock('@renderer/services/mainWindowNavigation', () => ({
  openRoute: (...args: unknown[]) => mocks.openRoute(...args)
}))

vi.mock('@renderer/services/toast', () => ({
  toast: { error: (...args: unknown[]) => mocks.toastError(...args) }
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (enUs as Record<string, string>)[key] ?? key
  })
}))

import { FeedbackDialog, getFeedbackAgentRoute } from '../FeedbackDialog'

function ControlledFeedbackDialog() {
  const [open, setOpen] = useState(true)
  return <FeedbackDialog open={open} onOpenChange={setOpen} />
}

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

describe('FeedbackDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ipcRequest.mockResolvedValue({ sessionId: 'feedback-session' })
    Object.defineProperty(window.electron, 'process', {
      configurable: true,
      value: { platform: 'darwin' }
    })
  })

  it('offers local diagnostics and the in-app feedback assistant only', () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />)

    const agent = screen.getByRole('button', { name: /Feedback assistant/ })
    const report = screen.getByRole('button', { name: /Report a problem/i })

    expect(report.compareDocumentPosition(agent)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.queryByRole('button', { name: /GitHub Issue|Contact/ })).not.toBeInTheDocument()
  })

  it('closes feedback before opening the problem report panel', async () => {
    mocks.showDoctor.mockImplementationOnce(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      return Promise.resolve()
    })
    render(<ControlledFeedbackDialog />)

    await userEvent.setup().click(screen.getByRole('button', { name: /Report a problem/i }))

    await waitFor(() => expect(mocks.showDoctor).toHaveBeenCalledWith({ initialPanel: 'report' }))
    expect(mocks.ipcRequest).not.toHaveBeenCalled()
  })

  it('creates an isolated feedback session before opening the Agent route', async () => {
    render(<ControlledFeedbackDialog />)

    await userEvent.setup().click(screen.getByRole('button', { name: /Feedback assistant/ }))

    await waitFor(() => expect(mocks.ipcRequest).toHaveBeenCalledWith('ai.agent.support_session.create'))
    await waitFor(() => expect(mocks.openRoute).toHaveBeenCalledWith(getFeedbackAgentRoute('feedback-session')))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('reports feedback-session creation failures without opening an empty Agent route', async () => {
    mocks.ipcRequest.mockRejectedValue(new Error('restore failed'))
    render(<FeedbackDialog open onOpenChange={vi.fn()} />)

    await userEvent.setup().click(screen.getByRole('button', { name: /Feedback assistant/ }))

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(enUs['settings.about.feedback.agent_error']))
    expect(mocks.openRoute).not.toHaveBeenCalled()
  })

})
