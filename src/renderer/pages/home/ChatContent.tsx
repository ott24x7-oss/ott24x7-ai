import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'
import { MessageEditingProvider } from '@renderer/components/chat/editing/MessageEditingContext'
import type { TopicMessageFlowLiveState } from '@renderer/components/chat/flow'
import { RefreshProvider } from '@renderer/components/chat/messages/blocks/MessagePartsContext'
import type { MessageListActions, MessageListSelectAllPagination } from '@renderer/components/chat/messages/types'
import { ConversationGreeting } from '@renderer/components/chat/shell/ConversationGreeting'
import ConversationStageCenter from '@renderer/components/chat/shell/ConversationStageCenter'
import type {
  ChatComposerProps,
  ChatComposerResolvedContext,
  ChatContextUsageSource,
  ChatConversationControlsChangeHandler
} from '@renderer/components/composer/variants/ChatComposer'
import { ChatWriteProvider } from '@renderer/hooks/chat/ChatWriteContext'
import { SiblingsProvider } from '@renderer/hooks/SiblingsContext'
import { useTopicMessages } from '@renderer/hooks/useTopicMessages'
import { toast } from '@renderer/services/toast'
import type { CompareColumnId, ComparePageConfig } from '@renderer/types/compare'
import type { Topic } from '@renderer/types/topic'
import type { CherryUIMessage } from '@shared/data/types/message'
import { isUniqueModelId, type UniqueModelId } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'

import ChatComposerSlot from './ChatComposerSlot'
import ChatMain from './ChatMain'
import { useTopicBranchActions } from './hooks/useTopicBranchActions'
import type { AddNewTopicPayload } from './types'
import { useChatRuntimeState } from './useChatRuntimeState'

interface Props {
  topic: Topic
  onOpenCitationsPanel?: MessageListActions['openCitationsPanel']
  onNewTopic?: (payload?: AddNewTopicPayload) => void | Promise<void>
  onCreateEmptyTopic?: (payload?: AddNewTopicPayload) => void | Promise<void>
  locateMessageId?: string
  onLocateMessageHandled?: () => void
  onBranchLiveStateChange?: (state: TopicMessageFlowLiveState | null) => void
  assistantContext?: ChatComposerResolvedContext
  providers?: Provider[]
  onConversationControlsChange?: ChatConversationControlsChangeHandler
  composerModelId?: UniqueModelId
  compare?: ComparePageConfig
}

/**
 * Home chat content.
 *
 * Outer shell — mounts the frame immediately; the shared message list owns the
 * initial-loading view so the composer doesn't disappear during topic switches.
 *
 * `useChatRuntimeState` owns message runtime concerns — stream handoff,
 * execution overlays, and write actions. This page keeps the provider/frame
 * composition visible.
 */
const ChatContent: FC<Props> = ({
  topic,
  onOpenCitationsPanel,
  onNewTopic,
  onCreateEmptyTopic,
  locateMessageId,
  onLocateMessageHandled,
  onBranchLiveStateChange,
  assistantContext,
  providers,
  onConversationControlsChange,
  composerModelId,
  compare
}) => {
  const {
    uiMessages,
    siblingsMap,
    isLoading: isHistoryLoading,
    isStale: isHistoryStale,
    refresh,
    activeNodeId,
    loadOlder,
    hasOlder,
    selectAllPagination,
    mutate: messagesCacheMutate
  } = useTopicMessages(topic.id)

  return (
    <ChatContentInner
      topic={topic}
      onOpenCitationsPanel={onOpenCitationsPanel}
      onNewTopic={onNewTopic}
      onCreateEmptyTopic={onCreateEmptyTopic}
      locateMessageId={locateMessageId}
      onLocateMessageHandled={onLocateMessageHandled}
      onBranchLiveStateChange={onBranchLiveStateChange}
      assistantContext={assistantContext}
      providers={providers}
      onConversationControlsChange={onConversationControlsChange}
      composerModelId={composerModelId}
      compare={compare}
      isHistoryLoading={isHistoryLoading}
      isHistoryStale={isHistoryStale}
      initialMessages={uiMessages}
      uiMessages={uiMessages}
      siblingsMap={siblingsMap}
      refresh={refresh}
      activeNodeId={activeNodeId}
      loadOlder={loadOlder}
      hasOlder={hasOlder}
      selectAllPagination={selectAllPagination}
      messagesCacheMutate={messagesCacheMutate}
    />
  )
}

// ============================================================================
// Inner — keeps composer mounted while history loads
// ============================================================================

interface InnerProps extends Props {
  isHistoryLoading: boolean
  isHistoryStale: boolean
  onBranchLiveStateChange?: (state: TopicMessageFlowLiveState | null) => void
  /** One-time seed for `useChat(messages:)` — consumed on mount only. */
  initialMessages: CherryUIMessage[]
  /** Live DB-backed message list; reactive to SWR refreshes. */
  uiMessages: CherryUIMessage[]
  siblingsMap: ReturnType<typeof useTopicMessages>['siblingsMap']
  refresh: () => Promise<CherryUIMessage[]>
  activeNodeId: string | null
  loadOlder: () => void
  hasOlder: boolean
  selectAllPagination: MessageListSelectAllPagination
  messagesCacheMutate: ReturnType<typeof useTopicMessages>['mutate']
}

const ChatContentInner: FC<InnerProps> = ({
  topic,
  onOpenCitationsPanel,
  onNewTopic,
  onCreateEmptyTopic,
  locateMessageId,
  onLocateMessageHandled,
  onBranchLiveStateChange,
  assistantContext,
  providers,
  onConversationControlsChange,
  composerModelId,
  compare,
  isHistoryLoading,
  isHistoryStale,
  initialMessages,
  uiMessages,
  siblingsMap,
  refresh,
  activeNodeId,
  loadOlder,
  hasOlder,
  selectAllPagination,
  messagesCacheMutate
}) => {
  const { t } = useTranslation()
  const { reserveBranch } = useTopicBranchActions(topic.id)
  const assistant = assistantContext?.assistant
  const locateLoadRequestRef = useRef<string | undefined>(undefined)
  const runtime = useChatRuntimeState({
    topic,
    isHistoryLoading,
    initialMessages,
    uiMessages,
    refresh,
    activeNodeId,
    messagesCacheMutate,
    assistant,
    composerModelId,
    onBranchLiveStateChange
  })
  const sendMessage = runtime.sendMessage
  const continueRequest = compare?.continueRequest
  const sentContinueRequestRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (
      !continueRequest ||
      continueRequest.topicId !== topic.id ||
      sentContinueRequestRef.current === continueRequest.id
    ) {
      return
    }

    sentContinueRequestRef.current = continueRequest.id
    void sendMessage(continueRequest.content)
      .then((sent) => {
        if (sent) compare?.onContinueSent?.(continueRequest.id)
        else {
          sentContinueRequestRef.current = undefined
          compare?.onContinueSent?.(continueRequest.id)
        }
      })
      .catch(() => {
        sentContinueRequestRef.current = undefined
        compare?.onContinueSent?.(continueRequest.id)
      })
  }, [compare, continueRequest, sendMessage, topic.id])

  const handleSend = useCallback(
    async (text: string, options?: Parameters<ChatComposerProps['onSend']>[1]) => {
      if (!compare) return sendMessage(text, options)
      if (compare.sendDisabled) return false
      const [webAndCliResults, apiSent] = await Promise.all([
        compare.onSendText(text),
        compare.sendModels.length > 0
          ? sendMessage(text, {
              ...options,
              mentionedModels: compare.sendModels.map((model) => model.id),
              webSearch: compare.webSearchEnabled
            })
          : Promise.resolve(true)
      ])
      const apiResults = compare.sendModels.map((model) => ({
        columnId: model.id,
        status: apiSent ? ('sent' as const) : ('error' as const),
        reason: apiSent ? undefined : t('compare.send.api_failed')
      }))
      const results = [...webAndCliResults, ...apiResults]
      compare.onDeliveryResults(results)
      const sentCount = results.filter((result) => result.status === 'sent').length
      const signInCount = results.filter((result) => result.status === 'login-needed').length
      const summary = signInCount
        ? signInCount === 1
          ? t('compare.send.summary_sign_in_one', { sent: sentCount, total: results.length })
          : t('compare.send.summary_sign_in_other', { sent: sentCount, total: results.length, count: signInCount })
        : t('compare.send.summary', { sent: sentCount, total: results.length })
      if (results.some((result) => result.status !== 'sent')) toast.warning(summary)
      else toast.success(summary)
      return true
    },
    [compare, sendMessage, t]
  )
  const compareCurrentQuestion = compare?.currentQuestion
  const compareColumns = compare?.columns
  const compareWebSearchEnabled = compare?.webSearchEnabled
  const sendCompareText = compare?.onSendText
  const handleRegenerateCompareModel = useCallback(
    (modelId: CompareColumnId) => {
      if (!compareCurrentQuestion || !compareColumns || !sendCompareText) return
      const column = compareColumns.find((candidate) => candidate.id === modelId)
      if (!column) return
      if (column.kind === 'api') {
        void sendMessage(compareCurrentQuestion, { mentionedModels: [column.id], webSearch: compareWebSearchEnabled })
      } else {
        void sendCompareText(compareCurrentQuestion, [modelId])
      }
    },
    [compareColumns, compareCurrentQuestion, compareWebSearchEnabled, sendCompareText, sendMessage]
  )
  const locateRuntimeMessage = runtime.locateMessage
  const siblingsContextValue = useMemo(() => ({ siblingsMap, activeNodeId }), [siblingsMap, activeNodeId])
  const contextUsage = useMemo<ChatContextUsageSource | null>(() => {
    if (isHistoryStale) return null

    const activeMessage = uiMessages.find((message) => message.id === activeNodeId)
    const contextTokens = activeMessage?.metadata?.stats?.contextTokens
    const modelId = activeMessage?.metadata?.modelId
    if (activeMessage?.role !== 'assistant' || typeof contextTokens !== 'number' || !isUniqueModelId(modelId)) {
      return null
    }
    return { contextTokens, modelId }
  }, [activeNodeId, isHistoryStale, uiMessages])

  useEffect(() => {
    if (!locateMessageId) {
      locateLoadRequestRef.current = undefined
      return
    }

    if (uiMessages.some((message) => message.id === locateMessageId)) {
      locateLoadRequestRef.current = undefined
      window.requestAnimationFrame(() => {
        locateRuntimeMessage(locateMessageId, true)
      })
      onLocateMessageHandled?.()
      return
    }

    if (hasOlder && !isHistoryLoading) {
      const requestKey = `${locateMessageId}:${uiMessages.length}`
      if (locateLoadRequestRef.current !== requestKey) {
        locateLoadRequestRef.current = requestKey
        loadOlder()
      }
      return
    }

    if (!hasOlder && !isHistoryLoading) {
      locateLoadRequestRef.current = undefined
      onLocateMessageHandled?.()
    }
  }, [hasOlder, isHistoryLoading, loadOlder, locateMessageId, locateRuntimeMessage, onLocateMessageHandled, uiMessages])

  const isEmptyConversation = !compare && !isHistoryLoading && runtime.messages.length === 0
  const main = (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {isEmptyConversation && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <ConversationGreeting avatar={assistant?.emoji} title={t('chat.home.welcome_title')} />
        </div>
      )}
      <ChatMain
        key={topic.id}
        topic={topic}
        assistant={assistant}
        messages={runtime.messages}
        partsByMessageId={runtime.partsByMessageId}
        streamingLayers={runtime.streamingLayers}
        onBindRuntime={runtime.bindMessageListRuntime}
        isInitialLoading={isHistoryLoading}
        isMessagesStale={isHistoryStale}
        loadOlder={loadOlder}
        hasOlder={hasOlder}
        selectAllPagination={selectAllPagination}
        openCitationsPanel={onOpenCitationsPanel}
        onStartBranchDraft={reserveBranch}
        compare={compare}
        onRegenerateModel={handleRegenerateCompareModel}
      />
    </div>
  )
  const composerSlot = runtime.shouldRenderHomeComposer ? (
    <ChatComposerSlot
      placement="home"
      topic={topic}
      contextUsage={contextUsage}
      onSend={handleSend}
      placeholder={compare ? t('compare.prompt.placeholder') : undefined}
      modelOptional={Boolean(compare)}
      selectedAiCount={compare?.columns.filter((column) => column.enabled).length}
      sendDisabled={compare?.sendDisabled}
      chatTarget={runtime.composerChatTarget}
      onNewTopic={onNewTopic}
      composerContext={runtime.composerContext}
      assistantContext={assistantContext}
      providers={providers}
      onConversationControlsChange={onConversationControlsChange}
    />
  ) : (
    <ChatComposerSlot
      placement="docked"
      topic={topic}
      contextUsage={contextUsage}
      onSend={handleSend}
      placeholder={compare ? t('compare.prompt.placeholder') : undefined}
      modelOptional={Boolean(compare)}
      selectedAiCount={compare?.columns.filter((column) => column.enabled).length}
      chatTarget={runtime.composerChatTarget}
      onNewTopic={onNewTopic}
      onCreateEmptyTopic={onCreateEmptyTopic}
      sendDisabled={isHistoryLoading || Boolean(compare?.sendDisabled)}
      composerContext={runtime.composerContext}
      assistantContext={assistantContext}
      providers={providers}
      onConversationControlsChange={onConversationControlsChange}
    />
  )
  const composer = compare ? (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-4">
      {compare.sendDisabled && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t('compare.send.blocked_hint')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={compare.subscriptionColumnIds.length === 0}
            onClick={() => {
              void Promise.resolve(compare.onUseSubscriptions(compare.subscriptionColumnIds))
            }}>
            {t('compare.empty.use_subscriptions')}
          </Button>
        </div>
      )}
      {composerSlot}
    </div>
  ) : (
    composerSlot
  )
  const placement = runtime.shouldRenderHomeComposer ? 'home' : 'docked'

  return (
    <ChatWriteProvider value={runtime.chatWriteActions}>
      <SiblingsProvider value={siblingsContextValue}>
        <RefreshProvider value={refresh}>
          <MessageEditingProvider>
            <ConversationStageCenter placement={placement} main={main} composer={composer} />
          </MessageEditingProvider>
        </RefreshProvider>
      </SiblingsProvider>
    </ChatWriteProvider>
  )
}

export default ChatContent
