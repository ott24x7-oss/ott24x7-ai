import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSocket, applicationMock } = vi.hoisted(() => ({
  mockSocket: {
    ev: {
      handlers: new Map<string, (value: unknown) => void>(),
      on(event: string, handler: (value: unknown) => void) {
        this.handlers.set(event, handler)
      }
    },
    sendMessage: vi.fn().mockResolvedValue({ key: { id: 'sent-id' } }),
    sendPresenceUpdate: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    end: vi.fn(),
    user: { id: '1234567890@s.whatsapp.net' },
    signalRepository: {
      lidMapping: {
        getPNForLID: vi.fn().mockResolvedValue(undefined)
      }
    }
  },
  applicationMock: {
    getPath: vi.fn().mockReturnValue('C:\\mock\\channels'),
    get: vi.fn().mockReturnValue({
      broadcastToType: vi.fn()
    })
  }
}))

vi.mock('@application', () => ({ application: applicationMock }))
vi.mock('@main/core/window/types', () => ({ WindowType: { Main: 'main' } }))
vi.mock('@whiskeysockets/baileys', () => ({
  default: vi.fn(() => mockSocket),
  DisconnectReason: {
    connectionClosed: 428,
    connectionLost: 408,
    connectionReplaced: 440,
    loggedOut: 401,
    badSession: 500,
    multideviceMismatch: 411,
    forbidden: 403
  },
  generateMessageIDV2: vi.fn(() => 'generated-id'),
  jidNormalizedUser: (jid: string | undefined) => {
    if (!jid) return ''
    return jid.replace(/:\d+(?=@)/, '')
  },
  normalizeMessageContent: (message: unknown) => message,
  useMultiFileAuthState: vi.fn().mockResolvedValue({
    state: { creds: { me: { id: '1234567890@s.whatsapp.net' } }, keys: {} },
    saveCreds: vi.fn()
  })
}))

import { createWhatsAppAdapter, splitWhatsAppMessage } from '../whatsapp/WhatsAppAdapter'

function emit(event: string, value: unknown) {
  mockSocket.ev.handlers.get(event)?.(value)
}

function message(overrides: Record<string, unknown> = {}) {
  return {
    key: {
      remoteJid: '1234567890@s.whatsapp.net',
      id: 'inbound-id',
      ...(overrides.key as Record<string, unknown>)
    },
    message: { conversation: 'Hello' },
    pushName: 'Owner',
    ...overrides
  }
}

describe('WhatsAppAdapter', () => {
  beforeEach(() => {
    mockSocket.ev.handlers.clear()
    mockSocket.sendMessage.mockClear().mockResolvedValue({ key: { id: 'sent-id' } })
    mockSocket.sendPresenceUpdate.mockClear().mockResolvedValue(undefined)
    mockSocket.logout.mockClear().mockResolvedValue(undefined)
    mockSocket.end.mockClear()
    mockSocket.signalRepository.lidMapping.getPNForLID.mockClear().mockResolvedValue(undefined)
    applicationMock.getPath.mockClear().mockReturnValue('C:\\mock\\channels')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function createAdapter(allowed_numbers: string[] = []) {
    return createWhatsAppAdapter({
      channelId: 'channel-1',
      channelType: 'whatsapp',
      agentId: 'agent-1',
      channelConfig: { allowed_numbers }
    })
  }

  async function connect(adapter: ReturnType<typeof createAdapter>) {
    await adapter.connect()
    await vi.waitFor(() => expect(mockSocket.ev.handlers.has('connection.update')).toBe(true))
    emit('connection.update', { connection: 'open' })
  }

  it('accepts a message sent to the owner self-chat', async () => {
    const adapter = createAdapter()
    await connect(adapter)
    const received = vi.fn()
    adapter.on('message', received)

    emit('messages.upsert', { type: 'notify', messages: [message()] })
    await vi.waitFor(() => expect(received).toHaveBeenCalledOnce())

    expect(received.mock.calls[0][0]).toMatchObject({ chatId: '1234567890@s.whatsapp.net', text: 'Hello' })
  })

  it.each([
    ['group', { remoteJid: '123-456@g.us', participant: '789@s.whatsapp.net' }],
    ['broadcast', { remoteJid: '123@broadcast' }],
    ['status', { remoteJid: 'status@broadcast' }],
    ['another person', { remoteJid: '9876543210@s.whatsapp.net' }]
  ])('rejects %s messages by default', async (_label, key) => {
    const adapter = createAdapter()
    await connect(adapter)
    const received = vi.fn()
    adapter.on('message', received)

    emit('messages.upsert', { type: 'notify', messages: [message({ key })] })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(received).not.toHaveBeenCalled()
  })

  it('accepts a message from an explicitly allowed number', async () => {
    const adapter = createAdapter(['+98 765 432 10'])
    await connect(adapter)
    const received = vi.fn()
    adapter.on('message', received)

    emit('messages.upsert', {
      type: 'notify',
      messages: [message({ key: { remoteJid: '9876543210@s.whatsapp.net', id: 'allowed-id' } })]
    })
    await vi.waitFor(() => expect(received).toHaveBeenCalledOnce())
  })

  it('ignores its own sent-message echo', async () => {
    const adapter = createAdapter()
    await connect(adapter)
    const received = vi.fn()
    adapter.on('message', received)
    await adapter.sendMessage('1234567890@s.whatsapp.net', 'reply')

    emit('messages.upsert', {
      type: 'notify',
      messages: [message({ key: { fromMe: true, id: 'sent-id' } })]
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(received).not.toHaveBeenCalled()
  })

  it('splits outgoing messages within the WhatsApp budget', () => {
    const chunks = splitWhatsAppMessage('A'.repeat(4097))

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 4096)).toBe(true)
  })

  it('shows typing through Baileys presence updates', async () => {
    const adapter = createAdapter()
    await connect(adapter)
    await adapter.sendTypingIndicator('1234567890@s.whatsapp.net')

    expect(mockSocket.sendPresenceUpdate).toHaveBeenCalledWith('composing', '1234567890@s.whatsapp.net')
  })

  it('refuses outbound messages to chats outside the allowlist', async () => {
    const adapter = createAdapter()
    await connect(adapter)

    await expect(adapter.sendMessage('9876543210@s.whatsapp.net', 'blocked')).rejects.toThrow('not allowed')
    expect(mockSocket.sendMessage).not.toHaveBeenCalled()
  })

  it('ignores history replays and only processes notify upserts', async () => {
    const adapter = createAdapter()
    await connect(adapter)
    const received = vi.fn()
    adapter.on('message', received)

    emit('messages.upsert', { type: 'append', messages: [message({ key: { id: 'history-id' } })] })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(received).not.toHaveBeenCalled()
  })
})
