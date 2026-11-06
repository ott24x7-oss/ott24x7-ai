import { memo, type FC, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@cherrystudio/ui'
import { useIcon } from '@cherrystudio/ui/icons'
import MessageList from '@renderer/components/chat/messages/MessageList'
import { MessageListProvider } from '@renderer/components/chat/messages/MessageListProvider'
import type {
  MessageListActions,
  MessageListSelectAllPagination,
  MessageStreamingLayers
} from '@renderer/components/chat/messages/types'
import { CompareCliColumn, CompareColumnHeader, CompareWebColumn } from '@renderer/components/compare/CompareColumns'
import { CompareEmptyState } from '@renderer/components/compare/CompareEmptyState'
import { FinalAnswerCard } from '@renderer/components/compare/FinalAnswerCard'
import type { Assistant } from '@renderer/types/assistant'
import type { CompareColumn, CompareColumnId, ComparePageConfig } from '@renderer/types/compare'
import type { Topic } from '@renderer/types/topic'
import { formatCompareColumnErrorMessage } from '@renderer/utils/compareErrorMessage'
import { getModelLogoRef } from '@renderer/utils/model'
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
  onRegenerateModel?: (modelId: CompareColumnId) => void
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
  compare,
  onRegenerateModel
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

  return <CompareChatMain compare={compare} baseValue={baseValue} onRegenerateModel={onRegenerateModel} />
}

interface CompareChatMainProps {
  compare: ComparePageConfig
  baseValue: ReturnType<typeof useHomeMessageListProviderValue>
  onRegenerateModel?: (modelId: CompareColumnId) => void
}

const CompareChatMain: FC<CompareChatMainProps> = ({ compare, baseValue, onRegenerateModel }) => {
  const { t } = useTranslation()
  const isCompactViewport = useIsCompactCompareViewport()

  const columnCount = compare.focusedModelId ? 1 : compare.layout.kind === 'grid' ? 2 : compare.layout.columns
  const gridRowCount =
    compare.layout.kind === 'grid' && !compare.focusedModelId ? Math.ceil(compare.columns.length / 2) : 1
  const regenerateModel = onRegenerateModel ?? (() => {})
  const latestPromptMessageId = useMemo(() => {
    for (let index = baseValue.state.messages.length - 1; index >= 0; index -= 1) {
      const message = baseValue.state.messages[index]
      if (message.role === 'user') return message.id
    }
    return undefined
  }, [baseValue.state.messages])
  const columnsContent = (
    <div className="relative min-h-0 flex-1">
      {compare.columns.length === 0 ? (
        <CompareEmptyState
          onAddColumn={compare.onAddColumn}
          onUseSubscriptions={compare.onUseSubscriptions}
          onOpenModelPicker={compare.onOpenModelPicker}
          cliAvailability={compare.cliAvailability}
        />
      ) : (
        <>
          <div
            id="compare-panels"
            className="grid h-full min-h-0 w-full auto-cols-fr gap-3 overflow-auto scroll-smooth pb-1"
            style={{
              gridTemplateColumns: compare.focusedModelId
                ? 'minmax(0, 1fr)'
                : `repeat(${columnCount}, minmax(380px, 1fr))`,
              gridAutoColumns:
                compare.focusedModelId || compare.layout.kind === 'grid' ? undefined : 'minmax(380px, 1fr)',
              minWidth: 0,
              gridTemplateRows: `repeat(${gridRowCount}, minmax(0, 1fr))`,
              gridAutoFlow: compare.layout.kind === 'grid' ? 'row' : 'column'
            }}>
            {compare.columns.map((column) => {
              const visible = !compare.focusedModelId || compare.focusedModelId === column.id
              const isFocused = compare.focusedModelId === column.id
              if (column.kind === 'api') {
                return (
                  <CompareApiColumn
                    key={column.id}
                    column={column}
                    baseValue={baseValue}
                    ownsRuntime={column.id === compare.runtimeOwnerId}
                    visible={visible}
                    latestPromptMessageId={latestPromptMessageId}
                    focused={isFocused}
                    onFocusModel={compare.onFocusModel}
                    onToggleModel={compare.onToggleModel}
                    onRemoveModel={compare.onRemoveModel}
                    onRegenerateModel={regenerateModel}
                    onReorder={compare.onReorderModels}
                    delivery={compare.deliveryStatuses[column.id]}
                  />
                )
              }
              if (column.kind === 'web') {
                return (
                  <CompareWebColumn
                    key={column.id}
                    column={column}
                    visible={visible}
                    warning={compare.webWarnings[column.appId] ?? false}
                    delivery={compare.deliveryStatuses[column.id]}
                    onSetRef={compare.onWebviewRef}
                    onUseInFinalAnswer={compare.onUseWebAnswer}
                    focused={isFocused}
                    onFocusModel={compare.onFocusModel}
                    onToggleModel={compare.onToggleModel}
                    onRemoveModel={compare.onRemoveModel}
                    onRegenerateModel={regenerateModel}
                    onReorder={compare.onReorderModels}
                  />
                )
              }
              return (
                <CompareCliColumn
                  key={column.id}
                  column={column}
                  output={compare.cliOutputs[column.cliId]}
                  delivery={compare.deliveryStatuses[column.id]}
                  visible={visible}
                  onCancel={compare.onCancelCli}
                  focused={isFocused}
                  onFocusModel={compare.onFocusModel}
                  onToggleModel={compare.onToggleModel}
                  onRemoveModel={compare.onRemoveModel}
                  onRegenerateModel={regenerateModel}
                  onReorder={compare.onReorderModels}
                />
              )
            })}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-background to-transparent" />
        </>
      )}
    </div>
  )
  const finalAnswerPanel = (
    <FinalAnswerCard
      answer={compare.finalAnswer}
      canCombine={compare.canCombine}
      onCombine={compare.onCombine}
      onCopy={compare.onCopyFinalAnswer}
      onContinue={() => {
        if (compare.finalAnswer?.status === 'done') compare.onContinueFromAnswer?.(compare.finalAnswer.content)
      }}
      onClose={compare.onCloseFinalAnswer}
    />
  )

  // API/CLI columns and the final answer render markdown inside the message-list context.
  return (
    <MessageListProvider value={baseValue}>
      <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 pb-40">
        {compare.welcomeCard}
        <div className="relative flex min-h-0 flex-1">
          {compare.finalAnswerPanelOpen && !isCompactViewport ? (
            <ResizablePanelGroup id="compare-final-answer-layout" direction="horizontal" className="min-h-0 flex-1">
              <ResizablePanel id="compare-columns" minSize="380px" className="min-w-0 overflow-hidden">
                <div className="flex h-full min-h-0 flex-col">{columnsContent}</div>
              </ResizablePanel>
              <ResizableHandle withHandle aria-label={t('common.resize_panel')} />
              <ResizablePanel
                id="compare-final-answer"
                defaultSize="40%"
                minSize="360px"
                maxSize="60%"
                className="min-w-0">
                {finalAnswerPanel}
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="flex h-full min-h-0 w-full flex-col">{columnsContent}</div>
          )}
          {compare.finalAnswerPanelOpen && isCompactViewport && (
            <div className="absolute inset-0 z-20">
              <button
                type="button"
                aria-label={t('common.close')}
                className="absolute inset-0 cursor-default bg-black/35"
                onClick={compare.onCloseFinalAnswer}
              />
              <aside
                role="dialog"
                aria-modal="true"
                aria-label={`${t('compare.final_answer.title')} ${compare.finalAnswer?.judgeName ?? ''}`.trim()}
                className="absolute inset-y-0 right-0 z-10 w-[min(90vw,480px)] min-w-[360px] max-w-full">
                {finalAnswerPanel}
              </aside>
            </div>
          )}
        </div>
      </div>
    </MessageListProvider>
  )
}

function useIsCompactCompareViewport(): boolean {
  const [isCompact, setIsCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1280)

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 1279px)')
    if (!media) {
      const update = () => setIsCompact(window.innerWidth < 1280)
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const update = (event: MediaQueryListEvent) => setIsCompact(event.matches)
    setIsCompact(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isCompact
}

interface CompareApiColumnProps {
  column: Extract<CompareColumn, { kind: 'api' }>
  baseValue: ReturnType<typeof useHomeMessageListProviderValue>
  ownsRuntime: boolean
  visible: boolean
  latestPromptMessageId?: string
  focused: boolean
  onFocusModel: ComparePageConfig['onFocusModel']
  onToggleModel: ComparePageConfig['onToggleModel']
  onRemoveModel: ComparePageConfig['onRemoveModel']
  onRegenerateModel: (id: CompareColumnId) => void
  onReorder: (sourceId: CompareColumnId, targetId: CompareColumnId) => void
  delivery?: ComparePageConfig['deliveryStatuses'][string]
}

const CompareApiColumn = memo(function CompareApiColumn({
  column,
  baseValue,
  ownsRuntime,
  visible,
  latestPromptMessageId,
  focused,
  onFocusModel,
  onToggleModel,
  onRemoveModel,
  onRegenerateModel,
  onReorder,
  delivery
}: CompareApiColumnProps) {
  const { t } = useTranslation()
  const icon = useIcon(getModelLogoRef(column.model, column.model.providerId))
  const iconNode = icon ? <icon.Avatar size={20} /> : null
  const value = useMemo(
    () =>
      buildApiColumnValue(
        baseValue,
        column.id,
        ownsRuntime,
        onFocusModel,
        onRemoveModel,
        column.model.name,
        t('compare.api.chat_model_required')
      ),
    [baseValue, column.id, column.model.name, onFocusModel, onRemoveModel, ownsRuntime, t]
  )
  const enabled = column.enabled
  return (
    <section
      hidden={!visible}
      className="flex h-full min-h-0 min-w-[380px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      <CompareColumnHeader
        id={column.id}
        name={column.model.name}
        badge={t('compare.api_badge')}
        icon={iconNode}
        enabled={enabled}
        focused={focused}
        onToggle={() => onToggleModel(column.id)}
        onFocus={() => onFocusModel(focused ? null : column.id)}
        onRegenerate={() => onRegenerateModel(column.id)}
        onRemove={() => onRemoveModel(column.id)}
        onReorder={onReorder}
        delivery={delivery}
      />
      <div className="relative min-h-0 flex-1">
        <div className={enabled ? 'h-full min-h-0' : 'pointer-events-none invisible h-full min-h-0'}>
          <MessageListProvider value={value}>
            <MessageList
              enableSearch
              scrollPositionKey={`compare:${baseValue.state.topic.id}:${column.id}`}
              scrollToBottomOnPrompt={visible ? latestPromptMessageId : undefined}
            />
          </MessageListProvider>
        </div>
        {!enabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 text-sm text-muted-foreground">
            {t('compare.column.disabled')}
          </div>
        )}
      </div>
    </section>
  )
})

function buildApiColumnValue(
  baseValue: ReturnType<typeof useHomeMessageListProviderValue>,
  modelId: UniqueModelId,
  ownsRuntime: boolean,
  onFocusModel: ComparePageConfig['onFocusModel'],
  onRemoveModel: ComparePageConfig['onRemoveModel'],
  columnName: string,
  chatModelHint: string
) {
  const messages = baseValue.state.messages.filter(
    (message) => message.role !== 'assistant' || !message.modelId || message.modelId === modelId
  )
  const visibleMessageIds = new Set(messages.map((message) => message.id))
  const partsByMessageId = Object.fromEntries(
    Object.entries(baseValue.state.partsByMessageId)
      .filter(([messageId]) => visibleMessageIds.has(messageId))
      .map(([messageId, parts]) => [
        messageId,
        parts.map((part) => {
          if (part.type !== 'data-error' || !part.data || typeof part.data !== 'object') return part
          const data = part.data as { message?: unknown }
          if (typeof data.message !== 'string') return part
          return {
            ...part,
            data: {
              ...data,
              message: formatCompareColumnErrorMessage(columnName, data.message, chatModelHint)
            }
          }
        })
      ])
  )
  return {
    ...baseValue,
    actions: {
      ...baseValue.actions,
      bindRuntime: ownsRuntime ? baseValue.actions.bindRuntime : undefined,
      focusCompareModel: onFocusModel,
      removeCompareModel: onRemoveModel
    },
    state: {
      ...baseValue.state,
      messages,
      partsByMessageId,
      renderConfig: {
        ...baseValue.state.renderConfig,
        messageStyle: 'bubble' as const,
        compareMode: true,
        multiModelMessageStyle: 'grid' as const,
        multiModelGridColumns: 1,
        compareLayout: 'columns' as const
      }
    }
  }
}

export default ChatMain
