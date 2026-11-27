import { desc, eq } from 'drizzle-orm'

import { application } from '@application'
import { memoryTable, type MemoryRow } from '@data/db/schemas/memory'
import { defaultHandlersFor, withSqliteErrors } from '@data/db/sqliteErrors'
import { DataApiErrorFactory } from '@shared/data/api/errors'
import type { CreateMemoryDto, UpdateMemoryDto } from '@shared/data/api/schemas/memories'
import type { Memory } from '@shared/data/types/memory'
import { normalizeMemoryContent } from '@shared/utils/memory'

import { timestampToISO } from './utils/rowMappers'

const rowToMemory = (row: MemoryRow): Memory => ({
  id: row.id,
  content: row.content,
  sourceTopicId: row.sourceTopicId,
  sourceMessageId: row.sourceMessageId,
  createdAt: timestampToISO(row.createdAt),
  updatedAt: timestampToISO(row.updatedAt)
})

export class MemoryService {
  private get dbService() {
    return application.get('DbService')
  }

  list(): Memory[] {
    return this.dbService.getDb().select().from(memoryTable).orderBy(desc(memoryTable.updatedAt)).all().map(rowToMemory)
  }

  create(dto: CreateMemoryDto): Memory {
    const row = withSqliteErrors(
      () =>
        this.dbService.withWriteTx((tx) => {
          const key = memoryKey(dto.content)
          const existing = tx
            .select()
            .from(memoryTable)
            .all()
            .find((memory) => memoryKey(memory.content) === key)

          if (existing) {
            return existing
          }

          return tx.insert(memoryTable).values(dto).returning().all()[0]
        }),
      defaultHandlersFor('Memory', 'new')
    )
    return rowToMemory(row)
  }

  update(id: string, dto: UpdateMemoryDto): Memory {
    const [row] = withSqliteErrors(
      () =>
        this.dbService.withWriteTx((tx) =>
          tx.update(memoryTable).set(dto).where(eq(memoryTable.id, id)).returning().all()
        ),
      defaultHandlersFor('Memory', id)
    )
    if (!row) throw DataApiErrorFactory.notFound('Memory', id)
    return rowToMemory(row)
  }

  delete(id: string): void {
    const [row] = this.dbService
      .getDb()
      .delete(memoryTable)
      .where(eq(memoryTable.id, id))
      .returning({ id: memoryTable.id })
      .all()
    if (!row) throw DataApiErrorFactory.notFound('Memory', id)
  }

  forgetAll(): void {
    this.dbService.withWriteTx((tx) => tx.delete(memoryTable).run())
  }
}

const memoryKey = (content: string) => normalizeMemoryContent(content)

export const memoryService = new MemoryService()
