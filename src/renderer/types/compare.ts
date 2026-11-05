import type { WebviewTag } from 'electron'
import type { ReactNode } from 'react'

import type { Model, UniqueModelId } from '@shared/data/types/model'
import type { CompareCliAvailability, CompareCliId } from '@shared/types/compareCli'

export type CompareLayout = { kind: 'columns'; columns: 1 | 2 | 3 | 4 } | { kind: 'grid' }
export type CompareModelStatus = 'waiting' | 'streaming' | 'done' | 'error'
export type CompareColumnId = UniqueModelId | `webapp::${string}` | `cli::${string}`
export type CompareJudgeId = 'auto' | CompareColumnId
export type CompareDeliveryStatus = 'sent' | 'login-needed' | 'copied' | 'error'

export interface CompareDeliveryResult {
  columnId: CompareColumnId
  status: CompareDeliveryStatus
  reason?: string
}

export interface CompareFinalAnswer {
  question: string
  content: string
  status: 'streaming' | 'done' | 'error'
  judgeId: string
  judgeName: string
  error?: string
}

export interface CompareWebAnswer {
  question: string
  content: string
  status: CompareModelStatus | 'skipped'
}

export interface CompareContinueRequest {
  id: string
  topicId: string
  content: string
}

export type CompareColumn =
  | { id: UniqueModelId; kind: 'api'; model: Model; enabled: boolean }
  | {
      id: `webapp::${string}`
      kind: 'web'
      appId: string
      name: string
      url: string
      miniAppKind: 'site' | 'app'
      logo?: string
      logoSrc?: string
      background?: string
      canReadAnswer?: boolean
      enabled: boolean
    }
  | { id: `cli::${string}`; kind: 'cli'; cliId: CompareCliId; name: string; enabled: boolean }

export interface CompareCliOutput {
  content: string
  status: CompareModelStatus
  error?: string
  requestId?: string
  prompt?: string
}

export interface ComparePageConfig {
  header: ReactNode
  welcomeCard?: ReactNode
  selectedModelIds: readonly CompareColumnId[]
  columns: readonly CompareColumn[]
  runtimeOwnerId?: UniqueModelId
  currentQuestion: string
  sendModels: Model[]
  focusedModelId: CompareColumnId | null
  layout: CompareLayout
  sendDisabled: boolean
  subscriptionColumnIds: CompareColumnId[]
  deliveryStatuses: Readonly<Record<string, CompareDeliveryResult>>
  onSendText: (text: string, targetIds?: readonly CompareColumnId[]) => Promise<CompareDeliveryResult[]>
  onDeliveryResults: (results: readonly CompareDeliveryResult[]) => void
  onFocusModel: (modelId: CompareColumnId | null) => void
  onToggleModel: (modelId: CompareColumnId) => void
  onRemoveModel: (modelId: CompareColumnId) => void
  onReorderModels: (sourceId: CompareColumnId, targetId: CompareColumnId) => void
  onTopicIdChange: (topicId: string | undefined) => void
  onWebviewRef: (appId: string, webview: WebviewTag | null) => void
  webWarnings: Readonly<Record<string, boolean>>
  webAnswers: Readonly<Record<string, CompareWebAnswer>>
  cliOutputs: Readonly<Record<string, CompareCliOutput>>
  cliAvailability: readonly CompareCliAvailability[]
  onCancelCli: (cliId: CompareCliId) => void
  judgeId: CompareJudgeId
  judgeOptions: readonly { id: CompareJudgeId; label: string }[]
  onJudgeChange: (judgeId: CompareJudgeId) => void
  onJudgePickerOpen: () => void
  onOpenHistory: () => void
  onOpenModelPicker: () => void
  onAddColumn: (id: CompareColumnId) => void
  onUseSubscriptions: (ids: CompareColumnId[]) => void
  canCombine: boolean
  onCombine: () => void
  finalAnswer?: CompareFinalAnswer
  onCopyFinalAnswer: () => void
  onUseWebAnswer: (appId: string) => void
  onContinueFromAnswer?: (answer: string) => void
  continueRequest?: CompareContinueRequest
  onContinueSent?: (requestId: string) => void
}
