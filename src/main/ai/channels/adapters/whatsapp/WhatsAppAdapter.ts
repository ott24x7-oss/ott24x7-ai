import { access, rm } from 'node:fs/promises'
import path from 'node:path'

import makeWASocket, {
  DisconnectReason,
  generateMessageIDV2,
  jidNormalizedUser,
  normalizeMessageContent,
  type SocketConfig,
  type WASocket,
  type WAMessage,
  useMultiFileAuthState
} from '@whiskeysockets/baileys'

import { application } from '@application'
import { WindowType } from '@main/core/window/types'

import { ChannelAdapter, type ChannelAdapterConfig } from '../../ChannelAdapter'
import { isSlashCommand } from '../../constants'
import { splitMessage } from '../../utils'

const WHATSAPP_MAX_LENGTH = 4096
const QR_TIMEOUT_MS = 60_000
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000]
const MAX_QR_ROUNDS = 5

type WhatsAppSocket = Pick<
  WASocket,
  'ev' | 'sendMessage' | 'sendPresenceUpdate' | 'logout' | 'end' | 'user' | 'signalRepository'
>

type WhatsAppAdapterOptions = {
  createSocket?: (config: Parameters<typeof makeWASocket>[0]) => WhatsAppSocket
  loadAuthState?: typeof useMultiFileAuthState
}

const silentLogger: SocketConfig['logger'] = {
  level: 'silent',
  child() {
    return this
  },
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {}
}

function normalizePhone(value: string | undefined): string | undefined {
  if (!value) return undefined
  const digits = value.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 ? digits : undefined
}

function phoneFromJid(jid: string | undefined): string | undefined {
  const normalized = jid ? jidNormalizedUser(jid) : ''
  return normalized.endsWith('@s.whatsapp.net') ? normalizePhone(normalized.split('@')[0]) : undefined
}

export function splitWhatsAppMessage(text: string): string[] {
  return splitMessage(text, WHATSAPP_MAX_LENGTH)
}

export function isUnsupportedWhatsAppChat(jid: string, hasParticipant: boolean): boolean {
  return (
    hasParticipant ||
    jid === 'status@broadcast' ||
    jid.endsWith('@g.us') ||
    jid.endsWith('@newsletter') ||
    jid.endsWith('@broadcast')
  )
}

export class WhatsAppAdapter extends ChannelAdapter {
  private socket: WhatsAppSocket | null = null
  private authState: Awaited<ReturnType<typeof useMultiFileAuthState>>['state'] | null = null
  private readonly allowedNumbers: Set<string>
  private readonly authPath: string
  private readonly createSocket: (config: Parameters<typeof makeWASocket>[0]) => WhatsAppSocket
  private readonly loadAuthState: typeof useMultiFileAuthState
  private saveCreds: (() => Promise<void>) | null = null
  private readonly sentMessageIds = new Set<string>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private qrRoundCount = 0
  private stopped = false
  private loggedOut = false

  constructor(config: ChannelAdapterConfig<'whatsapp'>, options: WhatsAppAdapterOptions = {}) {
    super(config)
    const { allowed_numbers } = config.channelConfig
    this.allowedNumbers = new Set((allowed_numbers ?? []).map(normalizePhone).filter(Boolean) as string[])
    this.authPath = path.join(application.getPath('feature.agents.channels'), `whatsapp_${config.channelId}`)
    this.createSocket = options.createSocket ?? makeWASocket
    this.loadAuthState = options.loadAuthState ?? useMultiFileAuthState
  }

  protected override async checkReady(): Promise<boolean> {
    return await access(path.join(this.authPath, 'creds.json'))
      .then(() => true)
      .catch(() => false)
  }

  protected override async performConnect(signal: AbortSignal): Promise<void> {
    this.stopped = false
    this.loggedOut = false
    this.qrRoundCount = 0
    const { state, saveCreds } = await this.loadAuthState(this.authPath)
    if (signal.aborted) return
    this.authState = state
    this.saveCreds = saveCreds
    this.openSocket(signal, saveCreds)
  }

  protected override async performDisconnect(): Promise<void> {
    this.stopped = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    const socket = this.socket
    this.socket = null
    void socket?.end(undefined)
    this.markDisconnected()
    this.sendQrToRenderer('', 'disconnected')
  }

  async logout(): Promise<void> {
    this.stopped = true
    this.loggedOut = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    const socket = this.socket
    this.socket = null
    try {
      await socket?.logout()
    } catch {
      // The saved state still needs to be removed if WhatsApp already signed out.
    } finally {
      void socket?.end(undefined)
      await rm(this.authPath, { recursive: true, force: true })
      this.authState = null
      this.markDisconnected()
      this.sendQrToRenderer('', 'disconnected')
    }
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    const socket = this.socket
    if (!socket || !this.connected) throw new Error('WhatsApp is not connected')
    if (!this.isAllowedChatId(chatId, socket)) throw new Error('WhatsApp chat is not allowed')

    try {
      for (const chunk of splitWhatsAppMessage(text)) {
        if (!chunk.trim()) continue
        const messageId = generateMessageIDV2(socket.user?.id)
        this.rememberSentMessage(messageId)
        const result = await socket.sendMessage(chatId, { text: chunk }, { messageId })
        if (result?.key.id) this.rememberSentMessage(result.key.id)
      }
    } finally {
      await socket.sendPresenceUpdate('paused', chatId).catch(() => undefined)
    }
  }

  async sendTypingIndicator(chatId: string): Promise<void> {
    if (this.socket && this.connected && this.isAllowedChatId(chatId, this.socket)) {
      await this.socket.sendPresenceUpdate('composing', chatId)
    }
  }

  override canSendToChatId(chatId: string): boolean {
    return this.isAllowedChatId(chatId, this.socket)
  }

  private openSocket(signal: AbortSignal, saveCreds: () => Promise<void>): void {
    const socket = this.createSocket({
      auth: this.authState!,
      logger: silentLogger,
      browser: ['OTT24x7 AI', 'Chrome', '1.0'],
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      emitOwnEvents: false,
      maxMsgRetryCount: 0,
      enableAutoSessionRecreation: false,
      enableRecentMessageCache: false,
      getMessage: async () => undefined,
      connectTimeoutMs: 30_000,
      defaultQueryTimeoutMs: 30_000,
      qrTimeout: QR_TIMEOUT_MS,
      markOnlineOnConnect: false,
      shouldIgnoreJid: (jid) => isUnsupportedWhatsAppChat(jid, false)
    })
    this.socket = socket

    socket.ev.on('creds.update', () => {
      if (!this.stopped && !this.loggedOut) void saveCreds().catch(() => undefined)
    })
    socket.ev.on('messages.upsert', ({ messages, requestId, type }) => {
      if (this.stopped || requestId || type !== 'notify') return
      for (const message of messages) void this.handleMessage(message, socket)
    })
    socket.ev.on('connection.update', (update) => {
      if (this.stopped || this.socket !== socket) return
      if (update.qr) {
        if (!this.authState?.creds.me) {
          this.qrRoundCount += 1
          if (this.qrRoundCount >= MAX_QR_ROUNDS) {
            this.stopped = true
            this.socket = null
            void socket.end(undefined)
            this.markDisconnected('WhatsApp QR expired')
            this.sendQrToRenderer('', 'expired')
            return
          }
        }
        this.emit('qr', update.qr)
        this.sendQrToRenderer(update.qr, 'pending')
      }
      if (update.connection === 'open') {
        this.reconnectAttempt = 0
        this.qrRoundCount = 0
        this.markConnected()
        this.sendQrToRenderer('', 'confirmed')
        return
      }
      if (update.connection === 'close') this.handleClose(signal, socket, update.lastDisconnect?.error)
    })
    signal.addEventListener(
      'abort',
      () => {
        if (this.socket === socket) void socket.end(undefined)
      },
      { once: true }
    )
  }

  private handleClose(signal: AbortSignal, socket: WhatsAppSocket, error: unknown): void {
    if (this.socket !== socket || this.stopped) return
    this.socket = null
    const code = this.disconnectCode(error)
    this.markDisconnected(code === DisconnectReason.loggedOut ? 'WhatsApp logged out' : 'WhatsApp connection closed')
    if (code === DisconnectReason.loggedOut) {
      this.loggedOut = true
      void rm(this.authPath, { recursive: true, force: true }).catch(() => undefined)
      this.sendQrToRenderer('', 'disconnected')
      return
    }
    if (code === DisconnectReason.badSession) {
      this.loggedOut = true
      this.authState = null
      void rm(this.authPath, { recursive: true, force: true }).catch(() => undefined)
      this.sendQrToRenderer('', 'error')
      return
    }
    if (
      signal.aborted ||
      code === DisconnectReason.connectionReplaced ||
      code === DisconnectReason.badSession ||
      code === DisconnectReason.forbidden ||
      code === DisconnectReason.multideviceMismatch
    ) {
      return
    }
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt++, RECONNECT_DELAYS_MS.length - 1)]
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (signal.aborted || this.stopped || !this.authState) return
      this.openSocket(signal, this.saveCreds ?? (async () => undefined))
    }, delay)
    this.reconnectTimer.unref?.()
  }

  private async handleMessage(message: WAMessage, socket: WhatsAppSocket): Promise<void> {
    const jid = message.key.remoteJid ? jidNormalizedUser(message.key.remoteJid) : ''
    if (!jid || !message.key.id || isUnsupportedWhatsAppChat(jid, !!message.key.participant)) return
    if (this.sentMessageIds.has(message.key.id)) return

    const ownerNumber = phoneFromJid(socket.user?.id ?? this.authState?.creds.me?.id)
    const ownLid = jidNormalizedUser(socket.user?.lid ?? this.authState?.creds.me?.lid ?? '')
    const isSelfChat = jid === (ownerNumber ? `${ownerNumber}@s.whatsapp.net` : '') || (!!ownLid && jid === ownLid)
    const senderNumber = await this.phoneForJid(jid, message, socket)
    const allowed = isSelfChat || (!!senderNumber && this.allowedNumbers.has(senderNumber))
    if (!allowed) return
    if (message.key.fromMe && !isSelfChat) return

    const content = normalizeMessageContent(message.message)
    const text = (
      content?.conversation ??
      content?.extendedTextMessage?.text ??
      content?.imageMessage?.caption ??
      content?.videoMessage?.caption ??
      content?.documentMessage?.caption ??
      ''
    ).trim()
    if (!text) return

    const userId = senderNumber ?? ownerNumber ?? jid
    const userName = message.pushName?.trim() || 'WhatsApp'
    if (isSlashCommand(text)) {
      const [command, ...args] = text.slice(1).split(/\s+/)
      if (command === 'new' || command === 'compact' || command === 'help' || command === 'whoami') {
        this.emit('command', {
          chatId: jid,
          conversationId: jid,
          userId,
          userName,
          command,
          args: args.join(' ') || undefined,
          messageId: message.key.id
        })
      }
      return
    }
    this.emit('message', { chatId: jid, conversationId: jid, userId, userName, text, messageId: message.key.id })
  }

  private async phoneForJid(jid: string, message: WAMessage, socket: WhatsAppSocket): Promise<string | undefined> {
    const direct = phoneFromJid(jid) ?? phoneFromJid(message.key.remoteJidAlt)
    if (direct) return direct
    if (!jid.endsWith('@lid')) return undefined
    const mapped = await socket.signalRepository?.lidMapping?.getPNForLID(jid).catch(() => undefined)
    return phoneFromJid(mapped ?? undefined)
  }

  private isAllowedChatId(chatId: string, socket: WhatsAppSocket | null): boolean {
    const jid = jidNormalizedUser(chatId)
    if (!jid || isUnsupportedWhatsAppChat(jid, false)) return false
    const ownerNumber = phoneFromJid(socket?.user?.id ?? this.authState?.creds.me?.id)
    const ownLid = jidNormalizedUser(socket?.user?.lid ?? this.authState?.creds.me?.lid ?? '')
    if (jid === (ownerNumber ? `${ownerNumber}@s.whatsapp.net` : '') || (!!ownLid && jid === ownLid)) return true
    const phone = phoneFromJid(jid)
    return !!phone && this.allowedNumbers.has(phone)
  }

  private rememberSentMessage(id: string): void {
    this.sentMessageIds.add(id)
    while (this.sentMessageIds.size > 2000) this.sentMessageIds.delete(this.sentMessageIds.values().next().value!)
  }

  private disconnectCode(error: unknown): number | undefined {
    const candidate = error as { output?: { statusCode?: number } } | undefined
    return candidate?.output?.statusCode
  }

  private sendQrToRenderer(url: string, status: 'pending' | 'confirmed' | 'expired' | 'disconnected' | 'error'): void {
    application.get('IpcApiService').broadcastToType(WindowType.Main, 'channel.whatsapp.qr_login', {
      channelId: this.channelId,
      url,
      status
    })
  }
}

export function createWhatsAppAdapter(config: ChannelAdapterConfig<'whatsapp'>): WhatsAppAdapter {
  return new WhatsAppAdapter(config)
}
