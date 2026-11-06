import { isEqual } from 'es-toolkit/compat'
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { usePreference } from '@data/hooks/usePreference'
import { usePersistCache } from '@renderer/data/hooks/useCache'
import { sidebarShortcutService } from '@renderer/services/SidebarShortcutService'
import {
  createSidebarShortcutTarget,
  getVisibleSidebarShortcutItems,
  isSidebarShortcutPinned,
  normalizeSidebarShortcutItems
} from '@renderer/utils/sidebar'
import type { SidebarShortcutItem, SidebarShortcutTarget } from '@shared/data/preference/preferenceTypes'

import { toast } from '../services/toast'

export function useSidebarShortcuts() {
  const { t } = useTranslation()
  const [stored] = usePreference('ui.sidebar_shortcut')
  const shortcuts = useMemo(() => getVisibleSidebarShortcutItems(stored), [stored])
  const normalized = useMemo(() => normalizeSidebarShortcutItems(stored), [stored])
  const needsNormalization = !isEqual(stored, normalized)

  const runMutation = useCallback(
    (operation: Promise<void>) => {
      void operation.catch(() => toast.error(t('common.error')))
    },
    [t]
  )

  useEffect(() => {
    if (needsNormalization) runMutation(sidebarShortcutService.normalize())
  }, [needsNormalization, runMutation])

  // Saved sidebars predate the Guide; pin it once so existing users can find it, and respect a later unpin.
  const [guideSidebarAdded, setGuideSidebarAdded] = usePersistCache('ui.guide.sidebar_added')
  useEffect(() => {
    if (guideSidebarAdded || stored === undefined) return
    setGuideSidebarAdded(true)
    const guideTarget = createSidebarShortcutTarget('core.app', 'guide')
    if (!isSidebarShortcutPinned(shortcuts, guideTarget))
      runMutation(sidebarShortcutService.setPinned(guideTarget, true))
  }, [guideSidebarAdded, runMutation, setGuideSidebarAdded, shortcuts, stored])

  const isPinned = useCallback(
    (target: SidebarShortcutTarget) => isSidebarShortcutPinned(shortcuts, target),
    [shortcuts]
  )
  const setPinned = useCallback(
    (target: SidebarShortcutTarget, pinned: boolean, fallbackLabel?: string) =>
      runMutation(sidebarShortcutService.setPinned(target, pinned, fallbackLabel)),
    [runMutation]
  )
  const remove = useCallback(
    (target: SidebarShortcutTarget) => runMutation(sidebarShortcutService.remove(target)),
    [runMutation]
  )
  const reorder = useCallback(
    (items: readonly SidebarShortcutItem[]) => {
      const operation = sidebarShortcutService.reorder(items)
      runMutation(operation)
      return operation
    },
    [runMutation]
  )

  return { shortcuts, isPinned, setPinned, remove, reorder }
}
