import { useNavigate } from '@tanstack/react-router'
import {
  Clapperboard,
  Clock3,
  Copy,
  Download,
  Film,
  ImagePlus,
  LayoutGrid,
  LoaderCircle,
  Play,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Square,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { type ClipboardEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, ConfirmDialog, Switch, Textarea } from '@cherrystudio/ui'
import { useModels } from '@renderer/hooks/useModel'
import { useProviders } from '@renderer/hooks/useProvider'
import { ipcApi, useIpcOn } from '@renderer/ipc'
import { toast } from '@renderer/services/toast'
import type { VideoGenerationRecord } from '@shared/types/videoGeneration'
import { getRawModelId } from '@shared/utils/model'
import {
  filterVideoGenerationModels,
  getVideoCostEstimate,
  getVideoModelOptions,
  isTerminalVideoStatus
} from '@shared/utils/videoGeneration'

import { getStudioGenerationStatusIndex, getStudioRevealMotion } from '../studioGeneration'
import StudioVideoLightbox from './StudioVideoLightbox'

const MAX_REFERENCE_IMAGE_BYTES = 12 * 1024 * 1024
const VIDEO_TEMPLATES = ['cinematic', 'product', 'anime', 'talking_pet', 'drone', 'slow_motion'] as const
type VideoTemplate = (typeof VIDEO_TEMPLATES)[number]
type FeedMode = 'grid' | 'list'

interface StudioVideoTabProps {
  canEnhancePrompt?: boolean
  enhancingPrompt?: boolean
  onEnhancePrompt: (prompt: string) => Promise<string>
}

export default function StudioVideoTab({
  canEnhancePrompt = false,
  enhancingPrompt = false,
  onEnhancePrompt
}: StudioVideoTabProps) {
  const { t } = useTranslation()
  const reduceMotion = Boolean(useReducedMotion())
  const navigate = useNavigate()
  const { models } = useModels({ enabled: true })
  const { providers } = useProviders({ enabled: true })
  const [records, setRecords] = useState<VideoGenerationRecord[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(5)
  const [ratio, setRatio] = useState('16:9')
  const [resolution, setResolution] = useState('')
  const [generateAudio, setGenerateAudio] = useState(true)
  const [referenceImage, setReferenceImage] = useState<{ dataUrl: string; name: string } | undefined>()
  const [feedMode, setFeedMode] = useState<FeedMode>('grid')
  const [lightboxRecord, setLightboxRecord] = useState<VideoGenerationRecord>()
  const [deleteTarget, setDeleteTarget] = useState<VideoGenerationRecord>()
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const availableModels = useMemo(() => filterVideoGenerationModels(models, providers), [models, providers])
  const selectedModel = availableModels.find((model) => model.id === selectedModelId) ?? availableModels[0]
  const modelOptions = selectedModel ? getVideoModelOptions(getRawModelId(selectedModel)) : undefined
  const sortedRecords = useMemo(
    () => [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [records]
  )
  const activeRecords = records.filter((record) => !isTerminalVideoStatus(record.status))
  const cost = selectedModel ? getVideoCostEstimate(getRawModelId(selectedModel), duration, resolution) : undefined

  const refresh = useCallback(async () => {
    try {
      setRecords(await ipcApi.request('video.generation.list'))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useIpcOn('video.generation.updated', (record) => {
    setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)])
    setLightboxRecord((current) => (current?.id === record.id ? record : current))
  })

  useEffect(() => {
    if (selectedModelId && availableModels.some((model) => model.id === selectedModelId)) return
    if (availableModels[0]) setSelectedModelId(availableModels[0].id)
    else setSelectedModelId('')
  }, [availableModels, selectedModelId])

  useEffect(() => {
    if (!activeRecords.length) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeRecords.length])

  useEffect(() => {
    if (!selectedModel || !modelOptions) return
    if (!modelOptions.durations.includes(duration)) setDuration(modelOptions.durations[0])
    if (!modelOptions.ratios.includes(ratio)) setRatio(modelOptions.ratios[0] ?? 'auto')
    if (resolution && !modelOptions.resolutions.includes(resolution as '480p' | '720p' | '1080p')) setResolution('')
    if (!modelOptions.supportsAudio) setGenerateAudio(false)
    if (!modelOptions.supportsImageReference) setReferenceImage(undefined)
  }, [selectedModel, modelOptions, duration, ratio, resolution])

  const loadReference = useCallback(
    async (file?: File) => {
      if (!file) return
      if (!file.type.startsWith('image/')) {
        toast.error(t('studio.video.reference_image_only'))
        return
      }
      if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
        toast.error(t('studio.video.reference_too_large'))
        return
      }
      const dataUrl = await fileToDataUrl(file)
      setReferenceImage({ dataUrl, name: file.name })
    },
    [t]
  )

  const handlePromptPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      if (!modelOptions?.supportsImageReference) return
      const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'))
      const imageFile = imageItem?.getAsFile()
      if (imageFile) {
        event.preventDefault()
        void loadReference(imageFile)
      }
    },
    [loadReference, modelOptions?.supportsImageReference]
  )

  const createGeneration = useCallback(async () => {
    if (!selectedModel || !prompt.trim() || !modelOptions) return
    try {
      const record = await ipcApi.request('video.generation.create', {
        modelId: selectedModel.id,
        prompt: prompt.trim(),
        duration,
        ...(modelOptions.supportsRatio && ratio !== 'auto' ? { ratio } : {}),
        ...(resolution ? { resolution: resolution as '480p' | '720p' | '1080p' } : {}),
        generateAudio: modelOptions.supportsAudio && generateAudio,
        ...(referenceImage && modelOptions.supportsImageReference ? { inputReference: referenceImage.dataUrl } : {})
      })
      setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)])
      setPrompt('')
    } catch (error) {
      toast.errorFromException(error ?? new Error(t('common.error')))
    }
  }, [duration, generateAudio, modelOptions, prompt, ratio, referenceImage, resolution, selectedModel, t])

  const regenerate = useCallback(
    async (record: VideoGenerationRecord) => {
      const model = availableModels.find((item) => item.id === record.modelId)
      if (!model) {
        toast.error(t('studio.video.no_model_title'))
        return
      }
      try {
        const next = await ipcApi.request('video.generation.create', {
          modelId: model.id,
          prompt: record.prompt,
          duration: record.duration,
          ...(record.ratio !== 'auto' ? { ratio: record.ratio } : {}),
          ...(record.resolution ? { resolution: record.resolution } : {}),
          generateAudio: record.generateAudio
        })
        setRecords((current) => [next, ...current.filter((item) => item.id !== next.id)])
      } catch (error) {
        toast.errorFromException(error ?? new Error(t('common.error')))
      }
    },
    [availableModels, t]
  )

  const applyTemplate = (template: VideoTemplate) => {
    setPrompt(t(`studio.video.templates.${template}_prompt`))
  }

  const reuseRecord = (record: VideoGenerationRecord) => {
    const match = availableModels.find((model) => model.id === record.modelId)
    if (match) setSelectedModelId(match.id)
    setPrompt(record.prompt)
    setDuration(record.duration)
    setRatio(record.ratio)
    setResolution(record.resolution ?? '')
    setGenerateAudio(record.generateAudio)
    document.querySelector('[data-video-prompt]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const saveVideo = async (record: VideoGenerationRecord) => {
    try {
      if (await ipcApi.request('video.generation.save', { id: record.id })) toast.success(t('common.success'))
    } catch (error) {
      toast.errorFromException(error ?? new Error(t('common.error')))
    }
  }

  const copyPrompt = async (record: VideoGenerationRecord) => {
    try {
      await navigator.clipboard.writeText(record.prompt)
      toast.success(t('studio.prompt_helper.copied'))
    } catch {
      toast.error(t('common.copy_failed'))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await ipcApi.request('video.generation.delete', { id: deleteTarget.id })
      setRecords((current) => current.filter((record) => record.id !== deleteTarget.id))
      setDeleteTarget(undefined)
    } catch (error) {
      toast.errorFromException(error ?? new Error(t('common.delete_failed')))
    }
  }

  const cancelRecord = async (record: VideoGenerationRecord) => {
    try {
      await ipcApi.request('video.generation.cancel', { id: record.id })
      toast.info(t('studio.video.cancel_notice'))
    } catch (error) {
      toast.errorFromException(error ?? new Error(t('common.error')))
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background lg:flex-row">
      <aside className="flex max-h-[54vh] w-full shrink-0 flex-col overflow-y-auto border-border border-b bg-card/45 lg:max-h-none lg:w-[330px] lg:border-r lg:border-b-0 xl:w-[360px]">
        <div className="border-border border-b px-5 py-5">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Clapperboard className="size-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{t('studio.video.kicker')}</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{t('studio.video.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('studio.video.subtitle')}</p>
        </div>

        <div className="flex flex-col gap-5 p-5">
          {availableModels.length ? (
            <label className="grid gap-2 text-sm">
              <span className="font-medium">{t('studio.video.model')}</span>
              <select
                aria-label={t('studio.video.model')}
                value={selectedModel?.id ?? ''}
                onChange={(event) => setSelectedModelId(event.target.value)}
                className="h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {`${model.name} · ${providers.find((provider) => provider.id === model.providerId)?.name ?? model.providerId}`}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Film className="size-4" />
              </div>
              <h2 className="font-medium text-sm">{t('studio.video.no_model_title')}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('studio.video.no_model_description')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void navigate({ to: '/settings/provider' })}>
                {t('studio.video.configure_provider')}
              </Button>
            </div>
          )}

          <div className="grid gap-2" data-video-prompt>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="studio-video-prompt" className="text-sm font-medium">
                {t('studio.video.prompt')}
              </label>
              {canEnhancePrompt && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-primary"
                  disabled={!prompt.trim() || enhancingPrompt}
                  onClick={async () => {
                    const improved = await onEnhancePrompt(prompt)
                    if (improved) setPrompt(improved)
                  }}>
                  {enhancingPrompt ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <WandSparkles className="size-3.5" />
                  )}
                  {t('studio.video.enhance')}
                </Button>
              )}
            </div>
            <Textarea.Input
              id="studio-video-prompt"
              aria-label={t('studio.video.prompt')}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onPaste={handlePromptPaste}
              onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault()
                  void createGeneration()
                }
              }}
              placeholder={t('studio.video.prompt_placeholder')}
              maxLength={8000}
              className="min-h-28 resize-y rounded-lg bg-background text-sm leading-relaxed"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              {modelOptions?.supportsImageReference ? <span>{t('studio.video.paste_image_hint')}</span> : <span />}
              <span>{prompt.length}/8000</span>
            </div>
          </div>

          {modelOptions?.supportsImageReference && (
            <div
              className="rounded-xl border border-dashed border-border bg-background/70 p-3 transition-colors hover:border-primary/50"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                void loadReference(event.dataTransfer.files[0])
              }}>
              {referenceImage ? (
                <div className="flex items-center gap-3">
                  <img src={referenceImage.dataUrl} alt="" className="size-12 rounded-md object-cover" />
                  <span className="min-w-0 flex-1 truncate text-xs">{referenceImage.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('studio.video.remove_reference')}
                    onClick={() => setReferenceImage(undefined)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => fileInputRef.current?.click()}>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <ImagePlus className="size-4" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium">{t('studio.video.add_reference')}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {t('studio.video.drop_reference')}
                    </span>
                  </span>
                  <Upload className="size-4 text-muted-foreground" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  void loadReference(event.target.files?.[0])
                  event.currentTarget.value = ''
                }}
              />
            </div>
          )}

          {modelOptions && (
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{t('studio.video.duration')}</span>
                  <span className="text-muted-foreground">{t('studio.video.seconds')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {modelOptions.durations.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      aria-pressed={duration === seconds}
                      onClick={() => setDuration(seconds)}
                      className={`min-w-12 shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${duration === seconds ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}>
                      {seconds}s
                    </button>
                  ))}
                </div>
              </div>
              {modelOptions.supportsRatio && modelOptions.ratios.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium">{t('studio.video.aspect_ratio')}</p>
                  <div className="flex flex-wrap gap-2">
                    {['auto', ...modelOptions.ratios].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={ratio === value}
                        onClick={() => setRatio(value)}
                        className={`flex min-w-14 flex-col items-center gap-1 rounded-md border px-2.5 py-1.5 text-[10px] transition-colors ${ratio === value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}>
                        {value === 'auto' ? (
                          <span className="flex h-4 w-4 items-center justify-center rounded-sm border border-current border-dashed" />
                        ) : (
                          <RatioIcon ratio={value} />
                        )}
                        <span>{value === 'auto' ? t('studio.video.auto') : value}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {modelOptions.resolutions.length > 0 && (
                <label className="grid gap-2 text-xs font-medium">
                  {t('studio.video.resolution')}
                  <select
                    aria-label={t('studio.video.resolution')}
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-normal focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
                    <option value="">{t('studio.video.default')}</option>
                    {modelOptions.resolutions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {modelOptions.supportsAudio && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                  <div>
                    <p className="text-xs font-medium">{t('studio.video.generate_audio')}</p>
                    <p className="text-[11px] text-muted-foreground">{t('studio.video.audio_description')}</p>
                  </div>
                  <Switch
                    checked={generateAudio}
                    onCheckedChange={setGenerateAudio}
                    aria-label={t('studio.video.generate_audio')}
                    size="sm"
                  />
                </div>
              )}
            </div>
          )}

          <div className="mt-1 border-t border-border pt-4">
            {cost === undefined ? (
              <p className="mb-3 text-[11px] text-muted-foreground">{t('studio.video.estimate_unknown')}</p>
            ) : (
              <p className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{t('studio.video.estimate')}</span>
                <span className="font-medium text-foreground">${cost.toFixed(2)}</span>
                <span>{t('studio.video.approximate')}</span>
              </p>
            )}
            <Button
              className="w-full gap-2"
              disabled={!selectedModel || !prompt.trim()}
              onClick={() => void createGeneration()}>
              <Sparkles className="size-4" />
              {t('studio.video.generate')}
            </Button>
          </div>
        </div>
      </aside>

      <section className="flex min-h-[320px] min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-border border-b px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">{t('studio.video.your_videos')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('studio.video.gallery_subtitle', { count: records.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeRecords.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                {t('studio.video.generating_count', { count: activeRecords.length })}
              </span>
            )}
            <div className="flex rounded-lg border border-border p-0.5">
              <Button
                variant={feedMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-7"
                aria-label={t('studio.video.grid_view')}
                aria-pressed={feedMode === 'grid'}
                onClick={() => setFeedMode('grid')}>
                <LayoutGrid className="size-3.5" />
              </Button>
              <Button
                variant={feedMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-7"
                aria-label={t('studio.video.list_view')}
                aria-pressed={feedMode === 'list'}
                onClick={() => setFeedMode('list')}>
                <span className="text-sm leading-none">☷</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-full min-h-48 items-center justify-center text-muted-foreground">
              <LoaderCircle className="size-5 animate-spin" />
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          ) : sortedRecords.length === 0 ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
                <Film className="size-7" />
              </div>
              <h3 className="font-medium">{t('studio.video.empty_title')}</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t('studio.video.empty_description')}</p>
              <p className="mt-5 text-xs font-medium text-muted-foreground">{t('studio.video.try_template')}</p>
              <div className="mt-3 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
                {VIDEO_TEMPLATES.map((template, index) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="group overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md motion-reduce:transform-none">
                    <div className={`relative aspect-[16/9] overflow-hidden ${TEMPLATE_GRADIENTS[index]}`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-background/5 via-transparent to-background/40" />
                      <div className="absolute inset-0 flex items-center justify-center text-foreground/70 transition-transform duration-200 group-hover:scale-110 motion-reduce:transform-none">
                        <Film className="size-7 drop-shadow" />
                      </div>
                    </div>
                    <span className="block px-3 py-2 text-xs font-medium">
                      {t(`studio.video.templates.${template}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              className={
                feedMode === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3' : 'flex flex-col gap-3'
              }>
              {sortedRecords.map((record) => (
                <VideoRecordCard
                  key={`${record.id}-${record.status}`}
                  record={record}
                  now={now}
                  mode={feedMode}
                  onOpen={() => record.status === 'completed' && setLightboxRecord(record)}
                  onSave={() => void saveVideo(record)}
                  onCopy={() => void copyPrompt(record)}
                  onReuse={() => reuseRecord(record)}
                  onRegenerate={() => void regenerate(record)}
                  onDelete={() => setDeleteTarget(record)}
                  onCancel={() => void cancelRecord(record)}
                  translate={t}
                  reduceMotion={reduceMotion}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {lightboxRecord && <StudioVideoLightbox record={lightboxRecord} onClose={() => setLightboxRecord(undefined)} />}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('studio.gallery.delete_title')}
        description={t('common.delete_confirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  )
}

interface VideoRecordCardProps {
  record: VideoGenerationRecord
  now: number
  mode: FeedMode
  onOpen: () => void
  onSave: () => void
  onCopy: () => void
  onReuse: () => void
  onRegenerate: () => void
  onDelete: () => void
  onCancel: () => void
  translate: (key: string, options?: Record<string, unknown>) => string
  reduceMotion: boolean
}

function VideoRecordCard({
  record,
  now,
  mode,
  onOpen,
  onSave,
  onCopy,
  onReuse,
  onRegenerate,
  onDelete,
  onCancel,
  translate: t,
  reduceMotion
}: VideoRecordCardProps) {
  const [hovered, setHovered] = useState(false)
  const previewRef = useRef<HTMLVideoElement>(null)
  const active = !isTerminalVideoStatus(record.status)
  const failed = record.status === 'failed'
  const elapsed = Math.max(0, Math.floor((now - record.startedAt) / 1000))
  const reveal = getStudioRevealMotion(getStudioGenerationStatusIndex(elapsed * 1000), reduceMotion)
  const aspectRatio = mode === 'list' ? '16 / 9' : record.ratio === 'auto' ? '16 / 9' : record.ratio.replace(':', ' / ')

  useEffect(() => {
    const video = previewRef.current
    if (!video || record.status !== 'completed') return
    if (hovered) void video.play().catch(() => undefined)
    else video.pause()
  }, [hovered, record.status])

  return (
    <motion.article
      initial={record.status === 'completed' ? reveal.initial : false}
      animate={{ filter: 'blur(0px)', opacity: 1, scale: 1 }}
      transition={record.status === 'completed' ? reveal.transition : { duration: 0.18 }}
      className={`group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-border-subtle hover:shadow-md ${mode === 'list' ? 'flex flex-col sm:flex-row' : ''}`}>
      <button
        type="button"
        onClick={onOpen}
        disabled={record.status !== 'completed'}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ aspectRatio }}
        className={`relative block overflow-hidden bg-muted text-left ${mode === 'list' ? 'sm:w-56 sm:shrink-0' : 'w-full'}`}>
        {record.status === 'completed' && record.videoUrl ? (
          <video
            ref={previewRef}
            src={record.videoUrl}
            className="size-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : active ? (
          <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-primary/20 via-secondary to-muted">
            <div className="absolute -inset-x-1/2 top-0 h-1/2 animate-pulse rounded-full bg-primary/10 blur-3xl motion-reduce:animate-none" />
            <div className="relative flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="relative flex size-14 items-center justify-center rounded-full border border-primary/30 bg-background/75 text-primary shadow-lg backdrop-blur">
                <LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {record.progress == null
                    ? t(`studio.video.stage.${getVideoStageIndex(record, elapsed)}`)
                    : `${Math.round(record.progress)}%`}
                </p>
                <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3" />
                  {formatElapsed(elapsed)}
                </p>
              </div>
              <div className="absolute inset-x-4 bottom-3 h-1 overflow-hidden rounded-full bg-background/75">
                <div
                  className={`h-full rounded-full bg-primary transition-all ${record.progress == null ? 'w-1/3 animate-pulse motion-reduce:animate-none' : ''}`}
                  style={record.progress == null ? undefined : { width: `${record.progress}%` }}
                />
              </div>
            </div>
          </div>
        ) : failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-destructive/5 px-4 text-center">
            <Film className="size-7 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {t(`studio.video.errors.${record.errorCode ?? 'GENERATION_FAILED'}`)}
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <span className="text-xs text-muted-foreground">{t(`studio.video.status.${record.status}`)}</span>
          </div>
        )}
        {record.status === 'completed' && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity group-hover:bg-black/20 group-hover:opacity-100">
            <Play className="size-10 fill-current drop-shadow" />
          </span>
        )}
        {record.status === 'completed' && (
          <span className="absolute bottom-2 right-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
            {record.duration}s
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-2 text-xs leading-relaxed text-foreground">{record.prompt}</p>
            <p className="mt-2 truncate text-[11px] text-muted-foreground">
              <span className="rounded bg-secondary px-1.5 py-0.5 text-foreground">{record.modelName}</span>
              <span className="px-1">·</span> {new Date(record.createdAt).toLocaleString()}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="rounded bg-secondary px-1.5 py-0.5">{record.duration}s</span>
              {record.ratio !== 'auto' && <span className="rounded bg-secondary px-1.5 py-0.5">{record.ratio}</span>}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${record.status === 'completed' ? 'bg-success/10 text-success' : failed ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
            {t(`studio.video.status.${record.status}`)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {record.status === 'completed' && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onSave}>
              <Download className="size-3.5" />
              {t('common.download')}
            </Button>
          )}
          {active && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onCancel}>
              <X className="size-3.5" />
              {t('studio.video.cancel')}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onCopy}>
            <Copy className="size-3.5" />
            {t('common.copy')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onReuse}>
            <RotateCcw className="size-3.5" />
            {t('studio.video.reuse')}
          </Button>
          {isTerminalVideoStatus(record.status) && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onRegenerate}>
              <Play className="size-3.5" />
              {t('studio.gallery.regenerate')}
            </Button>
          )}
          {isTerminalVideoStatus(record.status) && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common.delete')}
              className="ml-auto size-7 text-muted-foreground hover:text-destructive"
              onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  )
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image'))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

const TEMPLATE_GRADIENTS = [
  'bg-gradient-to-br from-primary/25 via-accent/20 to-secondary',
  'bg-gradient-to-br from-accent/30 via-secondary to-primary/15',
  'bg-gradient-to-br from-primary/20 via-secondary to-muted',
  'bg-gradient-to-br from-accent/20 via-primary/10 to-card',
  'bg-gradient-to-br from-secondary via-accent/20 to-primary/20',
  'bg-gradient-to-br from-muted via-secondary to-accent/20'
]

function getVideoStageIndex(record: VideoGenerationRecord, elapsedSeconds: number): number {
  if (record.status === 'queued') return 0
  return 1 + (Math.floor(elapsedSeconds / 4) % 3)
}

function RatioIcon({ ratio }: { ratio: string }) {
  if (ratio === '1:1') return <Square className="size-4" />
  const [width = 16, height = 9] = ratio.split(':').map(Number)
  return width >= height ? <RectangleHorizontal className="size-4" /> : <RectangleVertical className="size-4" />
}
