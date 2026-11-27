import { describe, expect, it } from 'vitest'

import { buildMemoryPreamble, mergeMemoryFacts, parseMemoryFacts } from '../memory'

describe('memory helpers', () => {
  it('parses strict JSON facts and ignores garbage', () => {
    expect(parseMemoryFacts('```json\n{"facts":["likes tea","works remotely"]}\n```')).toEqual([
      'likes tea',
      'works remotely'
    ])
    expect(parseMemoryFacts('not json')).toEqual([])
    expect(parseMemoryFacts('{"facts":[]}')).toEqual([])
  })

  it('limits memory preambles to newest notes and the character budget', () => {
    const notes = Array.from({ length: 55 }, (_, index) => ({
      id: String(index),
      content: `fact ${index}`,
      sourceTopicId: null,
      sourceMessageId: null,
      createdAt: new Date(2026, 0, index + 1).toISOString(),
      updatedAt: new Date(2026, 0, index + 1).toISOString()
    }))
    const preamble = buildMemoryPreamble(notes, 40)
    expect(preamble).not.toContain('fact 50')
    expect(preamble.length).toBeLessThanOrEqual(40)
  })

  it('skips an oversized newest note and keeps later notes in the budget', () => {
    const notes = [
      {
        id: 'long',
        content: 'x'.repeat(100),
        sourceTopicId: null,
        sourceMessageId: null,
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      },
      {
        id: 'short',
        content: 'keep this fact',
        sourceTopicId: null,
        sourceMessageId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]
    expect(buildMemoryPreamble(notes, 60)).toContain('keep this fact')
  })

  it('returns no preamble for an empty note list and deduplicates full content only', () => {
    expect(buildMemoryPreamble([])).toBe('')
    const notes = [
      {
        id: '1',
        content: 'prefers concise answers',
        sourceTopicId: null,
        sourceMessageId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]
    expect(mergeMemoryFacts(notes, ['prefers concise answers', 'prefers detailed answers'])).toEqual([
      'prefers concise answers',
      'prefers detailed answers'
    ])
  })
})
