import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createUpdateTimestamps, uuidPrimaryKey } from './_columnHelpers'

export const memoryTable = sqliteTable(
  'memory',
  {
    id: uuidPrimaryKey(),
    content: text().notNull(),
    sourceTopicId: text('source_topic_id'),
    sourceMessageId: text('source_message_id'),
    ...createUpdateTimestamps
  },
  (table) => [index('memory_updated_at_idx').on(table.updatedAt)]
)

export type MemoryRow = typeof memoryTable.$inferSelect
export type InsertMemoryRow = typeof memoryTable.$inferInsert
