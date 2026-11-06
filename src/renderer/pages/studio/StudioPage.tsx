import { useNavigate, useSearch } from '@tanstack/react-router'
import { ImagePlus, PanelRightOpen, SquareArrowOutUpRight, Video } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, EmptyState } from '@cherrystudio/ui'
import { usePersistCache } from '@data/hooks/useCache'
import MiniAppIcon from '@renderer/components/icons/MiniAppIcon'
import { useMiniApps } from '@renderer/hooks/useMiniApps'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio embeds the saved-session Mini App pane.
import MiniAppPane from '@renderer/pages/miniApps/components/MiniAppPane'
// eslint-disable-next-line import-x/no-restricted-paths -- Generate reuses the existing Paintings experience.
import PaintingPage from '@renderer/pages/paintings/PaintingPage'
import { toast } from '@renderer/services/toast'
import { openExternalWebsite } from '@renderer/services/website'

import PromptHelper from './PromptHelper'
import { improveStudioPrompt } from './studioPrompt'
import { miniAppIdForStudioTab, studioTabFromMiniAppId, type StudioTabId } from './studioRouting'
import StudioWebPaneLayer from './StudioWebPaneLayer'
import { useStudioPromptModel } from './useStudioPromptModel'
import StudioVideoTab from './video/StudioVideoTab'

const TAB_LABEL_KEYS: Record<StudioTabId, string> = {
  generate: 'studio.tabs.generate',
  video: 'studio.tabs.video',
  gemini: 'studio.tabs.gemini',
  flow: 'studio.tabs.flow',
  'chatgpt-images': 'studio.tabs.chatgpt_images',
  designer: 'studio.tabs.designer'
}

const TABS = Object.keys(TAB_LABEL_KEYS) as StudioTabId[]

const TAB_ICONS = {
  generate: ImagePlus,
  video: Video,
  gemini: null,
  flow: null,
  'chatgpt-images': null,
  designer: null
} satisfies Record<StudioTabId, typeof ImagePlus | null>

export default function StudioPage() {
  const { t } = useTranslation()
  const reduceMotion = Boolean(useReducedMotion())
  const navigate = useNavigate()
  const { miniApp, tab: searchTab } = useSearch({ from: '/app/studio' })
  const { allApps } = useMiniApps()
  const [promptHelperOpen, setPromptHelperOpen] = useState(true)
  const [webviewLoading, setWebviewLoading] = useState(true)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [signInHintDismissed, setSignInHintDismissed] = usePersistCache('ui.studio.sign_in_hint_dismissed')
  const [enhancingPrompt, setEnhancingPrompt] = useState(false)
  const promptModel = useStudioPromptModel()
  const tab = studioTabFromMiniAppId(miniApp, searchTab)
  const miniAppId = miniAppIdForStudioTab(tab)
  const selectedApp = miniAppId ? allApps.find((app) => app.appId === miniAppId) : undefined
  const miniAppByTab = new Map(
    TABS.flatMap((tabId) => {
      const id = miniAppIdForStudioTab(tabId)
      const app = id ? allApps.find((entry) => entry.appId === id) : undefined
      return app ? [[tabId, app] as const] : []
    })
  )

  useEffect(() => {
    setWebviewLoading(true)
    setCurrentUrl(selectedApp?.url ?? null)
  }, [selectedApp?.appId, selectedApp?.url])

  const enhancePrompt = useCallback(
    async (prompt: string) => {
      if (!promptModel) return ''
      setEnhancingPrompt(true)
      try {
        return await improveStudioPrompt(promptModel.id, prompt)
      } catch (error) {
        toast.errorFromException(error ?? new Error(t('studio.prompt_helper.improve_failed')))
        return ''
      } finally {
        setEnhancingPrompt(false)
      }
    },
    [promptModel, t]
  )

  const selectTab = (nextTab: StudioTabId) => {
    void navigate({
      to: '/app/studio',
      search: miniAppIdForStudioTab(nextTab)
        ? { miniApp: miniAppIdForStudioTab(nextTab) }
        : nextTab === 'video'
          ? { tab: 'video' }
          : {}
    })
  }

  return (
    <main className="flex h-full min-h-0 w-full flex-col bg-background">
      <div
        role="tablist"
        aria-label={t('studio.tabs.label')}
        className="flex h-11 shrink-0 items-center gap-1 border-border border-b px-3">
        {TABS.map((tabId) => (
          <Button
            key={tabId}
            role="tab"
            aria-selected={tab === tabId}
            variant="ghost"
            size="sm"
            className="relative gap-2 transition-colors duration-200"
            onClick={() => selectTab(tabId)}>
            {tab === tabId && (
              <motion.span
                layoutId="studio-tab-indicator"
                className="absolute inset-0 rounded-md bg-secondary"
                transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
              />
            )}
            <span className="relative z-[1] flex items-center gap-2">
              {miniAppByTab.has(tabId) ? (
                <MiniAppIcon app={miniAppByTab.get(tabId)!} appearance="plain" size={16} />
              ) : (
                (() => {
                  const Icon = TAB_ICONS[tabId]
                  return Icon ? <Icon className="size-4" aria-hidden /> : null
                })()
              )}
              {t(TAB_LABEL_KEYS[tabId])}
            </span>
          </Button>
        ))}
      </div>
      <div className="pointer-events-none relative z-[2] flex min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={tab}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -2 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="relative flex min-h-0 min-w-0 flex-1 flex-col pointer-events-none">
            {tab === 'generate' ? (
              <div className="pointer-events-auto flex min-h-0 flex-1 flex-col">
                <PaintingPage
                  studioMode
                  canEnhancePrompt={Boolean(promptModel)}
                  enhancingPrompt={enhancingPrompt}
                  onEnhancePrompt={enhancePrompt}
                />
              </div>
            ) : tab === 'video' ? (
              <div className="pointer-events-auto flex min-h-0 flex-1">
                <StudioVideoTab
                  canEnhancePrompt={Boolean(promptModel)}
                  onEnhancePrompt={enhancePrompt}
                  enhancingPrompt={enhancingPrompt}
                />
              </div>
            ) : selectedApp ? (
              <StudioWebPaneLayer>
                <MiniAppPane
                  app={selectedApp}
                  splitMode="open"
                  onSplit={() => undefined}
                  className="flex-1"
                  onLoadingChange={setWebviewLoading}
                  onCurrentUrlChange={setCurrentUrl}
                />
                {webviewLoading && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-2 bottom-2 top-11 z-5 overflow-hidden rounded-md border border-border bg-card/95">
                    <div className="flex h-full flex-col gap-4 p-5">
                      <div className="h-8 w-1/3 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
                      <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
                      <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
                      <div className="mt-auto h-24 w-full animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
                    </div>
                  </div>
                )}
                {currentUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="pointer-events-auto absolute right-3 top-11 z-6"
                    onClick={() => void openExternalWebsite(currentUrl).catch(() => toast.error(t('common.error')))}>
                    <SquareArrowOutUpRight className="size-4" />
                    {t('studio.web.open_in_browser')}
                  </Button>
                )}
                {!signInHintDismissed && (
                  <div className="pointer-events-auto absolute bottom-3 left-3 z-6 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
                    <span>{t('studio.web.sign_in_hint')}</span>
                    <button
                      type="button"
                      className="rounded-sm px-1 text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
                      aria-label={t('common.close')}
                      onClick={() => setSignInHintDismissed(true)}>
                      ×
                    </button>
                  </div>
                )}
                {!promptHelperOpen && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="pointer-events-auto absolute right-3 top-20 z-6"
                    onClick={() => setPromptHelperOpen(true)}>
                    <PanelRightOpen size={16} />
                    {t('studio.prompt_helper.title')}
                  </Button>
                )}
              </StudioWebPaneLayer>
            ) : (
              <div className="pointer-events-auto flex min-h-0 flex-1">
                <EmptyState
                  title={t('miniApp.error.not_found')}
                  description={t('miniApp.error.load_failed')}
                  className="flex-1"
                />
              </div>
            )}
          </motion.section>
        </AnimatePresence>
        {tab !== 'generate' && tab !== 'video' && promptHelperOpen && (
          <div className="pointer-events-auto flex min-h-0 shrink-0">
            <PromptHelper onClose={() => setPromptHelperOpen(false)} />
          </div>
        )}
      </div>
    </main>
  )
}
