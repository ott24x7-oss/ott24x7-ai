import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompareColumn } from '@renderer/types/compare'

import { CompareWebColumn } from '../CompareColumns'

const mocks = vi.hoisted(() => ({ mounted: vi.fn(), unmounted: vi.fn() }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@renderer/components/MiniApp/WebviewContainer', () => ({
  default: function WebviewContainerMock() {
    useEffect(() => {
      mocks.mounted()
      return () => mocks.unmounted()
    }, [])
    return <div data-testid="webview-host" />
  }
}))

describe('CompareWebColumn', () => {
  const column: Extract<CompareColumn, { kind: 'web' }> = {
    id: 'webapp::openai',
    kind: 'web',
    appId: 'openai',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    miniAppKind: 'site',
    canReadAnswer: true,
    enabled: true
  }

  beforeEach(() => {
    mocks.mounted.mockReset()
    mocks.unmounted.mockReset()
  })

  it('keeps the webview host mounted when a column is toggled off and on', async () => {
    const props = {
      column,
      visible: true,
      warning: false,
      onSetRef: vi.fn(),
      onFocusModel: vi.fn(),
      onToggleModel: vi.fn(),
      onRemoveModel: vi.fn(),
      onRegenerateModel: vi.fn(),
      onReorder: vi.fn(),
      onUseInFinalAnswer: vi.fn()
    }
    const { rerender } = render(<CompareWebColumn {...props} focused={false} />)

    expect(await screen.findByTestId('webview-host')).toBeInTheDocument()
    expect(mocks.mounted).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('switch', { name: 'compare.column.toggle' }))
    rerender(<CompareWebColumn {...props} column={{ ...column, enabled: false }} focused={false} />)
    expect(screen.getByTestId('webview-host')).toBeInTheDocument()
    rerender(<CompareWebColumn {...props} column={{ ...column, enabled: true }} focused={false} />)

    await waitFor(() => expect(mocks.mounted).toHaveBeenCalledOnce())
    expect(mocks.unmounted).not.toHaveBeenCalled()
  })

  it('keeps secondary web actions in the compact header menu', async () => {
    render(
      <CompareWebColumn
        column={column}
        visible
        warning={false}
        onSetRef={vi.fn()}
        focused={false}
        onFocusModel={vi.fn()}
        onToggleModel={vi.fn()}
        onRemoveModel={vi.fn()}
        onRegenerateModel={vi.fn()}
        onReorder={vi.fn()}
        onUseInFinalAnswer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'compare.column.more_actions' }))

    expect(screen.getByText('compare.web.reload')).toBeInTheDocument()
    expect(screen.getByText('compare.web.use_in_final')).toBeInTheDocument()
  })
})
