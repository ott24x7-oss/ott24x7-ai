import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export default function StudioWebPaneLayer({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  // Mini App webviews are pooled behind this surface; nothing here may re-enable pointer events
  // on MiniAppPane (a `*:pointer-events-auto` here would cover the webview). Overlays opt in themselves.
  return (
    <div
      role="region"
      aria-label={t('studio.web.view_label')}
      className="pointer-events-none relative z-3 flex h-full min-h-0 w-full flex-col">
      {children}
    </div>
  )
}
