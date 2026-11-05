import { createHash } from 'node:crypto'

import { eq, isNull } from 'drizzle-orm'

import { agentTable } from '@data/db/schemas/agent'

import type { DbType, ISeeder } from '../../types'

// Match the exact shipped UTF-8 text from 3b7a1c5ca6^; even one-byte user edits must survive.
const LEGACY_INSTRUCTION_HASHES = new Set([
  'f23ecf9c6b7524a6b181ac7f5a1dd8611e0740fd3810ce890478a8d5e5ddc127',
  '96529463aa7f4a9a8043103fbd082d30c6e431208bfe21a1edd989a294f84e69'
])

export class CherryAssistantInstructionsUpgradeSeeder implements ISeeder {
  readonly name = 'cherryAssistantInstructionsUpgrade'
  readonly version = '2'
  readonly description = 'Refresh built-in agent names and legacy stock instructions'
  readonly executionPolicy = 'run-on-change' as const

  run(db: DbType): void {
    db.transaction(
      (tx) => {
        const agents = tx.select().from(agentTable).where(isNull(agentTable.deletedAt)).all()
        for (const agent of agents) {
          const role = agent.configuration.builtin_role
          const legacyNamesByRole: Record<string, Record<string, string>> = {
            assistant: {
              'Cherry Assistant': 'OTT24x7 AI Assistant',
              'Cherry 小助手': 'OTT24x7 AI 助手',
              'Cherry 助手': 'OTT24x7 AI 助手'
            },
            support: {
              'Cherry Support': 'OTT24x7 AI Support',
              'Cherry 支持': 'OTT24x7 AI 支持'
            },
            doctor: {
              'Cherry Doctor': 'OTT24x7 AI Doctor'
            }
          }
          const newName = legacyNamesByRole[String(role)]?.[agent.name]
          const update: { name?: string; instructions?: string } = {}
          if (newName) update.name = newName

          if (role === 'assistant') {
            const hash = createHash('sha256').update(agent.instructions, 'utf8').digest('hex')
            if (LEGACY_INSTRUCTION_HASHES.has(hash)) update.instructions = ''
          }

          if (Object.keys(update).length === 0) continue

          tx.update(agentTable).set(update).where(eq(agentTable.id, agent.id)).run()
        }
      },
      { behavior: 'immediate' }
    )
  }
}
