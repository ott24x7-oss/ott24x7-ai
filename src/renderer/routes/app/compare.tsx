import { createFileRoute } from '@tanstack/react-router'

import ComparePage from '@renderer/pages/fiesta/ComparePage'
import { parseChatRouteSearch } from '@renderer/pages/home/routeSearch'

export const Route = createFileRoute('/app/compare')({
  validateSearch: (search) => parseChatRouteSearch(search),
  component: ComparePage
})
