export type CompareCliId = 'claude' | 'agy' | 'codex'

export interface CompareCliAvailability {
  id: CompareCliId
  available: boolean
}
