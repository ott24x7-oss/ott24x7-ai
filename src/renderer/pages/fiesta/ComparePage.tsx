import type { WebviewTag } from 'electron'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cacheService } from '@data/CacheService'
import { useQuery } from '@data/hooks/useDataApi'
import { usePreference } from '@data/hooks/usePreference'
import { loggerService } from '@logger'
import { useDesktopUpdate } from '@renderer/components/app/DesktopUpdateProvider'
import { GuideBanner } from '@renderer/components/app/GuideBanner'
import { ComparePromoFooter } from '@renderer/components/app/PromoCard'
import { getModelDisplayTags } from '@renderer/components/tags/Model'
import { usePersistCache } from '@renderer/data/hooks/useCache'
import { useTabs } from '@renderer/hooks/tab'
import { useGuideChecklist } from '@renderer/hooks/useGuideChecklist'
import { useMiniApps } from '@renderer/hooks/useMiniApps'
import { useModels } from '@renderer/hooks/useModel'
import { useProviders } from '@renderer/hooks/useProvider'
import { useTopicMessages } from '@renderer/hooks/useTopicMessages'
import { ipcApi, useIpcOn } from '@renderer/ipc'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { toast } from '@renderer/services/toast'
import type {
  CompareColumn,
  CompareColumnId,
  CompareCliOutput,
  CompareFinalAnswer,
  CompareDeliveryResult,
  CompareJudgeId,
  CompareLayout,
  ComparePageConfig,
  CompareWebAnswer
} from '@renderer/types/compare'
import { formatCompareColumnErrorMessage } from '@renderer/utils/compareErrorMessage'
import { getMySubscriptionColumnIds } from '@renderer/utils/compareSubscriptions'
import { GUIDE_AUTO_CHECKLIST_ITEMS, markGuideChecklistOnCompareSend } from '@renderer/utils/guide'
import type {
  CacheCompareBackupModelId,
  CacheCompareFinalAnswer,
  CacheCompareModelSelection,
  CacheCompareSavedSet
} from '@shared/data/cache/cacheValueTypes'
import type { Model, UniqueModelId } from '@shared/data/types/model'
import type { CompareCliStreamEvent } from '@shared/ipc/schemas/compareCli'
import type { CompareCliAvailability, CompareCliId } from '@shared/types/compareCli'
import { buildMemoryPreamble } from '@shared/utils/memory'

// eslint-disable-next-line import-x/no-restricted-paths -- Reuse the normal topic and chat-engine lifecycle for Compare.
import HomePage from '../home/HomePage'
import { getAutomaticBackupOrder, getCompareBackupOrder, type BackupCandidate } from './backupModels'
import { buildCompareCliPrompt, type CompareCliTurn } from './cliConversation'
import { canCombine, getCombineSignature, shouldAutoCombine, type CombineResponseStatus } from './combineState'
import { getLatestApiAnswer, getLatestPrompt } from './compareAnswers'
import {
  addCompareColumn,
  buildCompareDefaultSets,
  DEFAULT_COMPARE_CLI_ORDER,
  editCompareSelection,
  getCompareKeyboardAction,
  getCompareSendableColumnIds,
  getCompareSendModelIds,
  getSignedInAiColumnIds,
  isCompareChatModel,
  limitCompareSelection,
  migrateCompareLoginDefaults,
  MAX_COMPARE_COLUMNS,
  removeCompareModel,
  reconcileCompareSelections,
  resolveCompareSavedSetId,
  selectCompareSet,
  resolveCompareJudge,
  reorderCompareModels,
  setCompareModelEnabled,
  SIGNED_IN_COMPARE_SET_ID
} from './compareState'
import { CompareToolbar } from './CompareToolbar'
import { CompareWebPanelHint } from './CompareWebPanelHint'
import { CompareWelcomeCard } from './CompareWelcomeCard'
import { OpenRouterFreeModelsDialog } from './OpenRouterFreeModelsDialog'
import { buildSynthesisPrompt, type SynthesisAnswer } from './synthesisPrompt'
import {
  getWebPanelAdapter,
  mapWebPanelSendStatus,
  readVisibleLastAnswer,
  sendPromptToWebPanel,
  sendPromptToWebPanels,
  waitForVisibleLastAnswer
} from './webPanelAdapters'

interface ActiveCliRequest {
  cliId: CompareCliId
  columnId: CompareColumnId
  originalColumnId?: CompareColumnId
  userPrompt: string
  content: string
}

interface ActiveCombineRequest {
  topicId: string
  question: string
  judgeId: CompareJudgeId
  judgeName: string
  content: string
  resolve: (text: string | null) => void
}

interface ActiveModelCombineRequest {
  topicId: string
  question: string
  judgeId: CompareJudgeId
  judgeName: string
}

interface ActiveCompareTurn {
  id: string
  topicId: string
  question: string
  targetIds: CompareColumnId[]
}

interface CompareAnswerSource extends SynthesisAnswer {
  sourceId: string
}

interface ActiveWebWait {
  appId: string
  topicId: string
  controller: AbortController
}

const CLI_NAMES: Record<CompareCliId, string> = { claude: 'Claude', agy: 'Gemini', codex: 'ChatGPT' }
const compareLogger = loggerService.withContext('ComparePage')

function ComparePage() {
  const { t } = useTranslation()
  const { openFreeModels } = useDesktopUpdate()
  const firstPaintLoggedRef = useRef(false)
  const [selection, setSelection] = usePersistCache('ui.compare.model_selection')
  const [customSelection, setCustomSelection] = usePersistCache('ui.compare.custom_selection')
  const [savedSets, setSavedSets] = usePersistCache('ui.compare.saved_sets')
  const [defaultsSeeded, setDefaultsSeeded] = usePersistCache('ui.compare.defaults_seeded')
  const [loginDefaultsMigrated, setLoginDefaultsMigrated] = usePersistCache('ui.compare.login_defaults_migrated')
  const [welcomeDismissed, setWelcomeDismissed] = usePersistCache('ui.compare.welcome_dismissed')
  const [webPanelHintDismissed, setWebPanelHintDismissed] = usePersistCache('ui.compare.web_panel_hint_dismissed')
  const [judgeIdValue, setJudgeIdValue] = usePersistCache('ui.compare.judge')
  const [backupIds, setBackupIds] = usePersistCache('ui.compare.backup_models')
  const [autoCombine] = usePersistCache('ui.compare.auto_combine')
  const [readWebAnswers] = usePersistCache('ui.compare.read_web_answers')
  const [webSearchEnabled] = usePersistCache('ui.compare.web_search_enabled')
  const {
    markDone: markGuideDone,
    showBanner: showGuideBanner,
    dismissBanner: dismissGuideBanner
  } = useGuideChecklist()
  const [finalAnswers, setFinalAnswers] = usePersistCache('ui.compare.final_answers')
  const [activeSetId, setActiveSetId] = useState('custom')
  const [focusedModelId, setFocusedModelId] = useState<CompareColumnId | null>(null)
  const [onlyFocusedModel] = useState(false)
  const [layout, setLayout] = useState<CompareLayout>({ kind: 'columns', columns: 2 })
  const [apiPickerOpen, setApiPickerOpen] = useState(false)
  const [activeTopicId, setActiveTopicId] = useState<string>()
  const [cliOutputs, setCliOutputs] = useState<Record<string, CompareCliOutput>>({})
  const [webAnswers, setWebAnswers] = useState<Record<string, CompareWebAnswer>>({})
  const [webWarnings, setWebWarnings] = useState<Record<string, boolean>>({})
  const [deliveryStatuses, setDeliveryStatuses] = useState<Record<string, CompareDeliveryResult>>({})
  const [backupAssignments, setBackupAssignments] = useState<Record<string, CompareColumnId>>({})
  const [cliHistory, setCliHistory] = useState<Record<string, CompareCliTurn[]>>({})
  const [combineOutputs, setCombineOutputs] = useState<Record<string, CompareFinalAnswer>>({})
  const [finalAnswerPanelOpen, setFinalAnswerPanelOpen] = useState(false)
  const [activeTurn, setActiveTurn] = useState<ActiveCompareTurn>()
  const [cliAvailability, setCliAvailability] = useState<CompareCliAvailability[]>([])
  const [isCheckingClis, setIsCheckingClis] = useState(false)
  const { openTab } = useTabs()
  const webviewRefs = useRef(new Map<string, WebviewTag>())
  const activeCliRequests = useRef(new Map<string, ActiveCliRequest>())
  const cliBackupAttempts = useRef(new Map<string, Set<string>>())
  const activeCombineRequests = useRef(new Map<string, ActiveCombineRequest>())
  const combineRuns = useRef(new Map<string, string>())
  const activeModelCombineRequests = useRef(new Map<string, ActiveModelCombineRequest>())
  const webWaitControllers = useRef(new Map<string, ActiveWebWait>())
  const lastAutoCombineSignature = useRef<string | undefined>(undefined)
  const finalAnswerPanelDismissed = useRef(false)
  const cliAvailabilityRef = useRef<CompareCliAvailability[] | null>(null)
  const cliAvailabilityRequest = useRef<Promise<CompareCliAvailability[]> | null>(null)

  useEffect(() => {
    if (firstPaintLoggedRef.current) return
    firstPaintLoggedRef.current = true
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const durationMs = Math.round(performance.now())
        compareLogger.info(`Compare first paint in ${durationMs}ms`, { durationMs, logToMain: true })
      })
    })
  }, [])
  const { models, isLoading: modelsLoading } = useModels()
  const { allApps, isLoading: miniAppsLoading, updateAppStatus } = useMiniApps()
  const { providers, isLoading: providersLoading } = useProviders()
  const [memoryEnabled] = usePreference('feature.memory.enabled')
  const { data: memoryNotes = [] } = useQuery('/memories', {})
  const memoryPreamble = useMemo(
    () => (memoryEnabled ? buildMemoryPreamble(memoryNotes) : ''),
    [memoryEnabled, memoryNotes]
  )
  const judgeId = judgeIdValue as CompareJudgeId
  const setJudgeId = useCallback((next: CompareJudgeId) => setJudgeIdValue(next), [setJudgeIdValue])
  const providerById = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers])
  const availableModels = useMemo(
    () => models.filter((model) => isCompareChatModel(model, providerById.get(model.providerId))),
    [models, providerById]
  )
  const availableModelsById = useMemo(
    () => new Map(availableModels.map((model) => [model.id, model])),
    [availableModels]
  )
  const backupCandidates = useMemo<BackupCandidate[]>(
    () =>
      getAutomaticBackupOrder({
        models: availableModels,
        providers,
        availableCliIds: cliAvailability.filter((item) => item.available).map((item) => item.id)
      }),
    [availableModels, cliAvailability, providers]
  )
  const selectedBackupCandidates = useMemo(
    () => getCompareBackupOrder({ configuredIds: backupIds, automaticCandidates: backupCandidates }),
    [backupCandidates, backupIds]
  )
  const backupModels = useMemo(
    () =>
      selectedBackupCandidates.flatMap((candidate) =>
        candidate.kind === 'api' && candidate.model ? [candidate.model] : []
      ),
    [selectedBackupCandidates]
  )
  const columns = useMemo<CompareColumn[]>(() => {
    const appsById = new Map(allApps.map((app) => [app.appId, app]))
    return selection.flatMap((item): CompareColumn[] => {
      if (item.id.startsWith('webapp::')) {
        const appId = decodeWebAppColumnId(item.id)
        if (!appId) return []
        const app = appsById.get(appId)
        if (!app || (app.status !== 'enabled' && app.status !== 'pinned')) return []
        return [
          {
            id: item.id as `webapp::${string}`,
            kind: 'web',
            appId,
            name: app.name,
            url: app.url,
            miniAppKind: app.kind,
            logo: app.logo,
            logoSrc: app.logoSrc,
            background: app.background,
            canReadAnswer: Boolean(getWebPanelAdapter(appId).lastAnswerSelector),
            enabled: item.enabled
          }
        ]
      }
      if (item.id.startsWith('cli::')) {
        const cliId = item.id.slice('cli::'.length) as CompareCliId
        if (!(cliId in CLI_NAMES)) return []
        return [{ id: item.id as `cli::${string}`, kind: 'cli', cliId, name: CLI_NAMES[cliId], enabled: item.enabled }]
      }
      const model = availableModelsById.get(item.id)
      return model ? [{ id: model.id, kind: 'api', model, enabled: item.enabled }] : []
    })
  }, [allApps, availableModelsById, selection])
  const visibleWebJudgeColumns = useMemo(
    () =>
      columns.filter(
        (column): column is Extract<CompareColumn, { kind: 'web' }> =>
          column.kind === 'web' &&
          column.enabled &&
          (!focusedModelId || focusedModelId === column.id) &&
          Boolean(getWebPanelAdapter(column.appId).lastAnswerSelector)
      ),
    [columns, focusedModelId]
  )
  const requestedSendColumnIds = useMemo(
    () => getCompareSendModelIds(selection, focusedModelId, onlyFocusedModel),
    [focusedModelId, onlyFocusedModel, selection]
  )
  const sendColumnIds = useMemo(
    () =>
      getCompareSendableColumnIds(requestedSendColumnIds, columns).filter(
        (id) => !id.startsWith('webapp::') || !focusedModelId || id === focusedModelId
      ),
    [columns, focusedModelId, requestedSendColumnIds]
  )
  const sendModels = useMemo(
    () =>
      sendColumnIds.flatMap((id) =>
        isApiColumnId(id) && availableModelsById.has(id) ? [availableModelsById.get(id)!] : []
      ),
    [availableModelsById, sendColumnIds]
  )
  const freeModels = useMemo(
    () =>
      availableModels.filter((model) => {
        const provider = providerById.get(model.providerId)
        return getModelDisplayTags(model, undefined, provider).includes('free')
      }),
    [availableModels, providerById]
  )
  const subscriptionColumnIds = useMemo(
    () => getMySubscriptionColumnIds(allApps.filter((app) => app.kind === 'site').map((app) => app.appId)),
    [allApps]
  )
  const defaultSets = useMemo<CacheCompareSavedSet[]>(
    () =>
      buildCompareDefaultSets({
        freeModels,
        signedInIds: getSignedInAiColumnIds(
          availableModels.map((model) => model.id),
          cliAvailability.filter((item) => item.available).map((item) => item.id)
        ),
        signedInSetName: t('compare.saved_sets.signed_in_ai'),
        subscriptionIds: subscriptionColumnIds,
        freeSetName: t('compare.saved_sets.free_models'),
        subscriptionsSetName: t('compare.saved_sets.my_subscriptions')
      }),
    [availableModels, cliAvailability, freeModels, subscriptionColumnIds, t]
  )
  const { uiMessages } = useTopicMessages(activeTopicId ?? '', { enabled: Boolean(activeTopicId) })
  const latestPrompt = useMemo(() => getLatestPrompt(uiMessages), [uiMessages])
  const currentQuestion =
    activeTurn && activeTurn.topicId === activeTopicId ? activeTurn.question : (latestPrompt?.question ?? '')
  const currentPrompt = latestPrompt?.question === currentQuestion ? latestPrompt : null
  const initializedSelectionRef = useRef(false)

  const launchCliBackup = useCallback(
    (originalColumnId: CompareColumnId, question: string, reason: string, preferredBackupId?: string) => {
      const originalColumn = columns.find((column) => column.id === originalColumnId)
      if (!originalColumn || originalColumn.kind === 'web') return false
      const key = `${activeTurn?.id ?? question}:${originalColumnId}`
      const attempted = cliBackupAttempts.current.get(key) ?? new Set<string>()
      cliBackupAttempts.current.set(key, attempted)
      if (attempted.size >= 3) return false

      const primaryIds = new Set(columns.filter((column) => column.enabled).map((column) => column.id))
      const backup = selectedBackupCandidates.find(
        (candidate) =>
          candidate.kind === 'cli' &&
          (!preferredBackupId || candidate.id === preferredBackupId) &&
          !primaryIds.has(candidate.id) &&
          !attempted.has(candidate.id)
      )
      if (!backup || !backup.cliId) return false

      attempted.add(backup.id)
      const requestId = crypto.randomUUID()
      const backupName = getCliAccountLabel(backup.cliId, t)
      const originalName = originalColumn.kind === 'api' ? originalColumn.model.name : originalColumn.name
      activeCliRequests.current.set(requestId, {
        cliId: backup.cliId,
        columnId: backup.id,
        originalColumnId,
        userPrompt: question,
        content: ''
      })
      setBackupAssignments((current) => ({ ...current, [originalColumnId]: backup.id }))
      setDeliveryStatuses((current) => ({
        ...current,
        [originalColumnId]: {
          columnId: originalColumnId,
          status: 'sent',
          reason: t('compare.backups.answer_label', {
            backup: backupName,
            original: originalName,
            reason: reason.slice(0, 120)
          })
        }
      }))
      setCliOutputs((current) => ({
        ...current,
        [backup.cliId!]: { content: '', status: 'streaming', requestId, prompt: question }
      }))
      void ipcApi
        .request('compare_cli.run', {
          id: backup.cliId,
          requestId,
          prompt: buildCompareCliPrompt(cliHistory[backup.cliId] ?? [], question, memoryPreamble)
        })
        .catch(() => {
          activeCliRequests.current.delete(requestId)
          setCliOutputs((current) => ({
            ...current,
            [backup.cliId!]: {
              content: '',
              status: 'error',
              error: t('compare.cli.start_failed'),
              prompt: question
            }
          }))
          const retried = launchCliBackup(originalColumnId, question, t('compare.cli.start_failed'))
          if (!retried) {
            setDeliveryStatuses((current) => ({
              ...current,
              [originalColumnId]: {
                columnId: originalColumnId,
                status: 'error',
                reason: `${t('compare.cli.start_failed')} ${t('compare.backups.all_failed')}`
              }
            }))
          }
        })
      return true
    },
    [activeTurn?.id, cliHistory, columns, memoryPreamble, selectedBackupCandidates, t]
  )

  const loadCliAvailability = useCallback(() => {
    if (cliAvailabilityRef.current) return Promise.resolve(cliAvailabilityRef.current)
    if (cliAvailabilityRequest.current) return cliAvailabilityRequest.current

    const request = ipcApi
      .request('compare_cli.available', {})
      .catch(() => [] as CompareCliAvailability[])
      .then((availability) => {
        cliAvailabilityRef.current = availability
        setCliAvailability(availability)
        return availability
      })
      .finally(() => {
        cliAvailabilityRequest.current = null
        setIsCheckingClis(false)
      })
    setIsCheckingClis(true)
    cliAvailabilityRequest.current = request
    return request
  }, [])

  const autoJudgeId = useMemo(
    () =>
      resolveCompareJudge({
        savedJudgeId: 'auto',
        availableCliIds: cliAvailability.filter((item) => item.available).map((item) => item.id),
        visibleWebAppIds: visibleWebJudgeColumns.map((column) => column.appId),
        chatModelIds: availableModels.map((model) => model.id)
      }),
    [availableModels, cliAvailability, visibleWebJudgeColumns]
  )
  const judgeOptions = useMemo(
    () => [
      {
        id: 'auto' as const,
        label:
          autoJudgeId === 'auto'
            ? t('compare.judge.auto')
            : t('compare.judge.auto_resolved', {
                name: getJudgeName(autoJudgeId, columns, availableModelsById, t)
              })
      },
      ...availableModels.map((model) => ({ id: model.id as CompareJudgeId, label: model.name })),
      ...DEFAULT_COMPARE_CLI_ORDER.filter((id) => cliAvailability.some((item) => item.id === id && item.available)).map(
        (id) => ({
          id: `cli::${id}` as CompareJudgeId,
          label: getCliAccountLabel(id, t)
        })
      ),
      ...visibleWebJudgeColumns.map((column) => ({
        id: column.id as CompareJudgeId,
        label: t('compare.judge.web_app', { name: column.name })
      }))
    ],
    [availableModels, availableModelsById, autoJudgeId, cliAvailability, columns, t, visibleWebJudgeColumns]
  )

  const resolveJudge = useCallback(async (): Promise<CompareJudgeId> => {
    const availability = await loadCliAvailability()
    const nextJudgeId = resolveCompareJudge({
      savedJudgeId: judgeId,
      availableCliIds: availability.filter((item) => item.available).map((item) => item.id),
      visibleWebAppIds: visibleWebJudgeColumns.map((column) => column.appId),
      chatModelIds: availableModels.map((model) => model.id)
    })
    return nextJudgeId
  }, [availableModels, judgeId, loadCliAvailability, visibleWebJudgeColumns])

  const handleJudgePickerOpen = useCallback(() => {
    void loadCliAvailability()
  }, [loadCliAvailability])
  const handleJudgeChange = useCallback(
    (nextJudgeId: CompareJudgeId) => {
      setJudgeId(nextJudgeId)
    },
    [setJudgeId]
  )

  const answerSources = useMemo<CompareAnswerSource[]>(() => {
    if (!currentQuestion) return []

    const sources: CompareAnswerSource[] = []
    for (const column of columns) {
      if (!column.enabled) continue
      if (column.kind === 'api') {
        const answerId = backupAssignments[column.id] ?? column.id
        const answerModelId = answerId
        const answer = answerId.startsWith('cli::')
          ? undefined
          : getLatestApiAnswer(uiMessages, currentPrompt, answerModelId)
        if (answer?.content) {
          const answerModel = availableModelsById.get(answerModelId)
          sources.push({
            sourceId: column.id,
            modelName: answerModel ? `${answerModel.name} (backup)` : column.model.name,
            content: answer.content
          })
        }
      } else if (column.kind === 'cli') {
        const answerId = backupAssignments[column.id] ?? column.id
        const answer = answerId.startsWith('cli::') ? cliOutputs[answerId.slice('cli::'.length)] : undefined
        if (answer?.prompt === currentQuestion && answer.content) {
          const answerName = answerId.startsWith('cli::')
            ? getCliAccountLabel(answerId.slice('cli::'.length) as CompareCliId, t)
            : column.name
          sources.push({
            sourceId: column.id,
            modelName: answerId === column.id ? column.name : `${answerName} (backup)`,
            content: answer.content
          })
        }
      } else {
        const answer = webAnswers[column.appId]
        if (answer?.question === currentQuestion && answer.content) {
          sources.push({ sourceId: column.id, modelName: column.name, content: answer.content })
        }
      }
    }
    return sources
  }, [
    availableModelsById,
    backupAssignments,
    cliOutputs,
    columns,
    currentPrompt,
    currentQuestion,
    t,
    uiMessages,
    webAnswers
  ])

  const activeTurnStatuses = useMemo<CombineResponseStatus[]>(() => {
    if (!activeTurn || activeTurn.topicId !== activeTopicId || activeTurn.question !== currentQuestion) return []

    return activeTurn.targetIds.map((id): CombineResponseStatus => {
      const column = columns.find((candidate) => candidate.id === id)
      if (!column) return 'skipped'
      if (column.kind === 'api') {
        const answerId = backupAssignments[column.id] ?? column.id
        if (answerId.startsWith('cli::')) {
          const output = cliOutputs[answerId.slice('cli::'.length)]
          return output?.prompt === currentQuestion ? output.status : 'waiting'
        }
        return getLatestApiAnswer(uiMessages, currentPrompt, answerId)?.status ?? 'waiting'
      }
      if (column.kind === 'cli') {
        const answerId = backupAssignments[column.id] ?? column.id
        const output = answerId.startsWith('cli::') ? cliOutputs[answerId.slice('cli::'.length)] : undefined
        return output?.prompt === currentQuestion ? output.status : 'waiting'
      }
      const answer = webAnswers[column.appId]
      if (answer?.question === currentQuestion) return answer.status
      return readWebAnswers ? 'waiting' : 'skipped'
    })
  }, [
    activeTurn,
    activeTopicId,
    cliOutputs,
    columns,
    currentPrompt,
    currentQuestion,
    readWebAnswers,
    uiMessages,
    webAnswers,
    backupAssignments
  ])

  const canCombineAnswers = canCombine(answerSources.length)
  const liveFinalAnswer = activeTopicId ? combineOutputs[activeTopicId] : undefined
  const savedFinalAnswer = activeTopicId ? finalAnswers[activeTopicId] : undefined
  const finalAnswer = useMemo<CompareFinalAnswer | undefined>(() => {
    if (liveFinalAnswer?.question === currentQuestion) return liveFinalAnswer
    if (savedFinalAnswer?.question === currentQuestion) {
      return { ...savedFinalAnswer, status: 'done', judgeName: savedFinalAnswer.judgeName }
    }
    return undefined
  }, [currentQuestion, liveFinalAnswer, savedFinalAnswer])

  useEffect(() => {
    finalAnswerPanelDismissed.current = false
    setFinalAnswerPanelOpen(false)
  }, [activeTopicId])

  useEffect(() => {
    if (finalAnswer && !finalAnswerPanelDismissed.current) setFinalAnswerPanelOpen(true)
  }, [finalAnswer])

  const handleCloseFinalAnswer = useCallback(() => {
    finalAnswerPanelDismissed.current = true
    setFinalAnswerPanelOpen(false)
  }, [])

  const completeCombine = useCallback(
    (topicId: string, question: string, content: string, judgeId: CompareJudgeId, judgeName: string) => {
      const output: CompareFinalAnswer = { question, content, status: 'done', judgeId, judgeName }
      setCombineOutputs((current) => ({ ...current, [topicId]: output }))
      const stored: CacheCompareFinalAnswer = { question, content, judgeId, judgeName, updatedAt: Date.now() }
      setFinalAnswers((current) => ({ ...current, [topicId]: stored }))
    },
    [setFinalAnswers]
  )

  const setCombineError = useCallback(
    (topicId: string, question: string, judgeId: CompareJudgeId, judgeName: string) => {
      setCombineOutputs((current) => ({
        ...current,
        [topicId]: {
          question,
          content: current[topicId]?.question === question ? current[topicId].content : '',
          status: 'error',
          judgeId,
          judgeName,
          error: t('compare.combine.failed')
        }
      }))
    },
    [t]
  )

  const handleCombine = useCallback(async () => {
    if (!activeTopicId || !currentQuestion) return
    if (!canCombine(answerSources.length)) {
      if (finalAnswer) {
        finalAnswerPanelDismissed.current = false
        setFinalAnswerPanelOpen(true)
      }
      return
    }
    finalAnswerPanelDismissed.current = false
    setFinalAnswerPanelOpen(true)
    const topicId = activeTopicId
    const question = currentQuestion
    const sourceIds =
      activeTurn?.topicId === topicId ? activeTurn.targetIds : answerSources.map((answer) => answer.sourceId)
    const signature = getCombineSignature(topicId, question, sourceIds, activeTurn?.id)
    lastAutoCombineSignature.current = signature

    const resolvedJudgeId = await resolveJudge()
    if (resolvedJudgeId === 'auto') {
      setCombineError(topicId, question, resolvedJudgeId, '')
      return
    }
    markGuideDone(GUIDE_AUTO_CHECKLIST_ITEMS.firstCombine)

    const judgeName = getJudgeName(resolvedJudgeId, columns, availableModelsById, t)
    const synthesisPrompt = buildSynthesisPrompt(question, answerSources)
    const existingCombine = [...activeCombineRequests.current.entries()].find(
      ([, request]) => request.topicId === topicId
    )
    if (existingCombine) {
      const [requestId, request] = existingCombine
      void ipcApi.request('compare_cli.cancel', { requestId }).catch(() => {})
      activeCombineRequests.current.delete(requestId)
      request.resolve(null)
    }
    for (const [requestId, request] of activeModelCombineRequests.current) {
      if (request.topicId !== topicId) continue
      activeModelCombineRequests.current.delete(requestId)
      void ipcApi.request('ai.text.abort', { requestId }).catch(() => {})
    }
    setCombineOutputs((current) => ({
      ...current,
      [topicId]: { question, content: '', status: 'streaming', judgeId: resolvedJudgeId, judgeName }
    }))

    const runId = crypto.randomUUID()
    combineRuns.current.set(topicId, runId)
    const isCurrent = () => combineRuns.current.get(topicId) === runId

    const runCliJudge = (cliId: CompareCliId, candidateId: CompareJudgeId, candidateName: string) =>
      new Promise<string | null>((resolve) => {
        const requestId = crypto.randomUUID()
        activeCombineRequests.current.set(requestId, {
          topicId,
          question,
          judgeId: candidateId,
          judgeName: candidateName,
          content: '',
          resolve
        })
        void ipcApi.request('compare_cli.run', { id: cliId, requestId, prompt: synthesisPrompt }).catch(() => {
          activeCombineRequests.current.delete(requestId)
          resolve(null)
        })
      })

    const runApiJudge = async (candidateId: UniqueModelId, candidateName: string) => {
      const requestId = crypto.randomUUID()
      activeModelCombineRequests.current.set(requestId, {
        topicId,
        question,
        judgeId: candidateId,
        judgeName: candidateName
      })
      try {
        const { text } = await ipcApi.request('ai.text.generate', {
          requestId,
          uniqueModelId: candidateId,
          prompt: synthesisPrompt,
          reasoningEffort: 'none'
        })
        return activeModelCombineRequests.current.has(requestId) ? text : null
      } catch {
        return null
      } finally {
        activeModelCombineRequests.current.delete(requestId)
      }
    }

    const runWebJudge = async (candidateId: CompareJudgeId, candidateName: string) => {
      const webColumn = columns.find(
        (column): column is Extract<CompareColumn, { kind: 'web' }> =>
          column.kind === 'web' && column.id === candidateId && (!focusedModelId || focusedModelId === column.id)
      )
      const webview = webColumn ? webviewRefs.current.get(webColumn.appId) : undefined
      if (!webColumn || !webview || !getWebPanelAdapter(webColumn.appId).lastAnswerSelector) return null

      const waitKey = `combine:${topicId}`
      const controller = new AbortController()
      webWaitControllers.current.get(waitKey)?.controller.abort()
      webWaitControllers.current.set(waitKey, { appId: webColumn.appId, topicId, controller })
      try {
        const previousText = await readVisibleLastAnswer(webview, webColumn.appId)
        if (controller.signal.aborted) return null
        if ((await sendPromptToWebPanel(webview, webColumn.appId, synthesisPrompt)) !== 'sent') return null
        const answer = await waitForVisibleLastAnswer(
          webview,
          webColumn.appId,
          previousText,
          (content) => {
            if (!isCurrent()) return
            setCombineOutputs((current) => ({
              ...current,
              [topicId]: { question, content, status: 'streaming', judgeId: candidateId, judgeName: candidateName }
            }))
          },
          { signal: controller.signal }
        )
        return controller.signal.aborted ? null : answer
      } catch {
        return null
      } finally {
        if (webWaitControllers.current.get(waitKey)?.controller === controller)
          webWaitControllers.current.delete(waitKey)
      }
    }

    // If the judge fails (signed out, model not on the plan, ...), a model that just answered takes over.
    // Web panels are never used as a fallback: typing the judge prompt there would disturb the user's chat.
    const judgeCandidates = [
      ...new Set<CompareJudgeId>([
        resolvedJudgeId,
        ...selectedBackupCandidates.map((candidate) => candidate.id as CompareJudgeId),
        ...answerSources
          .map((source) => source.sourceId as CompareJudgeId)
          .filter((sourceId) => !sourceId.startsWith('webapp::'))
      ])
    ]
    for (const candidateId of judgeCandidates) {
      if (!isCurrent()) return
      const candidateName =
        candidateId === resolvedJudgeId ? judgeName : getJudgeName(candidateId, columns, availableModelsById, t)
      setCombineOutputs((current) => ({
        ...current,
        [topicId]: { question, content: '', status: 'streaming', judgeId: candidateId, judgeName: candidateName }
      }))
      const text = candidateId.startsWith('cli::')
        ? await runCliJudge(candidateId.slice('cli::'.length) as CompareCliId, candidateId, candidateName)
        : isApiColumnId(candidateId as CompareColumnId)
          ? await runApiJudge(candidateId as UniqueModelId, candidateName)
          : await runWebJudge(candidateId, candidateName)
      if (!isCurrent()) return
      if (text?.trim()) {
        completeCombine(topicId, question, text, candidateId, candidateName)
        return
      }
    }
    if (isCurrent()) setCombineError(topicId, question, resolvedJudgeId, judgeName)
  }, [
    activeTopicId,
    activeTurn,
    answerSources,
    availableModelsById,
    columns,
    completeCombine,
    currentQuestion,
    focusedModelId,
    finalAnswer,
    markGuideDone,
    resolveJudge,
    selectedBackupCandidates,
    setCombineError,
    t
  ])

  const handleCliEvent = useCallback(
    (event: CompareCliStreamEvent) => {
      const combineRequest = activeCombineRequests.current.get(event.requestId)
      if (combineRequest && combineRequest.judgeId === `cli::${event.cliId}`) {
        if (event.type === 'delta') {
          combineRequest.content += event.text
          setCombineOutputs((current) => ({
            ...current,
            [combineRequest.topicId]: {
              question: combineRequest.question,
              content: combineRequest.content,
              status: 'streaming',
              judgeId: combineRequest.judgeId,
              judgeName: combineRequest.judgeName
            }
          }))
        } else {
          combineRequest.resolve(event.type === 'done' ? combineRequest.content : null)
        }
        if (event.type !== 'delta') activeCombineRequests.current.delete(event.requestId)
        return
      }

      const active = activeCliRequests.current.get(event.requestId)
      if (!active || active.cliId !== event.cliId) return
      if (event.type === 'delta') {
        active.content += event.text
        setCliOutputs((current) => ({
          ...current,
          [active.cliId]: {
            ...current[active.cliId],
            content: active.content,
            status: 'streaming',
            requestId: event.requestId
          }
        }))
        return
      }
      const answerColumnId = active.originalColumnId ?? active.columnId
      if (event.type === 'done') {
        setCliHistory((current) => ({
          ...current,
          [active.cliId]: [
            ...(current[active.cliId] ?? []),
            { role: 'user', content: active.userPrompt },
            { role: 'assistant', content: active.content }
          ]
        }))
        setCliOutputs((current) => ({
          ...current,
          [active.cliId]: { content: active.content, status: 'done', prompt: active.userPrompt }
        }))
      } else if (event.type === 'cancelled') {
        setCliOutputs((current) => ({
          ...current,
          [active.cliId]: { content: active.content, status: 'waiting', prompt: active.userPrompt }
        }))
      } else {
        const message =
          event.code === 'launch'
            ? t('compare.cli.start_failed')
            : event.code === 'timeout'
              ? t('compare.cli.timeout')
              : t('compare.cli.failed')
        setCliOutputs((current) => ({
          ...current,
          [active.cliId]: { content: active.content, status: 'error', error: message, prompt: active.userPrompt }
        }))
        const failedColumn = columns.find(
          (column): column is Extract<CompareColumn, { kind: 'api' | 'cli' }> =>
            (column.kind === 'api' || column.kind === 'cli') && column.id === answerColumnId
        )
        if (failedColumn) {
          const failedName = failedColumn.kind === 'api' ? failedColumn.model.name : failedColumn.name
          const reason = formatCompareColumnErrorMessage(failedName, message, t('compare.api.chat_model_required'))
          const retried = launchCliBackup(answerColumnId, active.userPrompt, message)
          setDeliveryStatuses((current) => ({
            ...current,
            [failedColumn.id]: {
              columnId: failedColumn.id,
              status: retried ? 'sent' : 'error',
              reason: retried ? current[failedColumn.id]?.reason : `${reason} ${t('compare.backups.all_failed')}`
            }
          }))
          setCliOutputs((current) => ({
            ...current,
            [active.cliId]: { content: active.content, status: 'error', error: reason, prompt: active.userPrompt }
          }))
        }
      }
      activeCliRequests.current.delete(event.requestId)
    },
    [columns, launchCliBackup, t]
  )
  useIpcOn('compare_cli.stream', handleCliEvent)
  const handleFocusShortcut = useCallback(
    ({ key, ctrlKey }: { key: string; ctrlKey: boolean }) => {
      const action = getCompareKeyboardAction(
        key,
        ctrlKey,
        focusedModelId,
        columns.map((column) => column.id)
      )
      if (action?.type === 'focus-model') setFocusedModelId(action.modelId)
      else if (action?.type === 'exit-focus') setFocusedModelId(null)
    },
    [columns, focusedModelId]
  )
  useIpcOn('compare.focus_shortcut', handleFocusShortcut)

  const handleSendText = useCallback(
    async (text: string, targetOverride?: readonly CompareColumnId[]) => {
      if (targetOverride === undefined) cliBackupAttempts.current.clear()
      const requestedIds = new Set(targetOverride ?? sendColumnIds)
      const selectedForSend = new Set(
        [...requestedIds].filter((id) => {
          const column = columns.find((candidate) => candidate.id === id)
          return column?.enabled && (!id.startsWith('webapp::') || !focusedModelId || focusedModelId === id)
        })
      )
      const targetIds = [...selectedForSend]
      if (targetIds.length === 0) return []
      if (backupIds.length === 0) await loadCliAvailability()
      markGuideChecklistOnCompareSend(targetIds, markGuideDone)

      for (const wait of webWaitControllers.current.values()) wait.controller.abort()
      webWaitControllers.current.clear()

      const visibleWebColumns = columns.filter(
        (column): column is Extract<CompareColumn, { kind: 'web' }> =>
          column.kind === 'web' && column.enabled && selectedForSend.has(column.id)
      )
      const turn: ActiveCompareTurn = {
        id: crypto.randomUUID(),
        topicId: activeTopicId ?? '',
        question: text,
        targetIds
      }
      setActiveTurn(turn)
      lastAutoCombineSignature.current = undefined
      setWebAnswers((current) => {
        const next = { ...current }
        for (const column of visibleWebColumns) {
          const canRead = readWebAnswers && Boolean(getWebPanelAdapter(column.appId).lastAnswerSelector)
          next[column.appId] = { question: text, content: '', status: canRead ? 'waiting' : 'skipped' }
        }
        return next
      })

      const webTargets = visibleWebColumns.flatMap((column) => {
        const webview = webviewRefs.current.get(column.appId)
        return webview ? [{ appId: column.appId, webview }] : []
      })
      const missingWebColumns = visibleWebColumns.filter((column) => !webviewRefs.current.has(column.appId))
      const previousAnswers = new Map<string, string>()
      if (readWebAnswers) {
        await Promise.all(
          webTargets.map(async ({ appId, webview }) => {
            if (!getWebPanelAdapter(appId).lastAnswerSelector) return
            try {
              previousAnswers.set(appId, await readVisibleLastAnswer(webview, appId))
            } catch {
              previousAnswers.set(appId, '')
            }
          })
        )
      }

      const copyPrompt = async (prompt: string) => {
        try {
          await navigator.clipboard.writeText(prompt)
        } catch {
          const textarea = document.createElement('textarea')
          textarea.value = prompt
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          textarea.remove()
        }
      }
      const webResults = await sendPromptToWebPanels(webTargets, text, copyPrompt)
      if (missingWebColumns.length > 0) {
        if (webResults.every((result) => result.status === 'sent')) await copyPrompt(text)
        webResults.push(
          ...missingWebColumns.map((column) => ({ appId: column.appId, status: 'input-not-found' as const }))
        )
      }
      setWebWarnings((current) => ({
        ...current,
        ...Object.fromEntries(webResults.map((result) => [result.appId, result.status !== 'sent']))
      }))

      for (const result of webResults) {
        const column = visibleWebColumns.find((candidate) => candidate.appId === result.appId)
        if (!column) continue
        const delivery: CompareDeliveryResult = {
          columnId: column.id,
          status: mapWebPanelSendStatus(result.status),
          reason: result.status === 'input-not-found' ? t('compare.delivery.input_not_found') : undefined
        }
        setDeliveryStatuses((current) => ({ ...current, [column.id]: delivery }))
        const canRead = readWebAnswers && Boolean(getWebPanelAdapter(column.appId).lastAnswerSelector)
        if (result.status !== 'sent' || !canRead) {
          setWebAnswers((current) => ({
            ...current,
            [column.appId]: {
              question: text,
              content: '',
              status: result.status === 'sent' ? 'skipped' : 'error'
            }
          }))
          continue
        }

        const webview = webviewRefs.current.get(column.appId)
        if (!webview) continue
        const waitKey = `${turn.id}:${column.appId}`
        const controller = new AbortController()
        webWaitControllers.current.set(waitKey, { appId: column.appId, topicId: turn.topicId, controller })
        void waitForVisibleLastAnswer(
          webview,
          column.appId,
          previousAnswers.get(column.appId) ?? '',
          (content) =>
            setWebAnswers((current) => ({
              ...current,
              [column.appId]: { question: text, content, status: 'streaming' }
            })),
          { signal: controller.signal }
        )
          .then((content) => {
            if (controller.signal.aborted) {
              setWebAnswers((current) => ({
                ...current,
                [column.appId]: { question: text, content: '', status: 'skipped' }
              }))
              return
            }
            setWebAnswers((current) => ({
              ...current,
              [column.appId]: {
                question: text,
                content: content ?? current[column.appId]?.content ?? '',
                status: content ? 'done' : 'error'
              }
            }))
          })
          .catch(() => {
            setWebAnswers((current) => ({
              ...current,
              [column.appId]: { question: text, content: '', status: 'error' }
            }))
          })
          .finally(() => webWaitControllers.current.delete(waitKey))
      }

      const cliDeliveryResults = await Promise.all(
        targetIds.flatMap((id) => {
          const column = columns.find(
            (candidate): candidate is Extract<CompareColumn, { kind: 'cli' }> =>
              candidate.kind === 'cli' && candidate.id === id
          )
          if (!column) return []
          const existing = cliOutputs[column.cliId]
          if (existing?.requestId) {
            void ipcApi.request('compare_cli.cancel', { requestId: existing.requestId }).catch(() => {})
            activeCliRequests.current.delete(existing.requestId)
          }
          const requestId = crypto.randomUUID()
          const prompt = buildCompareCliPrompt(cliHistory[column.cliId] ?? [], text, memoryPreamble)
          activeCliRequests.current.set(requestId, {
            cliId: column.cliId,
            columnId: column.id,
            userPrompt: text,
            content: ''
          })
          setCliOutputs((current) => ({
            ...current,
            [column.cliId]: { content: '', status: 'streaming', requestId, prompt: text }
          }))
          return [
            ipcApi
              .request('compare_cli.run', { id: column.cliId, requestId, prompt })
              .then<CompareDeliveryResult, CompareDeliveryResult>(
                () => ({ columnId: column.id, status: 'sent' }),
                () => {
                  activeCliRequests.current.delete(requestId)
                  const reason = formatCompareColumnErrorMessage(
                    column.name,
                    t('compare.cli.start_failed'),
                    t('compare.api.chat_model_required')
                  )
                  setCliOutputs((current) => ({
                    ...current,
                    [column.cliId]: {
                      content: current[column.cliId]?.content ?? '',
                      status: 'error',
                      error: reason,
                      prompt: text
                    }
                  }))
                  const retried = launchCliBackup(column.id, text, reason)
                  return retried
                    ? { columnId: column.id, status: 'sent' }
                    : { columnId: column.id, status: 'error', reason: `${reason} ${t('compare.backups.all_failed')}` }
                }
              )
          ]
        })
      )
      const webDeliveryResults = webResults.flatMap((result) => {
        const column = visibleWebColumns.find((candidate) => candidate.appId === result.appId)
        return column
          ? [
              {
                columnId: column.id,
                status: mapWebPanelSendStatus(result.status),
                reason: result.status === 'input-not-found' ? t('compare.delivery.input_not_found') : undefined
              } satisfies CompareDeliveryResult
            ]
          : []
      })
      const deliveryResults = [...webDeliveryResults, ...cliDeliveryResults]
      setDeliveryStatuses((current) => ({
        ...current,
        ...Object.fromEntries(deliveryResults.map((result) => [result.columnId, result]))
      }))
      void resolveJudge()
      return deliveryResults
    },
    [
      activeTopicId,
      cliHistory,
      cliOutputs,
      columns,
      focusedModelId,
      loadCliAvailability,
      launchCliBackup,
      markGuideDone,
      memoryPreamble,
      backupIds,
      readWebAnswers,
      resolveJudge,
      sendColumnIds,
      t
    ]
  )

  const handleUseWebAnswer = useCallback(
    async (appId: string) => {
      const column = columns.find(
        (candidate): candidate is Extract<CompareColumn, { kind: 'web' }> =>
          candidate.kind === 'web' && candidate.appId === appId && (!focusedModelId || candidate.id === focusedModelId)
      )
      const webview = webviewRefs.current.get(appId)
      const question =
        activeTurn && activeTurn.topicId === activeTopicId ? activeTurn.question : (latestPrompt?.question ?? '')
      if (!column || !webview || !question) return

      try {
        const content = await readVisibleLastAnswer(webview, appId)
        if (!content) {
          toast.error(t('compare.web.read_failed'))
          return
        }
        setWebAnswers((current) => ({ ...current, [appId]: { question, content, status: 'done' } }))
      } catch {
        toast.error(t('compare.web.read_failed'))
      }
    },
    [activeTurn, activeTopicId, columns, focusedModelId, latestPrompt?.question, t]
  )

  const handleCopyFinalAnswer = useCallback(() => {
    if (!finalAnswer?.content) return
    void navigator.clipboard
      .writeText(finalAnswer.content)
      .catch(() => toast.error(t('compare.final_answer.copy_failed')))
  }, [finalAnswer?.content, t])

  const handleCancelCli = useCallback(
    (cliId: CompareCliId) => {
      const run = cliOutputs[cliId]
      if (run?.requestId) void ipcApi.request('compare_cli.cancel', { requestId: run.requestId }).catch(() => {})
    },
    [cliOutputs]
  )
  const handleSelectionChange = useCallback(
    (next: CacheCompareModelSelection[]) => {
      const nextState = editCompareSelection(next)
      setSelection(nextState.selection)
      setCustomSelection(nextState.customSelection)
      setActiveSetId(nextState.activeSetId)
    },
    [setCustomSelection, setSelection]
  )
  const handleRemoveModel = useCallback(
    (modelId: CompareColumnId) => handleSelectionChange(removeCompareModel(selection, modelId)),
    [handleSelectionChange, selection]
  )
  const handleToggleModel = useCallback(
    (modelId: CompareColumnId) => {
      const current = selection.find((item) => item.id === modelId)
      if (current) handleSelectionChange(setCompareModelEnabled(selection, modelId, !current.enabled))
    },
    [handleSelectionChange, selection]
  )
  const handleReorderModels = useCallback(
    (sourceId: CompareColumnId, targetId: CompareColumnId) =>
      handleSelectionChange(reorderCompareModels(selection, sourceId, targetId)),
    [handleSelectionChange, selection]
  )
  const handleAddColumn = useCallback(
    (id: CompareColumnId) => handleSelectionChange(addCompareColumn(selection, id)),
    [handleSelectionChange, selection]
  )
  const handleUseSubscriptions = useCallback(
    async (ids: CompareColumnId[], nextActiveSetId = 'custom') => {
      const appsById = new Map(allApps.map((app) => [app.appId, app]))
      const appsToEnable = ids.flatMap((id) => {
        const appId = decodeWebAppColumnId(id)
        const app = appId ? appsById.get(appId) : undefined
        return app?.status === 'disabled' ? [app] : []
      })
      try {
        await Promise.all(appsToEnable.map((app) => updateAppStatus(app.appId, 'enabled')))
        const nextSelection = limitCompareSelection(ids.map((id) => ({ id, enabled: true })))
        setSelection(nextSelection)
        if (nextActiveSetId === 'custom') setCustomSelection(nextSelection)
        setActiveSetId(nextActiveSetId)
      } catch {
        toast.error(t('common.error'))
      }
    },
    [allApps, setCustomSelection, setSelection, t, updateAppStatus]
  )
  const handleDeliveryResults = useCallback((results: readonly CompareDeliveryResult[]) => {
    setDeliveryStatuses((current) => ({
      ...current,
      ...Object.fromEntries(results.map((result) => [result.columnId, result]))
    }))
  }, [])
  const handleBackupStart = useCallback(
    (originalModelId: CompareColumnId, backupModelId: CompareColumnId, reason: string) => {
      const originalColumn = columns.find((column) => column.id === originalModelId)
      const backupModel = availableModelsById.get(backupModelId)
      const backupName =
        backupModel?.name ??
        (backupModelId.startsWith('cli::')
          ? getCliAccountLabel(backupModelId.slice(6) as CompareCliId, t)
          : backupModelId)
      const originalName =
        originalColumn?.kind === 'api' || originalColumn?.kind === 'cli'
          ? originalColumn.kind === 'api'
            ? originalColumn.model.name
            : originalColumn.name
          : originalModelId
      setBackupAssignments((current) => ({ ...current, [originalModelId]: backupModelId }))
      if (originalColumn) {
        setDeliveryStatuses((current) => ({
          ...current,
          [originalModelId]: {
            columnId: originalModelId,
            status: 'sent',
            reason: t('compare.backups.answer_label', {
              backup: backupName,
              original: originalName,
              reason: reason.slice(0, 120)
            })
          }
        }))
      }
    },
    [availableModelsById, columns, t]
  )
  const handleBackupExhausted = useCallback(
    (originalModelId: CompareColumnId, reason: string) => {
      setDeliveryStatuses((current) => ({
        ...current,
        [originalModelId]: {
          columnId: originalModelId,
          status: 'error',
          reason: `${reason.slice(0, 120)} ${t('compare.backups.all_failed')}`
        }
      }))
    },
    [t]
  )
  const handleCliBackupRequest = useCallback(
    (originalModelId: UniqueModelId, backupId: CompareColumnId, reason: string) => {
      void launchCliBackup(originalModelId, currentQuestion, reason, backupId)
    },
    [currentQuestion, launchCliBackup]
  )
  const handleOpenHistory = useCallback(() => {
    void EventEmitter.emit(EVENT_NAMES.COMPARE_OPEN_HISTORY)
  }, [])
  const handleOpenModelPicker = useCallback(() => setApiPickerOpen(true), [])
  const handleSignIn = useCallback(
    (target: 'openai-codex' | 'claude-code' | 'gemini-cli') => {
      setApiPickerOpen(false)
      openTab(target === 'gemini-cli' ? '/code?tool=antigravity-cli' : `/settings/provider?id=${target}`)
    },
    [openTab]
  )
  const handleApiPickerOpenChange = useCallback(
    (open: boolean) => {
      setApiPickerOpen(open)
      if (open) void loadCliAvailability()
    },
    [loadCliAvailability]
  )
  const handleWebviewRef = useCallback((appId: string, webview: WebviewTag | null) => {
    if (webview) webviewRefs.current.set(appId, webview)
    else webviewRefs.current.delete(appId)
  }, [])
  const handleSelectSet = useCallback(
    (setId: string) => {
      const resolvedSetId = resolveCompareSavedSetId(setId)
      const sets = [...defaultSets, ...savedSets]
      const state = { selection, customSelection, activeSetId }
      if (resolvedSetId === 'custom') {
        const nextState = selectCompareSet(state, 'custom', sets)
        setSelection(nextState.selection)
        setActiveSetId(nextState.activeSetId)
        setFocusedModelId(null)
        return
      }
      const selectedSet = sets.find((set) => set.id === resolvedSetId)
      if (!selectedSet) {
        setActiveSetId('custom')
        return
      }
      if (resolvedSetId === 'my-subscriptions') {
        void handleUseSubscriptions(
          selectedSet.selection.map((item) => item.id),
          resolvedSetId
        )
      } else {
        const nextState = selectCompareSet(state, resolvedSetId, sets)
        setSelection(nextState.selection)
        setActiveSetId(nextState.activeSetId)
      }
      setFocusedModelId(null)
    },
    [activeSetId, customSelection, defaultSets, handleUseSubscriptions, savedSets, selection, setSelection]
  )
  const handleSaveSet = useCallback(
    (name: string) => {
      const set: CacheCompareSavedSet = {
        id: crypto.randomUUID(),
        name,
        selection: selection.map((item) => ({ ...item }))
      }
      setSavedSets((current) => [...current, set])
      setActiveSetId(set.id)
    },
    [selection, setSavedSets]
  )

  useEffect(() => {
    if (modelsLoading || providersLoading || miniAppsLoading || initializedSelectionRef.current) return
    let cancelled = false
    const initializeSelection = async () => {
      const availability = await loadCliAvailability()
      if (cancelled) return
      const reconciled = reconcileCompareSelections({
        // Other windows can create the persist cache first, so seed whenever Compare is still empty.
        isFreshProfile: true,
        defaultsSeeded,
        selection,
        savedSets,
        chatModelIds: availableModels.map((model) => model.id),
        webAppIds: allApps.map((app) => app.appId),
        cliIds: availability.filter((item) => item.available).map((item) => item.id),
        subscriptionAppIds: allApps
          .filter((app) => app.kind === 'site' && (app.status === 'enabled' || app.status === 'pinned'))
          .map((app) => app.appId),
        judgeId,
        savedSetName: t('compare.saved_sets.my_subscriptions'),
        signedInSetName: t('compare.saved_sets.signed_in_ai')
      })
      initializedSelectionRef.current = true
      const migrated = !loginDefaultsMigrated
        ? migrateCompareLoginDefaults({
            selection: reconciled.selection,
            savedSets: reconciled.savedSets,
            signedInSelection: getSignedInAiColumnIds(
              availableModels.map((model) => model.id),
              availability.filter((item) => item.available).map((item) => item.id)
            ).map((id) => ({ id, enabled: true })),
            oldWebSelection: subscriptionColumnIds.map((id) => ({ id, enabled: true })),
            signedInSetName: t('compare.saved_sets.signed_in_ai')
          })
        : null
      const nextSelection = migrated?.selection ?? reconciled.selection
      const nextSavedSets = migrated?.savedSets ?? reconciled.savedSets
      if (customSelection === null) setCustomSelection(reconciled.seeded ? [] : reconciled.selection)
      if (reconciled.overflowTotal) {
        toast.info(
          t('compare.selection_limit_notice', {
            shown: MAX_COMPARE_COLUMNS,
            total: reconciled.overflowTotal
          })
        )
      }
      if (JSON.stringify(nextSelection) !== JSON.stringify(selection)) setSelection(nextSelection)
      if (JSON.stringify(nextSavedSets) !== JSON.stringify(savedSets)) setSavedSets(nextSavedSets)
      if (reconciled.seeded) {
        setDefaultsSeeded(true)
        setWelcomeDismissed(false)
        setActiveSetId(SIGNED_IN_COMPARE_SET_ID)
      } else if (migrated?.switchedSelection) {
        setActiveSetId(SIGNED_IN_COMPARE_SET_ID)
      }
      if (!loginDefaultsMigrated) {
        setLoginDefaultsMigrated(true)
      }
      if (!cacheService.hadPersistCacheAtStartup && !defaultsSeeded && (selection.length > 0 || savedSets.length > 0)) {
        setDefaultsSeeded(true)
      }
    }
    void initializeSelection()
    return () => {
      cancelled = true
    }
  }, [
    allApps,
    availableModels,
    defaultsSeeded,
    customSelection,
    judgeId,
    loadCliAvailability,
    loginDefaultsMigrated,
    miniAppsLoading,
    modelsLoading,
    providersLoading,
    savedSets,
    selection,
    setDefaultsSeeded,
    setSavedSets,
    setSelection,
    setCustomSelection,
    setLoginDefaultsMigrated,
    setWelcomeDismissed,
    subscriptionColumnIds,
    t
  ])

  useEffect(() => {
    if (focusedModelId && !columns.some((column) => column.id === focusedModelId)) setFocusedModelId(null)
  }, [columns, focusedModelId])

  useEffect(() => {
    const enabledCliIds = new Set(
      selection
        .filter((item) => item.enabled && item.id.startsWith('cli::'))
        .map((item) => item.id.slice('cli::'.length))
    )
    for (const [requestId, request] of activeCliRequests.current) {
      if (!enabledCliIds.has(request.cliId)) {
        void ipcApi.request('compare_cli.cancel', { requestId }).catch(() => {})
        activeCliRequests.current.delete(requestId)
        setCliOutputs((current) =>
          current[request.cliId]?.requestId === requestId
            ? {
                ...current,
                [request.cliId]: { content: request.content, status: 'waiting', prompt: request.userPrompt }
              }
            : current
        )
      }
    }
  }, [selection])

  useEffect(() => {
    for (const [key, wait] of webWaitControllers.current) {
      if (
        wait.topicId !== activeTopicId ||
        (focusedModelId && `webapp::${encodeURIComponent(wait.appId)}` !== focusedModelId)
      ) {
        wait.controller.abort()
        webWaitControllers.current.delete(key)
      }
    }
  }, [activeTopicId, focusedModelId])

  useEffect(() => {
    if (!activeTurn || activeTurn.topicId !== activeTopicId || judgeId !== 'auto') return
    void resolveJudge()
  }, [activeTopicId, activeTurn, judgeId, resolveJudge])

  useEffect(() => {
    if (!activeTurn || activeTurn.topicId !== activeTopicId || activeTurn.question !== currentQuestion) return
    const signature = getCombineSignature(activeTurn.topicId, activeTurn.question, activeTurn.targetIds, activeTurn.id)
    if (
      !shouldAutoCombine({
        enabled: autoCombine,
        statuses: activeTurnStatuses,
        answerCount: answerSources.length,
        signature,
        lastCombinedSignature: lastAutoCombineSignature.current
      })
    ) {
      return
    }
    lastAutoCombineSignature.current = signature
    void handleCombine()
  }, [activeTopicId, activeTurn, activeTurnStatuses, answerSources.length, autoCombine, currentQuestion, handleCombine])

  useEffect(
    () => () => {
      for (const requestId of activeCliRequests.current.keys()) {
        void ipcApi.request('compare_cli.cancel', { requestId }).catch(() => {})
      }
      for (const requestId of activeCombineRequests.current.keys()) {
        void ipcApi.request('compare_cli.cancel', { requestId }).catch(() => {})
      }
      for (const requestId of activeModelCombineRequests.current.keys()) {
        void ipcApi.request('ai.text.abort', { requestId }).catch(() => {})
      }
      for (const wait of webWaitControllers.current.values()) wait.controller.abort()
      activeCliRequests.current.clear()
      activeCombineRequests.current.clear()
      combineRuns.current.clear()
      activeModelCombineRequests.current.clear()
      webWaitControllers.current.clear()
    },
    []
  )

  const toolbar = useMemo(
    () => (
      <CompareToolbar
        selection={selection}
        models={availableModels}
        savedSets={savedSets}
        activeSetId={activeSetId}
        onSelectionChange={handleSelectionChange}
        onSelectSet={handleSelectSet}
        onSaveSet={handleSaveSet}
        layout={layout}
        onLayoutChange={setLayout}
        judgeId={judgeOptions.some((option) => option.id === judgeId) ? judgeId : 'auto'}
        judgeOptions={judgeOptions}
        onJudgeChange={handleJudgeChange}
        onJudgePickerOpen={handleJudgePickerOpen}
        canCombine={canCombineAnswers || Boolean(finalAnswer)}
        onCombine={() => void handleCombine()}
        onOpenHistory={handleOpenHistory}
        onOpenFreeModels={openFreeModels}
        apiPickerOpen={apiPickerOpen}
        onApiPickerOpenChange={handleApiPickerOpenChange}
        onSignIn={handleSignIn}
        cliAvailability={cliAvailability}
        isCheckingClis={isCheckingClis}
        backupIds={backupIds}
        backupCandidates={backupCandidates}
        onBackupChange={(ids: CacheCompareBackupModelId[]) => setBackupIds(ids)}
      />
    ),
    [
      activeSetId,
      availableModels,
      canCombineAnswers,
      finalAnswer,
      handleCombine,
      handleOpenHistory,
      openFreeModels,
      handleApiPickerOpenChange,
      handleSignIn,
      handleJudgeChange,
      handleJudgePickerOpen,
      handleSaveSet,
      handleSelectSet,
      handleSelectionChange,
      backupCandidates,
      backupIds,
      setBackupIds,
      apiPickerOpen,
      cliAvailability,
      isCheckingClis,
      judgeId,
      judgeOptions,
      layout,
      savedSets,
      selection
    ]
  )
  const webPanelHint = useMemo(
    () =>
      !webPanelHintDismissed && selection.some((item) => item.id.startsWith('webapp::')) ? (
        <CompareWebPanelHint onDismiss={() => setWebPanelHintDismissed(true)} />
      ) : null,
    [selection, setWebPanelHintDismissed, webPanelHintDismissed]
  )
  const handleDismissWelcome = useCallback(() => setWelcomeDismissed(true), [setWelcomeDismissed])
  const handleGoToPanels = useCallback(() => {
    document.getElementById('compare-panels')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  const handleOpenProviders = useCallback(() => {
    openTab('/settings/provider')
  }, [openTab])
  const handleFocusPrompt = useCallback(() => {
    if (activeTopicId) {
      void EventEmitter.emit(EVENT_NAMES.FOCUS_CHAT_COMPOSER, { topicId: activeTopicId })
    }
  }, [activeTopicId])
  const welcomeCard = useMemo(() => {
    if (showGuideBanner) {
      return <GuideBanner onDismiss={dismissGuideBanner} onOpenGuide={() => openTab('/guide')} />
    }
    if (welcomeDismissed) return null
    return (
      <CompareWelcomeCard
        onDismiss={handleDismissWelcome}
        onGoToPanels={handleGoToPanels}
        onOpenProviders={handleOpenProviders}
        onFocusPrompt={handleFocusPrompt}
      />
    )
  }, [
    dismissGuideBanner,
    showGuideBanner,
    handleDismissWelcome,
    handleFocusPrompt,
    handleGoToPanels,
    handleOpenProviders,
    openTab,
    welcomeDismissed
  ])
  const compareConfig = useMemo<ComparePageConfig>(
    () => ({
      header: toolbar,
      webPanelHint,
      welcomeCard,
      selectedModelIds: selection.map((item) => item.id),
      columns,
      runtimeOwnerId: columns.find((column) => column.kind === 'api')?.id,
      currentQuestion,
      turnId: activeTurn?.id,
      sendModels,
      backupModels,
      backupCandidateIds: selectedBackupCandidates.map((candidate) => candidate.id),
      webSearchEnabled,
      focusedModelId,
      layout,
      sendDisabled: columns.filter((column) => sendColumnIds.includes(column.id)).length === 0,
      subscriptionColumnIds,
      deliveryStatuses,
      onSendText: handleSendText,
      onDeliveryResults: handleDeliveryResults,
      onFocusModel: setFocusedModelId,
      onToggleModel: handleToggleModel,
      onRemoveModel: handleRemoveModel,
      onReorderModels: handleReorderModels,
      onTopicIdChange: setActiveTopicId,
      onWebviewRef: handleWebviewRef,
      webWarnings,
      webAnswers,
      cliOutputs,
      onCancelCli: handleCancelCli,
      cliAvailability,
      judgeId: judgeOptions.some((option) => option.id === judgeId) ? judgeId : 'auto',
      judgeOptions,
      onJudgeChange: handleJudgeChange,
      onJudgePickerOpen: handleJudgePickerOpen,
      onOpenHistory: handleOpenHistory,
      onOpenModelPicker: handleOpenModelPicker,
      onAddColumn: handleAddColumn,
      onUseSubscriptions: handleUseSubscriptions,
      canCombine: canCombineAnswers,
      onCombine: () => void handleCombine(),
      finalAnswerPanelOpen,
      onCloseFinalAnswer: handleCloseFinalAnswer,
      finalAnswer,
      onCopyFinalAnswer: handleCopyFinalAnswer,
      onUseWebAnswer: handleUseWebAnswer,
      onBackupStart: handleBackupStart,
      onBackupExhausted: handleBackupExhausted,
      onCliBackupRequest: handleCliBackupRequest
    }),
    [
      canCombineAnswers,
      cliOutputs,
      columns,
      finalAnswer,
      finalAnswerPanelOpen,
      focusedModelId,
      handleCancelCli,
      handleCloseFinalAnswer,
      deliveryStatuses,
      cliAvailability,
      handleCombine,
      handleCopyFinalAnswer,
      handleOpenHistory,
      handleOpenModelPicker,
      handleAddColumn,
      handleJudgeChange,
      handleJudgePickerOpen,
      handleRemoveModel,
      handleReorderModels,
      handleSendText,
      handleDeliveryResults,
      handleToggleModel,
      handleUseSubscriptions,
      handleUseWebAnswer,
      handleBackupStart,
      handleBackupExhausted,
      handleCliBackupRequest,
      handleWebviewRef,
      judgeId,
      judgeOptions,
      currentQuestion,
      activeTurn?.id,
      layout,
      sendColumnIds,
      sendModels,
      backupModels,
      selectedBackupCandidates,
      webSearchEnabled,
      subscriptionColumnIds,
      selection,
      toolbar,
      webAnswers,
      webPanelHint,
      webWarnings,
      welcomeCard
    ]
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <HomePage compare={compareConfig} />
      </div>
      <ComparePromoFooter />
      <OpenRouterFreeModelsDialog />
    </div>
  )
}

function getJudgeName(
  judgeId: CompareJudgeId,
  columns: readonly CompareColumn[],
  modelsById: ReadonlyMap<UniqueModelId, Model>,
  t: ReturnType<typeof useTranslation>['t']
): string {
  if (judgeId.startsWith('cli::')) return getCliAccountLabel(judgeId.slice('cli::'.length) as CompareCliId, t)
  const model = modelsById.get(judgeId as UniqueModelId)
  if (model) return model.name
  const webColumn = columns.find(
    (column): column is Extract<CompareColumn, { kind: 'web' }> => column.id === judgeId && column.kind === 'web'
  )
  return webColumn ? t('compare.judge.web_app', { name: webColumn.name }) : t('compare.judge.unavailable')
}

function getCliAccountLabel(id: CompareCliId, t: ReturnType<typeof useTranslation>['t']): string {
  switch (id) {
    case 'claude':
      return t('compare.cli.account.claude')
    case 'agy':
      return t('compare.cli.account.agy')
    case 'codex':
      return t('compare.cli.account.codex')
  }
}

function isApiColumnId(id: CompareColumnId): id is UniqueModelId {
  return !id.startsWith('webapp::') && !id.startsWith('cli::')
}

function decodeWebAppColumnId(id: string): string {
  try {
    return decodeURIComponent(id.slice('webapp::'.length))
  } catch {
    return ''
  }
}

export default ComparePage
