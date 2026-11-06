import type { OpenRouterFreeModel } from '@shared/types/openRouter'

export const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key'
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

export type OpenRouterKeyCheckResult = { ok: true } | { ok: false; reason: 'invalid-key' | 'unavailable' }
export type OpenRouterFreeModelsResult =
  | { ok: true; models: OpenRouterFreeModel[] }
  | { ok: false; reason: 'unavailable' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isZeroPrice(value: unknown): boolean {
  if (typeof value !== 'number' && typeof value !== 'string') return false
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed === 0
}

export function cleanOpenRouterModelName(name: string): string {
  return name.replace(/\s*\(free\)\s*$/i, '').trim()
}

export function parseOpenRouterFreeModels(payload: unknown): OpenRouterFreeModel[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return []

  const models = new Map<string, OpenRouterFreeModel>()
  for (const item of payload.data) {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id.trim() || !isRecord(item.pricing)) continue
    if (!isZeroPrice(item.pricing.prompt) || !isZeroPrice(item.pricing.completion)) continue

    const architecture = isRecord(item.architecture) ? item.architecture : undefined
    const outputModalities = architecture?.output_modalities
    if (outputModalities !== undefined && (!Array.isArray(outputModalities) || !outputModalities.includes('text'))) {
      continue
    }

    const rawName = typeof item.name === 'string' && item.name.trim() ? item.name : item.id
    const contextLength =
      typeof item.context_length === 'number' && Number.isSafeInteger(item.context_length) && item.context_length > 0
        ? item.context_length
        : 0

    if (!models.has(item.id)) {
      models.set(item.id, { id: item.id, name: cleanOpenRouterModelName(rawName) || item.id, contextLength })
    }
  }

  return [...models.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export function getOpenRouterStarterModelIds(models: readonly OpenRouterFreeModel[], count = 4): string[] {
  return [...models]
    .sort((left, right) => right.contextLength - left.contextLength || left.name.localeCompare(right.name))
    .slice(0, count)
    .map((model) => model.id)
}

export async function verifyOpenRouterKey(
  apiKey: string,
  fetcher: typeof fetch = fetch
): Promise<OpenRouterKeyCheckResult> {
  try {
    const response = await fetcher(OPENROUTER_KEY_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000)
    })
    if (response.status === 401) return { ok: false, reason: 'invalid-key' }
    return response.ok ? { ok: true } : { ok: false, reason: 'unavailable' }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

export async function fetchOpenRouterFreeModels(
  fetcher: typeof fetch = fetch
): Promise<OpenRouterFreeModelsResult> {
  try {
    const response = await fetcher(OPENROUTER_MODELS_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(15_000)
    })
    if (!response.ok) return { ok: false, reason: 'unavailable' }
    return { ok: true, models: parseOpenRouterFreeModels(await response.json()) }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}
