import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cacheService } from '@data/CacheService'
import { useGuideChecklist } from '@renderer/hooks/useGuideChecklist'
import {
  GUIDE_AUTO_CHECKLIST_ITEMS,
  GUIDE_CHECKLIST_LENGTH,
  markGuideChecklistOnCompareSend
} from '@renderer/utils/guide'

vi.unmock('@data/CacheService')
vi.unmock('@data/hooks/useCache')

describe('useGuideChecklist', () => {
  beforeEach(() => {
    cacheService.deletePersist('ui.guide.checklist')
    cacheService.deletePersist('ui.guide.banner_dismissed')
  })

  it('persists checklist progress across remounts and Reset clears it', () => {
    const first = renderHook(() => useGuideChecklist())
    expect(first.result.current.progress).toBe(0)

    act(() => first.result.current.markDone(GUIDE_AUTO_CHECKLIST_ITEMS.firstCompareSend))
    expect(first.result.current.progress).toBe(1)
    expect(first.result.current.done[GUIDE_AUTO_CHECKLIST_ITEMS.firstCompareSend]).toBe(true)

    first.unmount()
    const reopened = renderHook(() => useGuideChecklist())
    expect(reopened.result.current.progress).toBe(1)

    act(() => reopened.result.current.reset())
    expect(reopened.result.current.done).toEqual(Array.from({ length: GUIDE_CHECKLIST_LENGTH }, () => false))
  })

  it('hides the new-user banner after its dismissal is persisted', () => {
    const first = renderHook(() => useGuideChecklist())
    expect(first.result.current.showBanner).toBe(true)

    act(() => first.result.current.dismissBanner())
    expect(first.result.current.showBanner).toBe(false)

    first.unmount()
    const reopened = renderHook(() => useGuideChecklist())
    expect(reopened.result.current.showBanner).toBe(false)
  })

  it('auto-checks the first Compare prompt only when there is a valid send target', () => {
    const markDone = vi.fn()

    markGuideChecklistOnCompareSend([], markDone)
    expect(markDone).not.toHaveBeenCalled()

    markGuideChecklistOnCompareSend(['model-a'], markDone)
    expect(markDone).toHaveBeenCalledWith(GUIDE_AUTO_CHECKLIST_ITEMS.firstCompareSend)
  })
})
