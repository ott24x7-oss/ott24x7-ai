import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { CompareColumn } from '@renderer/types/compare'

import { CompareCliColumn } from '../CompareColumns'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@renderer/components/chat/messages/markdown/ChatMarkdown', () => ({
  default: ({ block }: { block: { content: string } }) => <div>{block.content}</div>
}))

describe('CompareCliColumn scroll following', () => {
  it('scrolls to each new prompt and pauses stream-follow after the user scrolls up', () => {
    const column: Extract<CompareColumn, { kind: 'cli' }> = {
      id: 'cli::claude',
      kind: 'cli',
      cliId: 'claude',
      name: 'Claude',
      enabled: true
    }
    const props = {
      column,
      visible: true,
      onCancel: vi.fn(),
      focused: false,
      onFocusModel: vi.fn(),
      onToggleModel: vi.fn(),
      onRemoveModel: vi.fn(),
      onRegenerateModel: vi.fn(),
      onReorder: vi.fn()
    }
    const view = render(
      <CompareCliColumn {...props} output={{ content: 'First response', prompt: 'First prompt', status: 'done' }} />
    )
    const scrollRegion = screen.getByRole('region', { name: 'Claude' })
    Object.defineProperties(scrollRegion, {
      scrollHeight: { configurable: true, value: 900 },
      clientHeight: { configurable: true, value: 300 }
    })
    scrollRegion.scrollTop = 600

    scrollRegion.scrollTop = 100
    fireEvent.scroll(scrollRegion)
    view.rerender(
      <CompareCliColumn
        {...props}
        output={{ content: 'First response continues', prompt: 'First prompt', status: 'streaming' }}
      />
    )

    expect(scrollRegion.scrollTop).toBe(100)
    expect(screen.getByRole('button', { name: 'chat.navigation.bottom' })).toBeInTheDocument()

    view.rerender(
      <CompareCliColumn
        {...props}
        output={{ content: 'Second response', prompt: 'Second prompt', status: 'streaming' }}
      />
    )

    expect(screen.getByText('Second prompt')).toBeInTheDocument()
    expect(scrollRegion.scrollTop).toBe(900)

    scrollRegion.scrollTop = 100
    fireEvent.scroll(scrollRegion)
    view.rerender(
      <CompareCliColumn
        {...props}
        output={{
          content: 'Repeated response',
          prompt: 'Second prompt',
          requestId: 'second-send',
          status: 'streaming'
        }}
      />
    )

    expect(scrollRegion.scrollTop).toBe(900)
  })
})
