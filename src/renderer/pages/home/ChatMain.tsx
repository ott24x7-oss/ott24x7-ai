import type { FC } from 'react'

import MessageList from '@renderer/components/chat/messages/MessageList'
import { MessageListProvider } from '@renderer/components/chat/messages/MessageListProvider'
import type {
  MessageListActions,
  MessageListSelectAllPagination,
  MessageStreamingLayers
} from '@renderer/components/chat/messages/types'
import { CompareCliColumn, CompareWebColumn } from '@renderer/components/compare/CompareColumns'
import { FinalAnswerCard } from '@renderer/components/compare/FinalAnswerCard'
import type { Assistant } from '@renderer/types/assistant'
import type { ComparePageConfig } from '@renderer/types/compare'
import type { Topic } from '@renderer/types/topic'
import type { CherryMessagePart, CherryUIMessage } from '@shared/data/types/message'
import type { UniqueModelId } from '@shared/data/types/model'

import { useHomeMessageListProviderValue } from './messages/homeMessageListAdapter'

interface ChatMainProps {
  topic: Topic
  assistant?: Assistant
  messages: CherryUIMessage[]
  partsByMessageId: Record<string, CherryMessagePart[]>
  streamingLayers: MessageStreamingLayers
  onBindRuntime: NonNullable<MessageListActions['bindRuntime']>
  isInitialLoading?: boolean
  isMessagesStale?: boolean
  loadOlder: () => void
  hasOlder: boolean
  selectAllPagination?: MessageListSelectAllPagination
  openCitationsPanel?: MessageListActions['openCitationsPanel']
  onStartBranchDraft?: MessageListActions['startMessageBranch']
  compare?: ComparePageConfig
}

const ChatMain: FC<ChatMainProps> = ({
  topic,
  assistant,
  messages,
  partsByMessageId,
  streamingLayers,
  onBindRuntime,
  isInitialLoading,
  isMessagesStale,
  loadOlder,
  hasOlder,
  selectAllPagination,
  openCitationsPanel,
  onStartBranchDraft,
  compare
}) => {
  const baseValue = useHomeMessageListProviderValue({
    topic,
    assistant,
    messages,
    partsByMessageId,
    streamingLayers,
    onBindRuntime,
    isInitialLoading,
    isMessagesStale,
    loadOlder,
    hasOlder,
    selectAllPagination,
    openCitationsPanel,
    onStartBranchDraft
  })
  if (!compare) {
    return (
      <MessageListProvider value={baseValue}>
        <MessageList enableSearch />
      </MessageListProvider>
    )
  }

  const columnCount = compare.layout.kind === 'grid' ? 2 : compare.layout.columns
  const runtimeOwnerId = compare.columns.find((column) => column.kind === 'api')?.id
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
      {compare.welcomeCard}
      <div
        id="compare-panels"
        className="grid min-h-[32rem] flex-1 auto-rows-[minmax(32rem,1fr)] gap-2"
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(20rem, 1fr))` }}>
        {compare.columns.map((column) => {
          const visible = !compare.focusedModelId || compare.focusedModelId === column.id
          if (column.kind === 'api') {
            const value = buildApiColumnValue(baseValue, column.id, compare, column.id === runtimeOwnerId)
            return (
              <div key={column.id} className="min-h-0 min-w-0" hidden={!visible}>
                <MessageListProvider value={value}>
                  <MessageList enableSearch />
                </MessageListProvider>
              </div>
            )
          }
          if (column.kind === 'web') {
            return (
              <div key={column.id} className="min-h-0 min-w-0" hidden={!visible}>
                <CompareWebColumn
                  column={column}
                  visible={visible}
                  warning={compare.webWarnings[column.appId] ?? false}
                  onSetRef={compare.onWebviewRef}
                  onFocus={() => compare.onFocusModel(column.id)}
                  onRemove={() => compare.onRemoveModel(column.id)}
                  onUseInFinalAnswer={compare.onUseWebAnswer}
                />
              </div>
            )
          }
          return (
            <div key={column.id} className="min-h-0 min-w-0" hidden={!visible}>
              <CompareCliColumn
                column={column}
                output={compare.cliOutputs[column.cliId]}
                onCancel={compare.onCancelCli}
                onFocus={() => compare.onFocusModel(column.id)}
                onRemove={() => compare.onRemoveModel(column.id)}
              />
            </div>
          )
        })}
      </div>
      {(compare.canCombine || compare.finalAnswer) && (
        <FinalAnswerCard
          answer={compare.finalAnswer}
          canCombine={compare.canCombine}
          onCombine={compare.onCombine}
          onCopy={compare.onCopyFinalAnswer}
          onContinue={() => {
            if (compare.finalAnswer?.status === 'done') compare.onContinueFromAnswer?.(compare.finalAnswer.content)
          }}
        />
      )}
    </div>
  )
}

function buildApiColumnValue(
  baseValue: ReturnType<typeof useHomeMessageListProviderValue>,
  modelId: UniqueModelId,
  compare: ComparePageConfig,
  ownsRuntime: boolean
) {
  const messages = baseValue.state.messages.filter(
    (message) => message.role !== 'assistant' || !message.modelId || message.modelId === modelId
  )
  const visibleMessageIds = new Set(messages.map((message) => message.id))
  const partsByMessageId = Object.fromEntries(
    Object.entries(baseValue.state.partsByMessageId).filter(([messageId]) => visibleMessageIds.has(messageId))
  )
  return {
    ...baseValue,
    actions: {
      ...baseValue.actions,
      bindRuntime: ownsRuntime ? baseValue.actions.bindRuntime : undefined,
      focusCompareModel: (id: UniqueModelId) => compare.onFocusModel(id),
      removeCompareModel: (id: UniqueModelId) => compare.onRemoveModel(id)
    },
    state: {
      ...baseValue.state,
      messages,
      partsByMessageId,
      renderConfig: {
        ...baseValue.state.renderConfig,
        compareMode: true,
        multiModelMessageStyle: 'grid' as const,
        multiModelGridColumns: 1,
        compareLayout: 'columns' as const
      }
    }
  }
}

export default ChatMain
