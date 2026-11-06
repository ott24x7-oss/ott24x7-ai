import { createFileRoute } from '@tanstack/react-router'

import StudioPage from '@renderer/pages/studio/StudioPage'

export const Route = createFileRoute('/app/studio')({
  validateSearch: (search: Record<string, unknown>): { miniApp?: string; tab?: 'video' } => ({
    ...(typeof search.miniApp === 'string' ? { miniApp: search.miniApp } : {}),
    ...(search.tab === 'video' ? { tab: 'video' as const } : {})
  }),
  component: StudioPage
})
