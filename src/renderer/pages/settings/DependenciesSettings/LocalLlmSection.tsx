import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, Check, Code2, Cpu, Download, RefreshCw, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button } from '@cherrystudio/ui'
import { loggerService } from '@logger'
import { useModelMutations, useModels } from '@renderer/hooks/useModel'
import { useDefaultModel } from '@renderer/hooks/useModel'
import { useProviderActions, useProviders } from '@renderer/hooks/useProvider'
import { ipcApi, useIpcOn } from '@renderer/ipc'
import { cn } from '@renderer/utils/style'
import {
  mergeOllamaTags,
  recommendLocalLlmModel,
  type LocalLlmCategory,
  type LocalLlmRecommendation,
  type LocalLlmSpeed,
  type InstalledOllamaModel
} from '@shared/data/presets/localLlm'
import type { OutputFor } from '@shared/ipc/types'

import { syncInstalledOllamaModels } from './localLlm'

const logger = loggerService.withContext('LocalLlmSection')
const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download/OllamaSetup.exe'
const GIB = 1024 ** 3

type Status = OutputFor<'ollama.get_status'>
type Progress = { status: string; percent: number | null }

const CATEGORY_KEYS: readonly LocalLlmCategory[] = ['coding', 'general', 'reasoning']
const CATEGORY_LABEL_KEYS = {
  coding: 'settings.localLlm.category.coding',
  general: 'settings.localLlm.category.general',
  reasoning: 'settings.localLlm.category.reasoning'
} as const
const CATEGORY_DESCRIPTION_KEYS = {
  coding: 'settings.localLlm.goodFor.coding',
  general: 'settings.localLlm.goodFor.general',
  reasoning: 'settings.localLlm.goodFor.reasoning'
} as const
const SPEED_KEYS = {
  fast: 'settings.localLlm.speed.fast',
  balanced: 'settings.localLlm.speed.balanced',
  slow: 'settings.localLlm.speed.slow',
  varies: 'settings.localLlm.speed.varies'
} as const

function displayGb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / GIB))} GB`
}

function displayModelSize(bytes: number): string {
  return bytes < GIB ? `${Math.round(bytes / 1024 ** 2)} MB` : `${(bytes / GIB).toFixed(1)} GB`
}

function LocalLlmSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { providers, hasLoaded: providersLoaded, createProvider } = useProviders()
  const { models, isLoading: modelsLoading, refetch: refetchModels } = useModels({ providerId: 'ollama' })
  const { createModels, deleteModel } = useModelMutations()
  const { updateProviderById } = useProviderActions()
  const { setDefaultModel } = useDefaultModel()
  const provider = providers.find((item) => item.id === 'ollama')

  const [status, setStatus] = useState<Status | null>(null)
  const [installedTags, setInstalledTags] = useState<InstalledOllamaModel[]>([])
  const [statusLoading, setStatusLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [starting, setStarting] = useState(false)
  const [activePull, setActivePull] = useState<{ jobId: string; modelName: string } | null>(null)
  const [activeProgress, setActiveProgress] = useState<Progress | null>(null)
  const [installProgress, setInstallProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeJobId = useRef<string | null>(null)
  const syncInProgress = useRef(false)
  const lastSyncKey = useRef<string | null>(null)

  const reloadStatus = useCallback(async () => {
    setStatusLoading(true)
    setError(null)
    try {
      const next = await ipcApi.request('ollama.get_status')
      setStatus(next)
      if (next.state === 'running') {
        const result = await ipcApi.request('ollama.list_models')
        setInstalledTags(result.models)
      } else {
        setInstalledTags([])
      }
    } catch (cause) {
      logger.warn('Could not read local Ollama status', {
        errorType: cause instanceof Error ? cause.name : typeof cause
      })
      setError(t('settings.localLlm.error'))
    } finally {
      setStatusLoading(false)
    }
  }, [t])

  useEffect(() => {
    void reloadStatus()
  }, [reloadStatus])

  useIpcOn('ollama.progress', (event) => {
    const progress = {
      status: event.operation === 'installer' ? t('settings.localLlm.installing') : event.status,
      percent: event.percent
    }
    if (event.operation === 'installer') setInstallProgress(progress)
    if (event.operation === 'model-pull' && event.jobId === activeJobId.current) setActiveProgress(progress)
  })

  const existingModelIds = useMemo(
    () => new Set(models.flatMap(({ apiModelId }) => (apiModelId ? [apiModelId] : []))),
    [models]
  )
  useEffect(() => {
    if (status?.state !== 'running' || !providersLoaded || modelsLoading || !installedTags.length) return
    const syncKey = [
      installedTags
        .map(({ name }) => name)
        .sort()
        .join(','),
      provider?.isEnabled ?? 'missing',
      [...existingModelIds].sort().join(',')
    ].join('|')
    if (syncInProgress.current || lastSyncKey.current === syncKey) return

    syncInProgress.current = true
    void syncInstalledOllamaModels(
      installedTags,
      existingModelIds,
      provider,
      async () => createProvider({ providerId: 'ollama', presetProviderId: 'ollama', name: 'Ollama' }),
      createModels,
      (providerId) => updateProviderById(providerId, { isEnabled: true })
    )
      .then(() => {
        lastSyncKey.current = syncKey
        void refetchModels()
      })
      .catch((cause) => {
        logger.warn('Could not sync installed Ollama models into the provider list', {
          errorType: cause instanceof Error ? cause.name : typeof cause
        })
        setError(t('settings.localLlm.syncError'))
      })
      .finally(() => {
        syncInProgress.current = false
      })
  }, [
    createModels,
    createProvider,
    existingModelIds,
    installedTags,
    modelsLoading,
    provider,
    providersLoaded,
    refetchModels,
    status?.state,
    t,
    updateProviderById
  ])

  const startOllama = async () => {
    setStarting(true)
    setError(null)
    try {
      await ipcApi.request('ollama.start')
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      await reloadStatus()
    } catch (cause) {
      logger.warn('Could not start local Ollama', { errorType: cause instanceof Error ? cause.name : typeof cause })
      setError(t('settings.localLlm.startError'))
    } finally {
      setStarting(false)
    }
  }

  const installOllama = async () => {
    setInstalling(true)
    setInstallProgress({ status: t('settings.localLlm.installing'), percent: null })
    setError(null)
    try {
      await ipcApi.request('ollama.install')
      setInstallProgress({ status: t('settings.localLlm.setupLaunched'), percent: 100 })
      await reloadStatus()
    } catch (cause) {
      logger.warn('Could not install local Ollama', { errorType: cause instanceof Error ? cause.name : typeof cause })
      setError(t('settings.localLlm.installError'))
    } finally {
      setInstalling(false)
    }
  }

  const pullModel = async (modelName: string) => {
    const jobId = crypto.randomUUID()
    activeJobId.current = jobId
    setActivePull({ jobId, modelName })
    setActiveProgress({ status: t('settings.localLlm.preparing'), percent: null })
    setError(null)
    try {
      const result = await ipcApi.request('ollama.pull', { jobId, modelName })
      if (!result.cancelled) {
        await reloadStatus()
      }
    } catch (cause) {
      logger.warn('Could not download local Ollama model', {
        modelName,
        errorType: cause instanceof Error ? cause.name : typeof cause
      })
      setError(t('settings.localLlm.downloadError'))
    } finally {
      activeJobId.current = null
      setActivePull(null)
      setActiveProgress(null)
    }
  }

  const cancelPull = async () => {
    if (!activePull) return
    await ipcApi.request('ollama.cancel_pull', { jobId: activePull.jobId })
  }

  const removeModel = async (modelName: string) => {
    setError(null)
    try {
      await ipcApi.request('ollama.delete_model', { modelName })
      if (existingModelIds.has(modelName)) await deleteModel('ollama', modelName)
      setInstalledTags((current) => current.filter(({ name }) => name !== modelName))
      await reloadStatus()
    } catch (cause) {
      logger.warn('Could not delete local Ollama model', {
        modelName,
        errorType: cause instanceof Error ? cause.name : typeof cause
      })
      setError(t('settings.localLlm.deleteError'))
    }
  }

  const selectModelForChat = async (modelName: string) => {
    const model = models.find((item) => item.apiModelId === modelName)
    if (!model) return
    await setDefaultModel({ id: model.id })
    await navigate({ to: '/app/chat' })
  }

  const merged = useMemo(() => mergeOllamaTags(installedTags), [installedTags])
  const ramGb = (status?.device.totalMemoryBytes ?? 0) / GIB
  const vramGb = status?.device.gpu ? status.device.gpu.vramBytes / GIB : null
  const running = status?.state === 'running'

  return (
    <div className="min-w-0 space-y-6 pb-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cpu className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-foreground text-sm">{t('settings.localLlm.ollamaTitle')}</h2>
              {running && (
                <Badge className="border-success/30 bg-success/10 text-success">{t('settings.localLlm.running')}</Badge>
              )}
              {status?.state === 'stopped' && <Badge variant="secondary">{t('settings.localLlm.stopped')}</Badge>}
              {status?.state === 'not-installed' && (
                <Badge variant="secondary">{t('settings.localLlm.notInstalled')}</Badge>
              )}
            </div>
            <p className="mt-1 text-muted-foreground text-xs leading-5">{t('settings.localLlm.ollamaDescription')}</p>
            {running && (
              <p className="mt-1 text-muted-foreground text-xs">
                {t('settings.localLlm.version', { version: status?.version })}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('settings.localLlm.refresh')}
            onClick={() => void reloadStatus()}>
            <RefreshCw className={cn('size-4', statusLoading && 'animate-spin')} />
          </Button>
        </div>

        {statusLoading && !status ? (
          <p role="status" className="mt-4 text-muted-foreground text-xs">
            {t('settings.localLlm.checking')}
          </p>
        ) : status?.state === 'not-installed' ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => void installOllama()} disabled={installing}>
              <Download className="mr-2 size-4" />
              {installing ? t('settings.localLlm.installing') : t('settings.localLlm.install')}
            </Button>
            <a href={OLLAMA_DOWNLOAD_URL} className="inline-flex items-center gap-1 text-link text-xs hover:underline">
              {t('settings.localLlm.officialDownload')}
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        ) : status?.state === 'stopped' ? (
          <div className="mt-4">
            <Button onClick={() => void startOllama()} disabled={starting}>
              <RefreshCw className={cn('mr-2 size-4', starting && 'animate-spin')} />
              {starting ? t('settings.localLlm.starting') : t('settings.localLlm.start')}
            </Button>
          </div>
        ) : null}

        {installProgress && (installing || installProgress.percent === 100) && (
          <div className="mt-4 space-y-1.5" role="status">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full bg-primary transition-all',
                  installProgress.percent === null && 'w-1/3 animate-pulse'
                )}
                style={installProgress.percent === null ? undefined : { width: `${installProgress.percent}%` }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {installProgress.status}
              {installProgress.percent !== null && ` · ${installProgress.percent}%`}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-foreground text-sm">{t('settings.localLlm.pcTitle')}</h2>
        <p className="mt-2 text-muted-foreground text-xs leading-5">
          {t('settings.localLlm.ram', { memory: status ? displayGb(status.device.totalMemoryBytes) : '—' })}
        </p>
        <p className="text-muted-foreground text-xs leading-5">
          {status?.device.gpu
            ? t('settings.localLlm.gpu', {
                name: status.device.gpu.name,
                memory: displayGb(status.device.gpu.vramBytes)
              })
            : t('settings.localLlm.gpuUnknown')}
        </p>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="font-semibold text-foreground text-sm">{t('settings.localLlm.catalogTitle')}</h2>
          <p className="mt-1 text-muted-foreground text-xs leading-5">{t('settings.localLlm.catalogDescription')}</p>
        </div>
        <div className="space-y-5">
          {CATEGORY_KEYS.map((category) => (
            <div key={category}>
              <h3 className="mb-2 font-medium text-foreground text-xs">{t(CATEGORY_LABEL_KEYS[category])}</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {merged.catalog
                  .filter((entry) => entry.category === category)
                  .map((entry) => {
                    const recommendation = status
                      ? recommendLocalLlmModel(entry.parametersBillions, ramGb, vramGb)
                      : null
                    return (
                      <ModelCard
                        key={entry.id}
                        modelName={entry.id}
                        category={entry.category}
                        downloadSize={entry.downloadSize}
                        minimumRamGb={entry.minimumRamGb}
                        speed={entry.speed}
                        installed={entry.installed}
                        recommendation={recommendation}
                        isDefault={entry.recommendedDefault === true}
                        running={running}
                        activePull={activePull?.modelName === entry.id ? activePull : null}
                        progress={activePull?.modelName === entry.id ? activeProgress : null}
                        disabled={
                          statusLoading || installing || starting || (!!activePull && activePull.modelName !== entry.id)
                        }
                        onDownload={() => void pullModel(entry.id)}
                        onCancel={() => void cancelPull()}
                        onDelete={() => void removeModel(entry.id)}
                        onUseInChat={() => void selectModelForChat(entry.id)}
                        canUseInChat={existingModelIds.has(entry.id)}
                      />
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {merged.other.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-foreground text-sm">{t('settings.localLlm.otherInstalled')}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {merged.other.map((entry) => (
              <div key={entry.name} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground text-sm">{entry.name}</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {entry.size
                      ? t('settings.localLlm.installedSize', { size: displayModelSize(entry.size) })
                      : t('settings.localLlm.unknownSize')}
                  </p>
                  <Badge className="mt-2 border-success/30 bg-success/10 text-success">
                    {t('settings.localLlm.installed')}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!running || statusLoading || !!activePull}
                  aria-label={t('settings.localLlm.deleteModel', { model: entry.name })}
                  onClick={() => void removeModel(entry.name)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-border border-dashed p-4">
        <h2 className="font-medium text-foreground text-xs">{t('settings.localLlm.honestNoteTitle')}</h2>
        <p className="mt-1 text-muted-foreground text-xs leading-5">{t('settings.localLlm.honestNote')}</p>
        <a
          href="/app/code"
          onClick={(event) => {
            event.preventDefault()
            void navigate({ to: '/app/code' })
          }}
          className="mt-2 inline-flex items-center gap-1 text-link text-xs hover:underline">
          <Code2 className="size-3.5" />
          {t('settings.localLlm.useInCodeHint')}
          <ArrowUpRight className="size-3.5" />
        </a>
      </section>
    </div>
  )
}

interface ModelCardProps {
  modelName: string
  category: LocalLlmCategory
  downloadSize: string
  minimumRamGb: number
  speed: LocalLlmSpeed
  installed: boolean
  recommendation: LocalLlmRecommendation
  isDefault: boolean
  running: boolean
  activePull: { jobId: string; modelName: string } | null
  progress: Progress | null
  disabled: boolean
  canUseInChat: boolean
  onDownload: () => void
  onCancel: () => void
  onDelete: () => void
  onUseInChat: () => void
}

function ModelCard({
  modelName,
  category,
  downloadSize,
  minimumRamGb,
  speed,
  installed,
  recommendation,
  isDefault,
  running,
  activePull,
  progress,
  disabled,
  canUseInChat,
  onDownload,
  onCancel,
  onDelete,
  onUseInChat
}: ModelCardProps) {
  const { t } = useTranslation()
  const downloading = activePull !== null

  return (
    <article className="flex min-h-52 flex-col rounded-xl border border-border bg-card p-4 transition-colors duration-200 hover:border-border-strong">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="min-w-0 break-all font-medium text-foreground text-sm">{modelName}</h4>
        <div className="flex flex-wrap gap-1.5">
          {installed && (
            <Badge className="border-success/30 bg-success/10 text-success">{t('settings.localLlm.installed')}</Badge>
          )}
          {isDefault && <Badge variant="secondary">{t('settings.localLlm.recommendedDefault')}</Badge>}
          {recommendation === 'recommended' && <Badge variant="secondary">{t('settings.localLlm.recommended')}</Badge>}
          {recommendation === 'slower' && <Badge variant="secondary">{t('settings.localLlm.slower')}</Badge>}
        </div>
      </div>

      <p className="mt-2 text-muted-foreground text-xs leading-5">{t(CATEGORY_DESCRIPTION_KEYS[category])}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{t('settings.localLlm.downloadSize')}</dt>
        <dd className="text-right text-foreground">{downloadSize}</dd>
        <dt className="text-muted-foreground">{t('settings.localLlm.minimumRam')}</dt>
        <dd className="text-right text-foreground">{t('settings.localLlm.ramValue', { memory: minimumRamGb })}</dd>
        <dt className="text-muted-foreground">{t('settings.localLlm.speed')}</dt>
        <dd className="text-right text-foreground">{t(SPEED_KEYS[speed])}</dd>
      </dl>

      {downloading && (
        <div className="mt-3 space-y-1.5" role="status">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full bg-primary transition-all',
                progress?.percent == null && 'w-1/3 animate-pulse'
              )}
              style={progress?.percent == null ? undefined : { width: `${progress.percent}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {progress?.status ?? t('settings.localLlm.preparing')}
            {progress?.percent !== null && progress?.percent !== undefined && ` · ${progress.percent}%`}
          </p>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 border-border border-t pt-3">
        {downloading ? (
          <Button variant="outline" size="sm" className="h-8 flex-1" onClick={onCancel}>
            <X className="mr-1.5 size-3.5" />
            {t('common.cancel')}
          </Button>
        ) : installed ? (
          <>
            <Button variant="outline" size="sm" className="h-8 flex-1" disabled={!canUseInChat} onClick={onUseInChat}>
              <Check className="mr-1.5 size-3.5" />
              {t('settings.localLlm.useInChat')}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!running || disabled}
              aria-label={t('settings.localLlm.deleteModel', { model: modelName })}
              onClick={onDelete}>
              <Trash2 className="size-4" />
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full"
            disabled={!running || disabled}
            onClick={onDownload}>
            <Download className="mr-1.5 size-3.5" />
            {t('common.download')}
          </Button>
        )}
      </div>
    </article>
  )
}

export default LocalLlmSection
