import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import StudioWebPaneLayer from '../StudioWebPaneLayer'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('Studio web pane layer', () => {
  it('lets input pass through the transparent page layer to the pooled webview', () => {
    render(
      <StudioWebPaneLayer>
        <button type="button">Toolbar action</button>
      </StudioWebPaneLayer>
    )

    // Pointer-events-none on this wrapper is the Mini App pooled-webview hit-testing contract.
    expect(screen.getByRole('region', { name: 'studio.web.view_label' })).toHaveClass('pointer-events-none')
    // Re-enabling pointer events on children would put MiniAppPane's surface over the webview.
    expect(screen.getByRole('region', { name: 'studio.web.view_label' }).className).not.toContain('*:pointer-events-auto')
  })
})
