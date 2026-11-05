import { render, screen } from '@testing-library/react'
import { createContext, type ReactNode, use } from 'react'
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
vi.mock('../messages/homeMessageListAdapter', () => ({ useHomeMessageListProviderValue: () => ({}) }))
vi.mock('@renderer/components/compare/FinalAnswerCard', () => ({
  FinalAnswerCard: () => {
    useMessageRenderConfig()
    return <div>final answer</div>
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
  })
})
