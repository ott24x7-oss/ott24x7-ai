import { useNavigate, useSearch } from '@tanstack/react-router'
import { PanelRightOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, EmptyState } from '@cherrystudio/ui'
import { useMiniApps } from '@renderer/hooks/useMiniApps'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio embeds the saved-session Mini App pane.
import MiniAppPane from '@renderer/pages/miniApps/components/MiniAppPane'
// eslint-disable-next-line import-x/no-restricted-paths -- Generate reuses the existing Paintings experience.
import PaintingPage from '@renderer/pages/paintings/PaintingPage'

import PromptHelper from './PromptHelper'
import { miniAppIdForStudioTab, studioTabFromMiniAppId, type StudioTabId } from './studioRouting'

const TAB_LABEL_KEYS: Record<StudioTabId, string> = {
  generate: 'studio.tabs.generate',
  gemini: 'studio.tabs.gemini',
  flow: 'studio.tabs.flow',
  'chatgpt-images': 'studio.tabs.chatgpt_images',
  designer: 'studio.tabs.designer'
}

const TABS = Object.keys(TAB_LABEL_KEYS) as StudioTabId[]

export default function StudioPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { miniApp } = useSearch({ from: '/app/studio' })
  const { allApps } = useMiniApps()
  const [promptHelperOpen, setPromptHelperOpen] = useState(true)
  const tab = studioTabFromMiniAppId(miniApp)
  const miniAppId = miniAppIdForStudioTab(tab)
  const selectedApp = miniAppId ? allApps.find((app) => app.appId === miniAppId) : undefined

  const selectTab = (nextTab: StudioTabId) => {
    void navigate({
      to: '/app/studio',
      search: miniAppIdForStudioTab(nextTab) ? { miniApp: miniAppIdForStudioTab(nextTab) } : {}
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
            variant={tab === tabId ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => selectTab(tabId)}>
            {t(TAB_LABEL_KEYS[tabId])}
          </Button>
        ))}
      </div>
      <div className="relative z-[2] flex min-h-0 flex-1">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {tab === 'generate' ? (
            <PaintingPage />
          ) : selectedApp ? (
            <>
              <MiniAppPane app={selectedApp} splitMode="open" onSplit={() => undefined} className="flex-1" />
              {!promptHelperOpen && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute right-3 top-3 z-4"
                  onClick={() => setPromptHelperOpen(true)}>
                  <PanelRightOpen size={16} />
                  {t('studio.prompt_helper.title')}
                </Button>
              )}
            </>
          ) : (
            <EmptyState
              title={t('miniApp.error.not_found')}
              description={t('miniApp.error.load_failed')}
              className="flex-1"
            />
          )}
        </div>
        {tab !== 'generate' && promptHelperOpen && <PromptHelper onClose={() => setPromptHelperOpen(false)} />}
      </div>
    </main>
  )
}
