import { ChevronDown, ChevronUp } from 'lucide-react'
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'
import { useCache } from '@data/hooks/useCache'
import { QuickPanelProvider } from '@renderer/components/QuickPanel'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio composes the existing painting flow with Studio-only surfaces.
import StudioGallery from '@renderer/pages/studio/StudioGallery'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio owns the image generation placeholder and retry surface.
import StudioGeneratingBoard from '@renderer/pages/studio/StudioGeneratingBoard'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio owns the full-screen image viewer.
import StudioLightbox from '@renderer/pages/studio/StudioLightbox'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio's inspiration shelf fills the painting prompt draft.
import StudioPromptShelf from '@renderer/pages/studio/StudioPromptShelf'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio's quick controls map existing painting provider options.
import StudioQuickOptions from '@renderer/pages/studio/StudioQuickOptions'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio reveals the existing painting image records in a staggered grid.
import StudioResultBoard from '@renderer/pages/studio/StudioResultBoard'
import { toast } from '@renderer/services/toast'
import type { FileMetadata } from '@renderer/types/file'

import Artboard from './components/Artboard'
import PaintingComposer from './components/PaintingComposer'
import PaintingStrip from './components/PaintingStrip'
import PaintingTemplateShowcase from './components/PaintingTemplateShowcase'
import { usePaintingDraftDefaults } from './hooks/usePaintingDraftDefaults'
import { usePaintingGenerationSubmit } from './hooks/usePaintingGenerationSubmit'
import { usePaintingHistory } from './hooks/usePaintingHistory'
import { usePaintingInitialDraft } from './hooks/usePaintingInitialDraft'
import { usePaintingList } from './hooks/usePaintingList'
import { usePaintingModelCatalog } from './hooks/usePaintingModelCatalog'
import { usePaintingModelSwitch } from './hooks/usePaintingModelSwitch'
import { usePaintingProviderOptions } from './hooks/usePaintingProviderOptions'
import { usePaintingResultSync } from './hooks/usePaintingResultSync'
import { usePaintingSizeInfo } from './hooks/usePaintingSizeInfo'
import { usePaintingTemplateCatalog } from './hooks/usePaintingTemplateCatalog'
import { createDefaultPainting } from './model/paintingPipeline'
import type { PaintingData } from './model/types/paintingData'
import { cacheToPaintingGenerationState } from './model/utils/paintingGenerationParams'
import { paintingClasses } from './paintingPrimitives'
import { getPaintingFileUrl } from './utils/paintingFileUrl'

interface PaintingPageProps {
  studioMode?: boolean
  canEnhancePrompt?: boolean
  enhancingPrompt?: boolean
  onEnhancePrompt?: (prompt: string) => Promise<string>
}

const PaintingPage: FC<PaintingPageProps> = ({
  studioMode = false,
  canEnhancePrompt = false,
  enhancingPrompt = false,
  onEnhancePrompt
}) => {
  const { t } = useTranslation()
  const { templates: promptPresets } = usePaintingTemplateCatalog()
  const providerOptions = usePaintingProviderOptions()
  const draftDefaults = usePaintingDraftDefaults(providerOptions)

  const [currentPainting, setCurrentPainting] = useState<PaintingData>(() => createDefaultPainting(draftDefaults))
  const [studioView, setStudioView] = useState<'generate' | 'gallery'>('generate')
  const [resultLightboxIndex, setResultLightboxIndex] = useState<number | null>(null)
  const [pendingRegeneration, setPendingRegeneration] = useState<PaintingData | null>(null)
  // After generate, collapse the prompt dock so the artboard keeps the space
  // long prompts used to steal (#20739). Blank drafts stay expanded for typing.
  const [promptDockCollapsed, setPromptDockCollapsed] = useState(false)

  const patchPainting = useCallback((updates: Partial<PaintingData>) => {
    setCurrentPainting((current) => ({ ...current, ...updates }))
  }, [])

  const history = usePaintingHistory()

  usePaintingInitialDraft({
    currentPainting,
    draftDefaults,
    setCurrentPainting
  })

  // Backfill a background generation's output files when they only reached
  // refreshed history (its completion couldn't update the no-longer-visible
  // draft), so the Artboard reveal doesn't strand on a permanent skeleton.
  usePaintingResultSync({ currentPainting, historyItems: history.items, setCurrentPainting })

  // Rehydrate the running spinner after a page switch: the cache mirror of
  // generation state survives unmount, so re-mounting picks it back up.
  const [cachedGeneration] = useCache(`painting.generation.${currentPainting.id}`)
  const liveGenerationState = useMemo(() => cacheToPaintingGenerationState(cachedGeneration), [cachedGeneration])

  const modelCatalog = usePaintingModelCatalog({
    providerOptions,
    painting: currentPainting
  })

  // Historical model-less rows and drafts without a valid configured default
  // still need a usable view fallback. New drafts receive the configured model
  // as stored in-memory state before reaching this path.
  const composerPainting = useMemo<PaintingData>(() => {
    if (currentPainting.model) return currentPainting
    const fallback = modelCatalog.currentModelOptions.find((option) => option.isEnabled !== false)?.value
    return fallback ? { ...currentPainting, model: String(fallback) } : currentPainting
  }, [currentPainting, modelCatalog.currentModelOptions])
  const { ratio } = usePaintingSizeInfo(composerPainting)

  const {
    generating: liveGenerating,
    submitting,
    preparing,
    submit,
    cancel: cancelGeneration
  } = usePaintingGenerationSubmit({
    painting: composerPainting,
    onPaintingChange: setCurrentPainting,
    ensureCurrentCatalog: modelCatalog.ensureCurrentCatalog
  })

  // After a page switch the local `liveGenerating` boots false because
  // `usePaintingGeneration` reads from `painting.generationStatus` — the
  // painting record is a frozen receipt with no status. The cache fills the
  // gap: if its `status === 'running'` for this painting, keep the spinner.
  const generating = liveGenerating || liveGenerationState.generationStatus === 'running'
  const generationStatus = currentPainting.generationStatus ?? liveGenerationState.generationStatus
  const generationError = currentPainting.generationError ?? liveGenerationState.generationError
  const showTemplateShowcase =
    !currentPainting.persistedAt &&
    currentPainting.files.length === 0 &&
    !submitting &&
    !generating &&
    !currentPainting.generationStatus &&
    !liveGenerationState.generationStatus

  const switchModel = usePaintingModelSwitch({
    painting: currentPainting,
    onPaintingChange: patchPainting,
    ensureProviderCatalog: modelCatalog.ensureProviderCatalog
  })

  const list = usePaintingList({
    painting: currentPainting,
    setCurrentPainting,
    draftDefaults,
    historyItems: history.items,
    cancelGeneration
  })

  // Preparation may still replace/write the record. Once generation is running,
  // it only persists output files and New can save editable fields independently.
  const busy = list.saving || preparing

  const onCancel = useCallback(() => cancelGeneration(currentPainting.id), [cancelGeneration, currentPainting.id])
  const retryGeneration = useCallback(
    () => void submit(async () => ({ entries: composerPainting.inputFiles ?? [], complete: true })),
    [composerPainting.inputFiles, submit]
  )
  const saveCurrentRef = useRef(list.saveCurrent)
  saveCurrentRef.current = list.saveCurrent
  const hasGeneratedImages = composerPainting.files.length > 0
  const canCollapsePromptDock = hasGeneratedImages && !showTemplateShowcase

  useEffect(() => {
    return () => {
      void saveCurrentRef.current()
    }
  }, [])

  // Collapse when a painting gains output files (fresh generate or select with
  // images). Expand again while generating so Cancel stays reachable, and for
  // blank drafts that still need the full composer.
  useEffect(() => {
    if (generating || showTemplateShowcase || !hasGeneratedImages) {
      setPromptDockCollapsed(false)
      return
    }
    setPromptDockCollapsed(true)
  }, [composerPainting.id, generating, hasGeneratedImages, showTemplateShowcase])

  useEffect(() => {
    if (!studioMode || !pendingRegeneration || currentPainting.id !== pendingRegeneration.id) return
    const target = pendingRegeneration
    setPendingRegeneration(null)
    void submit(async () => ({ entries: target.inputFiles ?? [], complete: true }))
  }, [currentPainting.id, pendingRegeneration, studioMode, submit])

  const handleReusePrompt = useCallback(
    async (painting: PaintingData) => {
      await list.add()
      setCurrentPainting((current) => ({ ...current, files: [], inputFiles: [], prompt: painting.prompt }))
      setStudioView('generate')
    },
    [list]
  )

  const handleRegenerate = useCallback(
    async (painting: PaintingData) => {
      if (painting.id === currentPainting.id) setCurrentPainting({ ...painting })
      else await list.select(painting)
      setStudioView('generate')
      setPendingRegeneration(painting)
    },
    [currentPainting.id, list]
  )

  const handleDownload = useCallback((_painting: PaintingData, file: FileMetadata) => {
    const fileUrl = getPaintingFileUrl(file)
    if (!fileUrl) return
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = `ott24x7-studio.${file.ext || 'png'}`
    link.click()
  }, [])

  const handleCopyPrompt = useCallback(
    async (painting: PaintingData) => {
      try {
        await navigator.clipboard.writeText(painting.prompt)
        toast.success(t('studio.prompt_helper.copied'))
      } catch (error) {
        toast.errorFromException(error)
      }
    },
    [t]
  )

  return (
    <div data-ui={studioMode ? 'studio.generate' : 'paintings.view'} className={paintingClasses.page}>
      {studioMode && (
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
          <Button
            variant={studioView === 'generate' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={studioView === 'generate'}
            onClick={() => setStudioView('generate')}>
            {t('studio.generate.create')}
          </Button>
          <Button
            variant={studioView === 'gallery' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={studioView === 'gallery'}
            onClick={() => setStudioView('gallery')}>
            {t('studio.generate.gallery')}
          </Button>
        </div>
      )}
      {studioMode && studioView === 'gallery' ? (
        <StudioGallery
          items={history.items}
          isLoading={history.isLoading}
          onDownload={handleDownload}
          onCopyPrompt={(painting) => void handleCopyPrompt(painting)}
          onReusePrompt={(painting) => void handleReusePrompt(painting)}
          onRegenerate={(painting) => void handleRegenerate(painting)}
          onDelete={list.remove}
        />
      ) : (
        <div className={paintingClasses.content} inert={busy} aria-busy={busy}>
          <div className="flex h-full flex-1 flex-col">
            <div className={paintingClasses.frame}>
              <div className={paintingClasses.surface}>
                <PaintingStrip
                  selectedPaintingId={currentPainting.id}
                  runningPaintingId={generating ? currentPainting.id : undefined}
                  items={history.items}
                  hasMore={history.hasMore}
                  loadMore={history.loadMore}
                  onDeletePainting={list.remove}
                  onSelectPainting={list.select}
                  onAddPainting={list.add}
                  adding={busy}
                />

                <div className={paintingClasses.centerPane} data-composer-stage="">
                  <div className={paintingClasses.centerStage}>
                    {studioMode && (submitting || generating || generationStatus === 'failed') ? (
                      <StudioGeneratingBoard
                        painting={{ ...composerPainting, generationStatus, generationError }}
                        aspectRatio={ratio}
                        onCancel={onCancel}
                        onRetry={retryGeneration}
                      />
                    ) : studioMode && composerPainting.files.length > 0 ? (
                      <StudioResultBoard painting={composerPainting} onOpenImage={setResultLightboxIndex} />
                    ) : (
                      !showTemplateShowcase && <Artboard painting={composerPainting} isLoading={generating} />
                    )}
                  </div>
                  {showTemplateShowcase && (
                    <section
                      data-testid="painting-template-stage"
                      className="[container-type:size] absolute inset-0 z-0 mx-auto flex min-h-0 w-full max-w-5xl items-center justify-center overflow-hidden px-3 pt-3 pb-36">
                      {studioMode ? (
                        <StudioPromptShelf onSelectPrompt={(prompt) => patchPainting({ prompt })} />
                      ) : (
                        <div className="flex h-full max-h-80 min-h-0 w-full flex-col items-center">
                          <h1 className="max-w-xl shrink-0 text-center [font-size:clamp(var(--font-size-heading-sm),4cqw,var(--font-size-heading-md))] [line-height:1.1] font-bold tracking-tight">
                            {t('paintings.showcase.title')}
                          </h1>

                          <div className="mt-[clamp(8px,5cqh,30px)] flex min-h-0 w-full flex-1 flex-col items-center">
                            {promptPresets.length > 0 ? (
                              <PaintingTemplateShowcase
                                paintingId={composerPainting.id}
                                prompt={composerPainting.prompt}
                                templates={promptPresets}
                                onSelect={(prompt) => patchPainting({ prompt })}
                              />
                            ) : (
                              <Artboard painting={composerPainting} isLoading={false} />
                            )}

                            <p className="mt-[clamp(4px,2cqh,10px)] max-w-lg shrink-0 px-4 pb-1 text-center text-xs leading-5 text-muted-foreground">
                              {t('paintings.showcase.caption')}
                            </p>
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                  {canCollapsePromptDock && promptDockCollapsed ? (
                    <div className={paintingClasses.promptDockCollapsed} data-testid="painting-prompt-dock-collapsed">
                      <button
                        type="button"
                        className={paintingClasses.promptDockToggle}
                        aria-expanded={false}
                        aria-label={t('paintings.prompt_dock.expand')}
                        onClick={() => setPromptDockCollapsed(false)}>
                        <ChevronUp className="size-3.5" aria-hidden />
                        {t('paintings.prompt_dock.expand')}
                      </button>
                    </div>
                  ) : (
                    <div
                      className={paintingClasses.promptDock}
                      data-composer-dock-surface=""
                      data-testid="painting-prompt-dock">
                      {studioMode && <StudioQuickOptions painting={composerPainting} onChange={patchPainting} />}
                      {canCollapsePromptDock && (
                        <div className="mx-auto mb-1 flex w-full max-w-5xl justify-center">
                          <button
                            type="button"
                            className={paintingClasses.promptDockToggle}
                            aria-expanded={true}
                            aria-label={t('paintings.prompt_dock.minimize')}
                            onClick={() => setPromptDockCollapsed(true)}>
                            <ChevronDown className="size-3.5" aria-hidden />
                            {t('paintings.prompt_dock.minimize')}
                          </button>
                        </div>
                      )}
                      <div className="mx-auto w-full max-w-5xl">
                        <QuickPanelProvider>
                          <PaintingComposer
                            painting={composerPainting}
                            generating={generating}
                            submitting={submitting}
                            onPromptChange={(prompt) => patchPainting({ prompt })}
                            onGenerate={submit}
                            onCancel={onCancel}
                            onModelSelect={switchModel}
                            onConfigChange={patchPainting}
                            canEnhancePrompt={canEnhancePrompt}
                            enhancingPrompt={enhancingPrompt}
                            onEnhancePrompt={onEnhancePrompt}
                            onGenerateRandomSeed={(key) =>
                              patchPainting({
                                params: {
                                  ...currentPainting.params,
                                  [key]: String(Math.floor(Math.random() * 1_000_000))
                                }
                              })
                            }
                          />
                        </QuickPanelProvider>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {studioMode && resultLightboxIndex !== null && composerPainting.files.length > 0 && (
        <StudioLightbox
          painting={composerPainting}
          fileIndex={resultLightboxIndex}
          count={composerPainting.files.length}
          modelName={`${composerPainting.providerId} · ${composerPainting.model ?? ''}`}
          onClose={() => setResultLightboxIndex(null)}
          onMove={(direction) =>
            setResultLightboxIndex((current) =>
              current === null
                ? 0
                : (current + direction + composerPainting.files.length) % composerPainting.files.length
            )
          }
        />
      )}
    </div>
  )
}

export default PaintingPage
