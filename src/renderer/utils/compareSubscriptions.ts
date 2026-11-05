import type { CompareColumnId } from '@renderer/types/compare'

const FIRST_RUN_WEB_APP_ID_GROUPS = [['anthropic', 'claude'], ['openai', 'chatgpt'], ['gemini'], ['deepseek']] as const

export function getMySubscriptionColumnIds(webAppIds: readonly string[]): CompareColumnId[] {
  const appsById = new Map(webAppIds.map((id) => [id.toLowerCase(), id]))
  return FIRST_RUN_WEB_APP_ID_GROUPS.flatMap((group): CompareColumnId[] => {
    const appId = group.map((id) => appsById.get(id)).find(Boolean)
    return appId ? [`webapp::${encodeURIComponent(appId)}`] : []
  })
}
