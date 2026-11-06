import { createFileRoute } from '@tanstack/react-router'

import GuidePage from '@renderer/pages/guide/GuidePage'

export const Route = createFileRoute('/guide')({
  component: GuidePage
})
