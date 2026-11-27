import { describe, expect, it, vi } from 'vitest'

import type { AgentChannelEntity } from '@shared/data/api/schemas/agentChannels'

const createWhatsAppAdapter = vi.fn((config: any) => ({ channelType: config.channelType }))

vi.mock('../adapters/whatsapp/WhatsAppAdapter', () => ({ createWhatsAppAdapter }))

import { loadChannelAdapter } from '../channelAdapterLoader'

describe('channel adapter loader', () => {
  it('loads the WhatsApp adapter', async () => {
    const channel = {
      id: 'channel-1',
      name: 'WhatsApp',
      agentId: 'agent-1',
      workspace: { type: 'system' },
      isActive: true,
      type: 'whatsapp',
      config: { allowed_numbers: [] },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    } as AgentChannelEntity

    const adapter = await loadChannelAdapter(channel, 'agent-1')

    expect(createWhatsAppAdapter).toHaveBeenCalledWith({
      channelId: 'channel-1',
      channelType: 'whatsapp',
      agentId: 'agent-1',
      channelConfig: { allowed_numbers: [] }
    })
    expect(adapter.channelType).toBe('whatsapp')
  })
})
