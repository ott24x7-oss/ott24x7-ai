import { describe, expect, it } from 'vitest'

import { AgentChannelEntitySchema, WhatsAppAgentChannelConfigSchema } from '../agentChannels'

describe('WhatsApp channel schema', () => {
  it('validates a WhatsApp config with an empty allowlist', () => {
    expect(WhatsAppAgentChannelConfigSchema.parse({ allowed_numbers: [] })).toEqual({ allowed_numbers: [] })
  })

  it('accepts a WhatsApp channel entity without API credentials', () => {
    const parsed = AgentChannelEntitySchema.safeParse({
      id: 'channel-1',
      name: 'WhatsApp',
      agentId: null,
      workspace: { type: 'system' },
      isActive: true,
      type: 'whatsapp',
      config: { allowed_numbers: [] },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })

    expect(parsed.success).toBe(true)
  })
})
