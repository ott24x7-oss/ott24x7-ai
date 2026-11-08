export type LocalLlmCategory = 'coding' | 'general' | 'reasoning'
export type LocalLlmSpeed = 'fast' | 'balanced' | 'slow' | 'varies'

export interface LocalLlmCatalogModel {
  id: string
  category: LocalLlmCategory
  parametersBillions: number
  downloadSize: string
  minimumRamGb: number
  speed: Exclude<LocalLlmSpeed, 'varies'>
  recommendedDefault?: boolean
  sourceUrl: string
}

export interface InstalledOllamaModel {
  name: string
  size?: number
}

export interface LocalLlmModelEntry extends LocalLlmCatalogModel {
  installed: boolean
}

export interface UnlistedOllamaModel extends InstalledOllamaModel {
  category: 'other'
  speed: 'varies'
}

const model = (
  id: string,
  category: LocalLlmCategory,
  parametersBillions: number,
  downloadSize: string,
  speed: LocalLlmCatalogModel['speed'],
  sourceUrl: string,
  recommendedDefault = false
): LocalLlmCatalogModel => ({
  id,
  category,
  parametersBillions,
  downloadSize,
  minimumRamGb: parametersBillions <= 4 ? 8 : 16,
  speed,
  sourceUrl,
  ...(recommendedDefault && { recommendedDefault })
})

/** Sizes reflect the default Ollama tags listed on ollama.com. */
export const LOCAL_LLM_CATALOG = [
  model('qwen2.5-coder:0.5b', 'coding', 0.5, '398 MB', 'fast', 'https://ollama.com/library/qwen2.5-coder'),
  model('qwen2.5-coder:1.5b', 'coding', 1.5, '986 MB', 'fast', 'https://ollama.com/library/qwen2.5-coder'),
  model('qwen2.5-coder:3b', 'coding', 3, '1.9 GB', 'balanced', 'https://ollama.com/library/qwen2.5-coder', true),
  model('qwen2.5-coder:7b', 'coding', 7, '4.7 GB', 'slow', 'https://ollama.com/library/qwen2.5-coder'),
  model('deepseek-coder:1.3b', 'coding', 1.3, '776 MB', 'fast', 'https://ollama.com/library/deepseek-coder'),
  model('deepseek-coder:6.7b', 'coding', 6.7, '3.8 GB', 'slow', 'https://ollama.com/library/deepseek-coder'),
  model('codellama:7b', 'coding', 7, '3.8 GB', 'slow', 'https://ollama.com/library/codellama'),
  model('qwen3.5:2b', 'general', 2, '2.7–3.1 GB', 'balanced', 'https://ollama.com/library/qwen3.5'),
  model('qwen3.5:4b', 'general', 4, '3.3–4.0 GB', 'balanced', 'https://ollama.com/library/qwen3.5'),
  model('qwen3:4b', 'general', 4, '2.5 GB', 'balanced', 'https://ollama.com/library/qwen3'),
  model('llama3.2:1b', 'general', 1, '1.3 GB', 'fast', 'https://ollama.com/library/llama3.2'),
  model('llama3.2:3b', 'general', 3, '2.0 GB', 'balanced', 'https://ollama.com/library/llama3.2'),
  model('gemma3:1b', 'general', 1, '806 MB', 'fast', 'https://ollama.com/library/gemma3'),
  model('gemma3:4b', 'general', 4, '3.4 GB', 'balanced', 'https://ollama.com/library/gemma3'),
  model('gemma4:e4b', 'general', 4, '6.6–9.5 GB', 'slow', 'https://ollama.com/library/gemma4'),
  model('phi3:3.8b', 'general', 3.8, '2.2 GB', 'balanced', 'https://ollama.com/library/phi3'),
  model('smollm2:1.7b', 'general', 1.7, '1.8 GB', 'fast', 'https://ollama.com/library/smollm2'),
  model('deepseek-r1:1.5b', 'reasoning', 1.5, '1.1 GB', 'balanced', 'https://ollama.com/library/deepseek-r1'),
  model('deepseek-r1:7b', 'reasoning', 7, '4.7 GB', 'slow', 'https://ollama.com/library/deepseek-r1')
] as const satisfies readonly LocalLlmCatalogModel[]

export type LocalLlmCatalogId = (typeof LOCAL_LLM_CATALOG)[number]['id']

export type LocalLlmRecommendation = 'recommended' | 'slower' | null

export function recommendLocalLlmModel(
  parametersBillions: number,
  ramGb: number,
  vramGb: number | null
): LocalLlmRecommendation {
  if (parametersBillions <= 4) return ramGb >= 8 ? 'recommended' : null
  if (ramGb >= 16 || (vramGb !== null && vramGb >= 6)) return 'recommended'
  if (vramGb !== null && vramGb >= 4) return 'slower'
  return null
}

export function mergeOllamaTags(installed: readonly InstalledOllamaModel[]): {
  catalog: LocalLlmModelEntry[]
  other: UnlistedOllamaModel[]
} {
  const tags = new Map(installed.map((item) => [item.name, item]))
  const catalog = LOCAL_LLM_CATALOG.map((entry) => ({
    ...entry,
    installed: tags.delete(entry.id)
  }))

  return {
    catalog,
    other: [...tags.values()].map((item) => ({ ...item, category: 'other', speed: 'varies' }))
  }
}
