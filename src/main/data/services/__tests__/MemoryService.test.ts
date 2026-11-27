import { setupTestDatabase } from '@test-helpers/db'
import { describe, expect, it } from 'vitest'

import { memoryService } from '@data/services/MemoryService'

describe('MemoryService', () => {
  setupTestDatabase()

  it('creates, updates, deletes, and forgets memories', () => {
    const created = memoryService.create({
      content: 'The user prefers concise answers.',
      sourceTopicId: 'topic-1',
      sourceMessageId: 'message-1'
    })
    expect(memoryService.list()).toHaveLength(1)
    expect(created).toMatchObject({ content: 'The user prefers concise answers.', sourceTopicId: 'topic-1' })

    const updated = memoryService.update(created.id, { content: 'The user prefers concise, direct answers.' })
    expect(updated.content).toContain('direct')

    const duplicate = memoryService.create({
      content: '  The user prefers concise, direct answers.  ',
      sourceTopicId: 'topic-2',
      sourceMessageId: 'message-2'
    })
    expect(duplicate.id).toBe(created.id)
    expect(memoryService.list()).toHaveLength(1)

    const differentFact = memoryService.create({
      content: 'The user prefers detailed answers.',
      sourceTopicId: 'topic-3',
      sourceMessageId: 'message-3'
    })
    expect(differentFact.id).not.toBe(created.id)
    expect(memoryService.list()).toHaveLength(2)

    memoryService.delete(created.id)
    memoryService.delete(differentFact.id)
    expect(memoryService.list()).toHaveLength(0)

    memoryService.create({ content: 'A second fact.', sourceTopicId: null, sourceMessageId: null })
    memoryService.forgetAll()
    expect(memoryService.list()).toHaveLength(0)
  })
})
