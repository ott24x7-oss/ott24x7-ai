import { describe, expect, it } from 'vitest'

import { getAutomaticBackupOrder, getCompareBackupOrder, getNextCompareBackup } from '../backupModels'
import type { BackupCandidate } from '../backupModels'

const model = (id: string, providerId: string, name = id) =>
  ({ id: `${providerId}::${id}`, providerId, name, isEnabled: true, capabilities: [], endpointTypes: [] }) as never
const provider = (id: string) => ({ id, isEnabled: true }) as never

describe('backup model ordering', () => {
  it('puts signed-in API models then CLIs then other API models and never web panels', () => {
    const candidates = getAutomaticBackupOrder({
      models: [model('login', 'openai-codex'), model('api', 'openai'), model('other', 'anthropic')],
      providers: [provider('openai-codex'), provider('openai'), provider('anthropic')],
      availableCliIds: ['codex', 'claude']
    })
    expect(candidates.map((candidate) => candidate.id)).toEqual([
      'openai-codex::login',
      'cli::claude',
      'cli::codex',
      'openai::api',
      'anthropic::other'
    ])
    expect(candidates.some((candidate) => candidate.id.startsWith('webapp::'))).toBe(false)
  })

  it('honors explicit order, excludes used models, and caps at three', () => {
    const candidates = getAutomaticBackupOrder({
      models: [model('a', 'openai'), model('b', 'openai'), model('c', 'openai'), model('d', 'openai')],
      providers: [provider('openai')],
      availableCliIds: []
    })
    const selected = getCompareBackupOrder({
      configuredIds: ['openai::c', 'openai::b', 'openai::a', 'openai::d'],
      automaticCandidates: candidates,
      excludedIds: ['openai::b']
    })
    expect(selected.map((candidate) => candidate.id)).toEqual(['openai::c', 'openai::a', 'openai::d'])
  })

  it('does not retry a canceled request and stops after attempted backups', () => {
    const candidates: BackupCandidate[] = [{ id: 'cli::claude', kind: 'cli', cliId: 'claude' }]
    expect(getNextCompareBackup(candidates, ['cli::claude'])).toBeNull()
    expect(getNextCompareBackup(candidates, [], ['cli::claude'])).toBeNull()
  })
})
