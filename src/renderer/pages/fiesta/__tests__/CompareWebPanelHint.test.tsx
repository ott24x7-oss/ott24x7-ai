import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CompareWebPanelHint } from '../CompareWebPanelHint'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'compare.web_panels_hint':
          'Web panels are view-only extras. Backup, memory and auto-combine work best with signed-in models.',
        'compare.web_panels_hint.dismiss': 'Dismiss web panel hint'
      })[key] ?? key
  })
}))

describe('CompareWebPanelHint', () => {
  it('shows the login-first web-panel warning and exposes a dismiss action', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()

    render(<CompareWebPanelHint onDismiss={onDismiss} />)

    expect(screen.getByText(/Web panels are view-only extras/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dismiss web panel hint' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
