import { fireEvent, render, screen } from '@testing-library/react'
import { createContext, type ReactNode, use, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import ChatMain from '../ChatMain'

// Regression: Compare's CLI columns and final answer render markdown, which throws
// "useMessageRenderConfig must be used within MessageListProvider" outside the list context.
const ListContext = createContext(false)

vi.mock('@renderer/components/chat/messages/MessageListProvider', () => ({
  MessageListProvider: ({ children }: { children: ReactNode }) => <ListContext value>{children}</ListContext>
}))

const useMessageRenderConfig = () => {
  if (!use(ListContext)) throw new Error('useMessageRenderConfig must be used within MessageListProvider')
  return {}
}

vi.mock('@renderer/components/chat/messages/MessageList', () => ({ default: () => null }))
vi.mock('../messages/homeMessageListAdapter', () => ({
  useHomeMessageListProviderValue: () => ({ state: { messages: [] } })
}))
vi.mock('@renderer/components/compare/FinalAnswerCard', () => ({
  FinalAnswerCard: ({ onClose, onCombine }: { onClose: () => void; onCombine: () => void }) => {
    useMessageRenderConfig()
    return (
      <section>
        <div>final answer</div>
        <button type="button" onClick={onClose}>
          close panel
        </button>
        <button type="button" onClick={onCombine}>
          rerun combine
        </button>
      </section>
    )
  }
}))
vi.mock('@renderer/components/compare/CompareColumns', () => ({
  CompareColumnHeader: () => null,
  CompareWebColumn: () => null,
  CompareCliColumn: () => {
    useMessageRenderConfig()
    return <div>cli answer</div>
  }
}))
vi.mock('@renderer/components/compare/CompareEmptyState', () => ({ CompareEmptyState: () => null }))

describe('ChatMain in Compare', () => {
  it('renders a CLI answer and the final answer without crashing after a send', () => {
    const compare = {
      columns: [{ id: 'cli:claude', kind: 'cli', cliId: 'claude' }],
      layout: { kind: 'columns', columns: 2 },
      focusedModelId: undefined,
      canCombine: true,
      finalAnswerPanelOpen: true,
      onCloseFinalAnswer: vi.fn(),
      finalAnswer: { status: 'done', content: 'OK' },
      cliOutputs: {},
      deliveryStatuses: {},
      webWarnings: {}
    }
    render(
      <ChatMain
        {...({
          topic: { id: 't1' },
          messages: [],
          partsByMessageId: {},
          streamingLayers: {},
          onBindRuntime: vi.fn(),
          loadOlder: vi.fn(),
          hasOlder: false,
          compare
        } as unknown as Parameters<typeof ChatMain>[0])}
      />
    )
    expect(screen.getByText('cli answer')).toBeInTheDocument()
    expect(screen.getByText('final answer')).toBeInTheDocument()
    const columns = document.getElementById('compare-panels')
    expect(columns).toHaveClass('overflow-auto')
  })

  it('closes the final-answer panel and reopens it from Combine without hiding columns', () => {
    const compare = {
      columns: [{ id: 'cli::claude', kind: 'cli', cliId: 'claude', name: 'Claude', enabled: true }],
      layout: { kind: 'columns', columns: 2 },
      focusedModelId: undefined,
      canCombine: true,
      finalAnswer: { status: 'done', content: 'OK', judgeName: 'Claude' },
      cliOutputs: {},
      deliveryStatuses: {},
      webWarnings: {}
    }
    function Harness() {
      const [isOpen, setIsOpen] = useState(true)
      const onCombine = () => setIsOpen(true)
      return (
        <>
          <button type="button" onClick={onCombine}>
            toolbar combine
          </button>
          <ChatMain
            {...({
              topic: { id: 't1' },
              messages: [],
              partsByMessageId: {},
              streamingLayers: {},
              onBindRuntime: vi.fn(),
              loadOlder: vi.fn(),
              hasOlder: false,
              compare: {
                ...compare,
                finalAnswerPanelOpen: isOpen,
                onCloseFinalAnswer: () => setIsOpen(false),
                onCombine
              }
            } as unknown as Parameters<typeof ChatMain>[0])}
          />
        </>
      )
    }

    render(<Harness />)
    expect(screen.getByText('final answer')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'close panel' }))
    expect(screen.queryByText('final answer')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'toolbar combine' }))
    expect(screen.getByText('final answer')).toBeInTheDocument()
  })

  it('renders the open final answer as a dialog below 1280px', () => {
    const originalWidth = window.innerWidth
    const matchMediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1279 })
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined })

    try {
      render(
        <ChatMain
          {...({
            topic: { id: 't1' },
            messages: [],
            partsByMessageId: {},
            streamingLayers: {},
            onBindRuntime: vi.fn(),
            loadOlder: vi.fn(),
            hasOlder: false,
            compare: {
              columns: [{ id: 'cli::claude', kind: 'cli', cliId: 'claude', name: 'Claude', enabled: true }],
              layout: { kind: 'columns', columns: 2 },
              focusedModelId: undefined,
              canCombine: true,
              finalAnswerPanelOpen: true,
              onCloseFinalAnswer: vi.fn(),
              onCombine: vi.fn(),
              finalAnswer: { status: 'done', content: 'OK', judgeName: 'Claude' },
              cliOutputs: {},
              deliveryStatuses: {},
              webWarnings: {}
            }
          } as unknown as Parameters<typeof ChatMain>[0])}
        />
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
      if (matchMediaDescriptor) Object.defineProperty(window, 'matchMedia', matchMediaDescriptor)
      else Reflect.deleteProperty(window, 'matchMedia')
    }
  })
})
