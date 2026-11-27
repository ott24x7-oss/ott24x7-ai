import type { Memory } from '@shared/data/types/memory'

export const MEMORY_PREAMBLE_LIMIT = 2000
export const MEMORY_NOTE_LIMIT = 50
export const MEMORY_CONTENT_LIMIT = 500

export function parseMemoryFacts(raw: string): string[] {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return []
  }
  const facts = Array.isArray(value) ? value : value && typeof value === 'object' && 'facts' in value ? value.facts : []
  if (!Array.isArray(facts)) return []
  return [
    ...new Set(
      facts
        .filter((fact): fact is string => typeof fact === 'string')
        .map((fact) => fact.trim())
        .filter(Boolean)
    )
  ].slice(0, 3)
}

export function buildMemoryPreamble(notes: readonly Memory[], maxChars = MEMORY_PREAMBLE_LIMIT): string {
  const prefix = 'Remembered user preferences and facts:'
  if (notes.length === 0) return ''
  if (maxChars <= prefix.length) return prefix.slice(0, maxChars)
  const lines: string[] = []
  const newest = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MEMORY_NOTE_LIMIT)
  for (const note of newest) {
    const line = `- ${note.content}`
    if (`${prefix}\n${[...lines, line].join('\n')}`.length > maxChars) continue
    lines.push(line)
  }
  return lines.length ? `${prefix}\n${lines.join('\n')}` : prefix
}

export function mergeMemoryFacts(existing: readonly Memory[], incoming: readonly string[]): string[] {
  const result = [...existing].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((note) => note.content)
  for (const fact of incoming) {
    const key = normalizeMemoryContent(fact)
    if (!result.some((current) => normalizeMemoryContent(current) === key)) result.push(fact)
  }
  return result
}

export function normalizeMemoryContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLowerCase()
}
