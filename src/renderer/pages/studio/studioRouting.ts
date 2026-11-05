export type StudioTabId = 'generate' | 'gemini' | 'flow' | 'chatgpt-images' | 'designer'

export const STUDIO_TAB_MINI_APP_IDS: Partial<Record<StudioTabId, string>> = {
  gemini: 'gemini',
  flow: 'google-flow',
  'chatgpt-images': 'chatgpt-images',
  designer: 'microsoft-designer'
}

const MINI_APP_STUDIO_TABS = new Map(
  Object.entries(STUDIO_TAB_MINI_APP_IDS).flatMap(([tabId, appId]) => (appId ? [[appId, tabId as StudioTabId]] : []))
)

export function studioTabFromMiniAppId(miniAppId: string | undefined): StudioTabId {
  return (miniAppId && MINI_APP_STUDIO_TABS.get(miniAppId)) || 'generate'
}

export function miniAppIdForStudioTab(tabId: StudioTabId): string | undefined {
  return STUDIO_TAB_MINI_APP_IDS[tabId]
}
