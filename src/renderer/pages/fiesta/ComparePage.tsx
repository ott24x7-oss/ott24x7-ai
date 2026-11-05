import type { WebviewTag } from 'electron'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cacheService } from '@data/CacheService'
import { ComparePromoFooter } from '@renderer/components/app/PromoCard'
import { getModelDisplayTags } from '@renderer/components/tags/Model'
import { usePersistCache } from '@renderer/data/hooks/useCache'
import { useTabs } from '@renderer/hooks/tab'
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
  CompareJudgeId,
  CompareLayout,
  CompareModelStatus,
  ComparePageConfig,
  CompareWebAnswer
} from '@renderer/types/compare'
import type {
  CacheCompareFinalAnswer,
  CacheCompareModelSelection,
  CacheCompareSavedSet
} from '@shared/data/cache/cacheValueTypes'
import type { Model, UniqueModelId } from '@shared/data/types/model'
import type { CompareCliStreamEvent } from '@shared/ipc/schemas/compareCli'
import type { CompareCliAvailability, CompareCliId } from '@shared/types/compareCli'
import { isAgentOnlyProvider } from '@shared/utils/provider'

// eslint-disable-next-line import-x/no-restricted-paths -- Reuse the normal topic and chat-engine lifecycle for Compare.
import HomePage from '../home/HomePage'
import { buildCompareCliPrompt, type CompareCliTurn } from './cliConversation'
import {
  canCombine,
  getCombineSignature,
  getWebJudgePriority,
  shouldAutoCombine,
  type CombineResponseStatus
} from './combineState'
import { getLatestApiAnswer, getLatestPrompt } from './compareAnswers'
import {
  DEFAULT_COMPARE_CLI_ORDER,
  getDefaultCompareJudgeId,
  getCompareSendModelIds,
  getCompareSetSelection,
  getFirstRunCompareDefaults,
  removeCompareModel
} from './compareState'
import { CompareToolbar } from './CompareToolbar'
import { CompareWelcomeCard } from './CompareWelcomeCard'
import { buildSynthesisPrompt, type SynthesisAnswer } from './synthesisPrompt'
import {
  getWebPanelAdapter,
  readVisibleLastAnswer,
  sendPromptToWebPanel,
  sendPromptToWebPanels,
  waitForVisibleLastAnswer
} from './webPanelAdapters'

interface ActiveCliRequest {
  cliId: CompareCliId
  userPrompt: string
  content: string
}

interface ActiveCombineRequest {
  topicId: string
  question: string
  judgeId: CompareJudgeId
  judgeName: string
  content: string
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

function ComparePage() {
  const { t } = useTranslation()
  const [selection, setSelection] = usePersistCache('ui.compare.model_selection')
  const [savedSets, setSavedSets] = usePersistCache('ui.compare.saved_sets')
  const [defaultsSeeded, setDefaultsSeeded] = usePersistCache('ui.compare.defaults_seeded')
  const [welcomeDismissed, setWelcomeDismissed] = usePersistCache('ui.compare.welcome_dismissed')
  const [judgeIdValue, setJudgeIdValue] = usePersistCache('ui.compare.judge')
  const [autoCombine] = usePersistCache('ui.compare.auto_combine')
  const [readWebAnswers] = usePersistCache('ui.compare.read_web_answers')
  const [finalAnswers, setFinalAnswers] = usePersistCache('ui.compare.final_answers')
  const [activeSetId, setActiveSetId] = useState('custom')
  const [focusedModelId, setFocusedModelId] = useState<CompareColumnId | null>(null)
  const [onlyFocusedModel, setOnlyFocusedModel] = useState(false)
  const [layout, setLayout] = useState<CompareLayout>({ kind: 'columns', columns: 2 })
  const [activeTopicId, setActiveTopicId] = useState<string>()
  const [cliOutputs, setCliOutputs] = useState<Record<string, CompareCliOutput>>({})
  const [webAnswers, setWebAnswers] = useState<Record<string, CompareWebAnswer>>({})
  const [webWarnings, setWebWarnings] = useState<Record<string, boolean>>({})
  const [cliHistory, setCliHistory] = useState<Record<string, CompareCliTurn[]>>({})
  const [combineOutputs, setCombineOutputs] = useState<Record<string, CompareFinalAnswer>>({})
  const [activeTurn, setActiveTurn] = useState<ActiveCompareTurn>()
  const [cliAvailability, setCliAvailability] = useState<CompareCliAvailability[]>([])
  const { openTab } = useTabs()
  const webviewRefs = useRef(new Map<string, WebviewTag>())
  const activeCliRequests = useRef(new Map<string, ActiveCliRequest>())
  const activeCombineRequests = useRef(new Map<string, ActiveCombineRequest>())
  const activeModelCombineRequests = useRef(new Map<string, ActiveModelCombineRequest>())
  const webWaitControllers = useRef(new Map<string, ActiveWebWait>())
  const lastAutoCombineSignature = useRef<string | undefined>(undefined)
  const cliAvailabilityRef = useRef<CompareCliAvailability[] | null>(null)
  const cliAvailabilityRequest = useRef<Promise<CompareCliAvailability[]> | null>(null)
  const { models, isLoading: modelsLoading } = useModels()
  const { allApps, isLoading: miniAppsLoading } = useMiniApps()
  const { providers, isLoading: providersLoading } = useProviders()
  const judgeId = judgeIdValue as CompareJudgeId
  const setJudgeId = useCallback((next: CompareJudgeId) => setJudgeIdValue(next), [setJudgeIdValue])
  const providerById = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers])
  const availableModels = useMemo(
    () =>
      models.filter((model) => {
        const provider = providerById.get(model.providerId)
        return model.isEnabled && provider?.isEnabled && !isAgentOnlyProvider(provider)
      }),
    [models, providerById]
  )
  const availableModelsById = useMemo(
    () => new Map(availableModels.map((model) => [model.id, model])),
    [availableModels]
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
            canReadAnswer: Boolean(getWebPanelAdapter(appId).lastAnswerSelector)
          }
        ]
      }
      if (item.id.startsWith('cli::')) {
        const cliId = item.id.slice('cli::'.length) as CompareCliId
        if (!(cliId in CLI_NAMES)) return []
        return [{ id: item.id as `cli::${string}`, kind: 'cli', cliId, name: CLI_NAMES[cliId] }]
      }
      const model = availableModelsById.get(item.id)
      return model ? [{ id: model.id, kind: 'api', model }] : []
    })
  }, [allApps, availableModelsById, selection])
  const visibleWebJudgeColumns = useMemo(
    () =>
      columns.filter(
        (column): column is Extract<CompareColumn, { kind: 'web' }> =>
          column.kind === 'web' &&
          (!focusedModelId || focusedModelId === column.id) &&
          Boolean(getWebPanelAdapter(column.appId).lastAnswerSelector)
      ),
    [columns, focusedModelId]
  )
  const sendColumnIds = useMemo(
    () => getCompareSendModelIds(selection, focusedModelId, onlyFocusedModel),
    [focusedModelId, onlyFocusedModel, selection]
  )
  const sendModels = useMemo(
    () =>
      sendColumnIds.flatMap((id) =>
        isApiColumnId(id) && availableModelsById.has(id) ? [availableModelsById.get(id)!] : []
      ),
    [availableModelsById, sendColumnIds]
  )
  const freeModelIds = useMemo(
    () =>
      availableModels.flatMap((model) => {
        const provider = providerById.get(model.providerId)
        return getModelDisplayTags(model, undefined, provider).includes('free') ? [model.id] : []
      }),
    [availableModels, providerById]
  )
  const defaultSets = useMemo<CacheCompareSavedSet[]>(
    () => [
      {
        id: 'free',
        name: t('compare.saved_sets.free_models'),
        selection: freeModelIds.map((id) => ({ id, enabled: true }))
      },
      {
        id: 'all-enabled',
        name: t('compare.saved_sets.all_enabled'),
        selection: availableModels.map((model) => ({ id: model.id, enabled: true }))
      }
    ],
    [availableModels, freeModelIds, t]
  )
  const { uiMessages } = useTopicMessages(activeTopicId ?? '', { enabled: Boolean(activeTopicId) })
  const statusByModelId = useMemo(() => getModelStatuses(uiMessages), [uiMessages])
  const latestPrompt = useMemo(() => getLatestPrompt(uiMessages), [uiMessages])
  const currentQuestion =
    activeTurn && activeTurn.topicId === activeTopicId ? activeTurn.question : (latestPrompt?.question ?? '')
  const currentPrompt = latestPrompt?.question === currentQuestion ? latestPrompt : null
  const initializedSelectionRef = useRef(false)
  const initializedFirstRunJudgeRef = useRef(false)
  const seededThisSessionRef = useRef(false)

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
      })
    cliAvailabilityRequest.current = request
    return request
  }, [])

  const judgeOptions = useMemo(
    () => [
      { id: 'auto' as const, label: t('compare.judge.auto') },
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
    [availableModels, cliAvailability, t, visibleWebJudgeColumns]
  )

  const resolveJudge = useCallback(async (): Promise<CompareJudgeId> => {
    const availability = await loadCliAvailability()
    const availableCliIds = new Set(availability.filter((item) => item.available).map((item) => item.id))
    const selectedCliId = judgeId.startsWith('cli::') ? judgeId.slice('cli::'.length) : undefined
    if (selectedCliId && availableCliIds.has(selectedCliId as CompareCliId)) return judgeId

    if (judgeId !== 'auto' && isApiColumnId(judgeId) && availableModelsById.has(judgeId)) return judgeId

    const selectedWebJudge = visibleWebJudgeColumns.find((column) => column.id === judgeId)
    if (selectedWebJudge) return judgeId

    const preferredJudgeId = getDefaultCompareJudgeId(
      [...availableCliIds],
      visibleWebJudgeColumns.map((column) => column.appId)
    )
    if (preferredJudgeId !== 'auto') {
      const nextJudgeId = preferredJudgeId as CompareJudgeId
      setJudgeId(nextJudgeId)
      return nextJudgeId
    }

    // Reuse a mounted visible web column as judge instead of opening another mini-app session.
    const defaultWebJudge = visibleWebJudgeColumns.toSorted(
      (left, right) => getWebJudgePriority(left.appId) - getWebJudgePriority(right.appId)
    )[0]
    const nextJudgeId = (defaultWebJudge?.id ?? 'auto') as CompareJudgeId
    if (nextJudgeId !== 'auto') {
      setJudgeId(nextJudgeId)
      return nextJudgeId
    }

    const nativeProviderModel = availableModels.find((model) => model.providerId === 'openai-codex')
    if (nativeProviderModel) {
      setJudgeId(nativeProviderModel.id)
      return nativeProviderModel.id
    }

    setJudgeId(nextJudgeId)
    return nextJudgeId
  }, [availableModels, availableModelsById, judgeId, loadCliAvailability, setJudgeId, visibleWebJudgeColumns])

  const handleJudgePickerOpen = useCallback(() => {
    void loadCliAvailability()
  }, [loadCliAvailability])
  const handleJudgeChange = useCallback((nextJudgeId: CompareJudgeId) => setJudgeId(nextJudgeId), [setJudgeId])

  const answerSources = useMemo<CompareAnswerSource[]>(() => {
    if (!currentQuestion) return []

    const sources: CompareAnswerSource[] = []
    for (const column of columns) {
      if (column.kind === 'api') {
        const answer = getLatestApiAnswer(uiMessages, currentPrompt, column.id)
        if (answer?.content)
          sources.push({ sourceId: column.id, modelName: column.model.name, content: answer.content })
      } else if (column.kind === 'cli') {
        const answer = cliOutputs[column.cliId]
        if (answer?.prompt === currentQuestion && answer.content) {
          sources.push({ sourceId: column.id, modelName: column.name, content: answer.content })
        }
      } else {
        const answer = webAnswers[column.appId]
        if (answer?.question === currentQuestion && answer.content) {
          sources.push({ sourceId: column.id, modelName: column.name, content: answer.content })
        }
      }
    }
    return sources
  }, [cliOutputs, columns, currentPrompt, currentQuestion, uiMessages, webAnswers])

  const activeTurnStatuses = useMemo<CombineResponseStatus[]>(() => {
    if (!activeTurn || activeTurn.topicId !== activeTopicId || activeTurn.question !== currentQuestion) return []

    return activeTurn.targetIds.map((id): CombineResponseStatus => {
      const column = columns.find((candidate) => candidate.id === id)
      if (!column) return 'skipped'
      if (column.kind === 'api') {
        return getLatestApiAnswer(uiMessages, currentPrompt, column.id)?.status ?? 'waiting'
      }
      if (column.kind === 'cli') {
        const output = cliOutputs[column.cliId]
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
    webAnswers
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
    if (!activeTopicId || !currentQuestion || !canCombine(answerSources.length)) return
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

    const judgeName = getJudgeName(resolvedJudgeId, columns, availableModelsById, t)
    const synthesisPrompt = buildSynthesisPrompt(question, answerSources)
    const existingCombine = [...activeCombineRequests.current.entries()].find(
      ([, request]) => request.topicId === topicId
    )
    if (existingCombine) {
      const [requestId] = existingCombine
      void ipcApi.request('compare_cli.cancel', { requestId }).catch(() => {})
      activeCombineRequests.current.delete(requestId)
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

    if (resolvedJudgeId.startsWith('cli::')) {
      const cliId = resolvedJudgeId.slice('cli::'.length) as CompareCliId
      const requestId = crypto.randomUUID()
      activeCombineRequests.current.set(requestId, {
        topicId,
        question,
        judgeId: resolvedJudgeId,
        judgeName,
        content: ''
      })
      void ipcApi.request('compare_cli.run', { id: cliId, requestId, prompt: synthesisPrompt }).catch(() => {
        activeCombineRequests.current.delete(requestId)
        setCombineError(topicId, question, resolvedJudgeId, judgeName)
      })
      return
    }

    if (isApiColumnId(resolvedJudgeId)) {
      const requestId = crypto.randomUUID()
      activeModelCombineRequests.current.set(requestId, {
        topicId,
        question,
        judgeId: resolvedJudgeId,
        judgeName
      })
      try {
        const { text } = await ipcApi.request('ai.text.generate', {
          requestId,
          uniqueModelId: resolvedJudgeId,
          prompt: synthesisPrompt,
          reasoningEffort: 'none'
        })
        if (activeModelCombineRequests.current.has(requestId)) {
          completeCombine(topicId, question, text, resolvedJudgeId, judgeName)
        }
      } catch {
        if (activeModelCombineRequests.current.has(requestId)) {
          setCombineError(topicId, question, resolvedJudgeId, judgeName)
        }
      } finally {
        activeModelCombineRequests.current.delete(requestId)
      }
      return
    }

    const webColumn = columns.find(
      (column): column is Extract<CompareColumn, { kind: 'web' }> =>
        column.kind === 'web' && column.id === resolvedJudgeId && (!focusedModelId || focusedModelId === column.id)
    )
    const webview = webColumn ? webviewRefs.current.get(webColumn.appId) : undefined
    if (!webColumn || !webview || !getWebPanelAdapter(webColumn.appId).lastAnswerSelector) {
      setCombineError(topicId, question, resolvedJudgeId, judgeName)
      return
    }

    const waitKey = `combine:${topicId}`
    const controller = new AbortController()
    webWaitControllers.current.get(waitKey)?.controller.abort()
    webWaitControllers.current.set(waitKey, { appId: webColumn.appId, topicId, controller })
    try {
      const previousText = await readVisibleLastAnswer(webview, webColumn.appId)
      if (controller.signal.aborted) return
      const sent = await sendPromptToWebPanel(webview, webColumn.appId, synthesisPrompt)
      if (!sent) {
        setCombineError(topicId, question, resolvedJudgeId, judgeName)
        return
      }
      const answer = await waitForVisibleLastAnswer(
        webview,
        webColumn.appId,
        previousText,
        (content) =>
          setCombineOutputs((current) => ({
            ...current,
            [topicId]: { question, content, status: 'streaming', judgeId: resolvedJudgeId, judgeName }
          })),
        { signal: controller.signal }
      )
      if (controller.signal.aborted) return
      if (answer) completeCombine(topicId, question, answer, resolvedJudgeId, judgeName)
      else setCombineError(topicId, question, resolvedJudgeId, judgeName)
    } catch {
      if (!controller.signal.aborted) setCombineError(topicId, question, resolvedJudgeId, judgeName)
    } finally {
      webWaitControllers.current.delete(waitKey)
    }
  }, [
    activeTopicId,
    activeTurn,
    answerSources,
    availableModelsById,
    columns,
    completeCombine,
    currentQuestion,
    focusedModelId,
    resolveJudge,
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
        } else if (event.type === 'done') {
          completeCombine(
            combineRequest.topicId,
            combineRequest.question,
            combineRequest.content,
            combineRequest.judgeId,
            combineRequest.judgeName
          )
        } else {
          setCombineError(
            combineRequest.topicId,
            combineRequest.question,
            combineRequest.judgeId,
            combineRequest.judgeName
          )
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
      }
      activeCliRequests.current.delete(event.requestId)
    },
    [completeCombine, setCombineError, t]
  )
  useIpcOn('compare_cli.stream', handleCliEvent)

  const handleSendText = useCallback(
    async (text: string) => {
      for (const wait of webWaitControllers.current.values()) wait.controller.abort()
      webWaitControllers.current.clear()

      const selectedForSend = new Set(sendColumnIds)
      const visibleWebColumns = columns.filter(
        (column): column is Extract<CompareColumn, { kind: 'web' }> =>
          column.kind === 'web' && selectedForSend.has(column.id) && (!focusedModelId || focusedModelId === column.id)
      )
      const targetIds = sendColumnIds.filter(
        (id) => !id.startsWith('webapp::') || visibleWebColumns.some((column) => column.id === id)
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
        if (webResults.every((result) => result.sent)) await copyPrompt(text)
        webResults.push(...missingWebColumns.map((column) => ({ appId: column.appId, sent: false })))
      }
      setWebWarnings((current) => ({
        ...current,
        ...Object.fromEntries(webResults.map((result) => [result.appId, !result.sent]))
      }))

      for (const result of webResults) {
        const column = visibleWebColumns.find((candidate) => candidate.appId === result.appId)
        if (!column) continue
        const canRead = readWebAnswers && Boolean(getWebPanelAdapter(column.appId).lastAnswerSelector)
        if (!result.sent || !canRead) {
          setWebAnswers((current) => ({
            ...current,
            [column.appId]: {
              question: text,
              content: '',
              status: result.sent ? 'skipped' : 'error'
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

      for (const column of columns) {
        if (column.kind !== 'cli' || !selectedForSend.has(column.id)) continue
        const existing = cliOutputs[column.cliId]
        if (existing?.requestId) {
          void ipcApi.request('compare_cli.cancel', { requestId: existing.requestId }).catch(() => {})
          activeCliRequests.current.delete(existing.requestId)
        }
        const requestId = crypto.randomUUID()
        const prompt = buildCompareCliPrompt(cliHistory[column.cliId] ?? [], text)
        activeCliRequests.current.set(requestId, { cliId: column.cliId, userPrompt: text, content: '' })
        setCliOutputs((current) => ({
          ...current,
          [column.cliId]: { content: '', status: 'streaming', requestId, prompt: text }
        }))
        void ipcApi.request('compare_cli.run', { id: column.cliId, requestId, prompt }).catch(() => {
          activeCliRequests.current.delete(requestId)
          setCliOutputs((current) => ({
            ...current,
            [column.cliId]: {
              content: current[column.cliId]?.content ?? '',
              status: 'error',
              error: t('compare.cli.start_failed'),
              prompt: text
            }
          }))
        })
      }
      void resolveJudge()
    },
    [activeTopicId, cliHistory, cliOutputs, columns, focusedModelId, readWebAnswers, resolveJudge, sendColumnIds, t]
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
      setSelection(next)
      setActiveSetId('custom')
    },
    [setSelection]
  )
  const handleRemoveModel = useCallback(
    (modelId: CompareColumnId) => handleSelectionChange(removeCompareModel(selection, modelId)),
    [handleSelectionChange, selection]
  )
  const handleWebviewRef = useCallback((appId: string, webview: WebviewTag | null) => {
    if (webview) webviewRefs.current.set(appId, webview)
    else webviewRefs.current.delete(appId)
  }, [])
  const handleSelectSet = useCallback(
    (setId: string) => {
      const selectedSet = [...defaultSets, ...savedSets].find((set) => set.id === setId)
      if (!selectedSet) {
        setActiveSetId('custom')
        return
      }
      setSelection(getCompareSetSelection(selectedSet))
      setActiveSetId(setId)
      setFocusedModelId(null)
    },
    [defaultSets, savedSets, setSelection]
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
    initializedSelectionRef.current = true
    const enabledSiteAppIds = allApps
      .filter((app) => app.kind === 'site' && (app.status === 'enabled' || app.status === 'pinned'))
      .map((app) => app.appId)
    const firstRunDefaults = getFirstRunCompareDefaults({
      // Other windows can create the persist cache first, so seed whenever Compare is still empty.
      isFreshProfile: true,
      defaultsSeeded,
      selection,
      savedSets,
      judgeId,
      enabledSiteAppIds,
      savedSetName: t('compare.saved_sets.my_subscriptions')
    })

    if (firstRunDefaults) {
      seededThisSessionRef.current = true
      setSelection(firstRunDefaults.selection)
      setSavedSets([firstRunDefaults.savedSet])
      setDefaultsSeeded(true)
      setWelcomeDismissed(false)
      setActiveSetId(firstRunDefaults.savedSet.id)
    } else if (
      !cacheService.hadPersistCacheAtStartup &&
      !defaultsSeeded &&
      (selection.length > 0 || savedSets.length > 0)
    ) {
      setDefaultsSeeded(true)
    }
  }, [
    allApps,
    defaultsSeeded,
    judgeId,
    miniAppsLoading,
    modelsLoading,
    providersLoading,
    savedSets,
    selection,
    setDefaultsSeeded,
    setSavedSets,
    setSelection,
    setWelcomeDismissed,
    t
  ])

  useEffect(() => {
    if (
      !seededThisSessionRef.current ||
      !defaultsSeeded ||
      initializedFirstRunJudgeRef.current ||
      columns.length === 0
    ) {
      return
    }
    if (judgeId !== 'auto') {
      initializedFirstRunJudgeRef.current = true
      return
    }
    initializedFirstRunJudgeRef.current = true
    void resolveJudge()
  }, [columns.length, defaultsSeeded, judgeId, resolveJudge])

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
        judgeId,
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
  }, [
    activeTopicId,
    activeTurn,
    activeTurnStatuses,
    answerSources.length,
    autoCombine,
    currentQuestion,
    handleCombine,
    judgeId
  ])

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
        focusedModelId={focusedModelId}
        onFocusModel={setFocusedModelId}
        layout={layout}
        onLayoutChange={setLayout}
        onlyFocusedModel={onlyFocusedModel}
        onOnlyFocusedModelChange={setOnlyFocusedModel}
        statusByModelId={statusByModelId}
        judgeId={judgeId}
        judgeOptions={judgeOptions}
        onJudgeChange={handleJudgeChange}
        onJudgePickerOpen={handleJudgePickerOpen}
        canCombine={canCombineAnswers}
        onCombine={() => void handleCombine()}
      />
    ),
    [
      activeSetId,
      availableModels,
      canCombineAnswers,
      focusedModelId,
      handleCombine,
      handleJudgeChange,
      handleJudgePickerOpen,
      handleSaveSet,
      handleSelectSet,
      handleSelectionChange,
      judgeId,
      judgeOptions,
      layout,
      onlyFocusedModel,
      savedSets,
      selection,
      statusByModelId
    ]
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
  const welcomeCard = useMemo(
    () =>
      welcomeDismissed ? null : (
        <CompareWelcomeCard
          onDismiss={handleDismissWelcome}
          onGoToPanels={handleGoToPanels}
          onOpenProviders={handleOpenProviders}
          onFocusPrompt={handleFocusPrompt}
        />
      ),
    [handleDismissWelcome, handleFocusPrompt, handleGoToPanels, handleOpenProviders, welcomeDismissed]
  )
  const compareConfig = useMemo<ComparePageConfig>(
    () => ({
      header: toolbar,
      welcomeCard,
      selectedModelIds: selection.map((item) => item.id),
      columns,
      sendModels,
      focusedModelId,
      layout,
      sendDisabled: columns.filter((column) => sendColumnIds.includes(column.id)).length === 0,
      onSendText: handleSendText,
      onFocusModel: setFocusedModelId,
      onRemoveModel: handleRemoveModel,
      onTopicIdChange: setActiveTopicId,
      onWebviewRef: handleWebviewRef,
      webWarnings,
      webAnswers,
      cliOutputs,
      onCancelCli: handleCancelCli,
      judgeId,
      judgeOptions,
      onJudgeChange: handleJudgeChange,
      onJudgePickerOpen: handleJudgePickerOpen,
      canCombine: canCombineAnswers,
      onCombine: () => void handleCombine(),
      finalAnswer,
      onCopyFinalAnswer: handleCopyFinalAnswer,
      onUseWebAnswer: (appId) => void handleUseWebAnswer(appId)
    }),
    [
      canCombineAnswers,
      cliOutputs,
      columns,
      finalAnswer,
      focusedModelId,
      handleCancelCli,
      handleCombine,
      handleCopyFinalAnswer,
      handleJudgeChange,
      handleJudgePickerOpen,
      handleRemoveModel,
      handleSendText,
      handleUseWebAnswer,
      handleWebviewRef,
      judgeId,
      judgeOptions,
      layout,
      sendColumnIds,
      sendModels,
      selection,
      toolbar,
      webAnswers,
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

function getModelStatuses(messages: ReturnType<typeof useTopicMessages>['uiMessages']) {
  const statuses = new Map<UniqueModelId, CompareModelStatus>()
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    const modelId = message.metadata?.modelId
    if (typeof modelId !== 'string' || !modelId.includes('::')) continue
    const status = message.metadata?.status
    statuses.set(
      modelId as UniqueModelId,
      status === 'pending' ? 'streaming' : status === 'error' ? 'error' : status === 'success' ? 'done' : 'waiting'
    )
  }
  return statuses
}

export default ComparePage
