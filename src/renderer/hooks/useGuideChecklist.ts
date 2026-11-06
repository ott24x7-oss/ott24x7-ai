import { useCallback } from 'react'

import { usePersistCache } from '@data/hooks/useCache'
import {
  completeGuideChecklistItem,
  GUIDE_CHECKLIST_LENGTH,
  getGuideChecklistProgress,
  isGuideChecklistComplete,
  resetGuideChecklist,
  shouldShowGuideBanner
} from '@renderer/utils/guide'

export function useGuideChecklist() {
  const [done, setDone] = usePersistCache('ui.guide.checklist')
  const [bannerDismissed, setBannerDismissed] = usePersistCache('ui.guide.banner_dismissed')
  const progress = getGuideChecklistProgress(done)
  const complete = isGuideChecklistComplete(done)
  const showBanner = shouldShowGuideBanner(bannerDismissed, done)

  const markDone = useCallback(
    (index: number) => setDone((current) => completeGuideChecklistItem(current, index)),
    [setDone]
  )
  const markAllDone = useCallback(() => setDone(Array.from({ length: GUIDE_CHECKLIST_LENGTH }, () => true)), [setDone])
  const reset = useCallback(() => setDone(resetGuideChecklist()), [setDone])
  const dismissBanner = useCallback(() => setBannerDismissed(true), [setBannerDismissed])

  return { done, setDone, progress, complete, showBanner, markDone, markAllDone, reset, dismissBanner }
}
