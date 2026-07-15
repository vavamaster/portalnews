/**
 * WhatsApp Baileys Client — singleton Baileys socket with persistent auth state.
 *
 * Architecture:
 * - Singleton pattern: only one Baileys socket per Node.js process
 * - Auth state persisted to /tmp/whatsapp-auth-<sessionName>/ (works in dev + container)
 *   In serverless, this would need an external store (S3/Redis) — see DEPLOYMENT.md
 * - QR code generated on connection, stored in DB (WhatsAppConfig.qrCode)
 * - Incoming messages stored in WhatsAppMessage + WhatsAppContact
 * - Connection status broadcast via DB polling (no SSE in serverless)
 *
 * Public API:
 *   - connectWhatsApp(): initializes or re-connects the socket
 *   - disconnectWhatsApp(): gracefully disconnects
 *   - sendTextMessage(to, text): send a text message
 *   - sendImageMessage(to, imageUrl, caption): send an image with caption
 *   - getConnectionStatus(): returns current status
 *   - getQrCode(): returns current QR code data URI
 *   - getContactsWithLastMessage(): list contacts for inbox UI
 *   - getMessages(jid): message thread for a contact
 *
 * Limitations:
 * - Next.js dev mode (Turbopack) hot-reloads the module, which can break the singleton.
 *   Use `globalThis.__waSocket` to survive HMR.
 * - In production serverless (Vercel functions), the socket dies after each invocation.
 *   For production, run Baileys in a separate persistent process (Railway worker,
 *   Docker sidecar, VPS) and call it via HTTP. This module provides the local fallback.
 */

import type { WASocket, WAMessage } from '@whiskeysockets/baileys'
import { rm } from 'node:fs/promises'

// Lazy-load Baileys to avoid breaking SSR (it uses Node fs + crypto)
async function loadBaileys() {
  return await import('@whiskeysockets/baileys')
}

// Use globalThis to survive HMR in dev
type WAState = {
  socket: WASocket | null
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'NEED_QR' | 'ERROR'
  qrCode: string | null
  lastError: string | null
  reconnectAttempts: number
  manualDisconnect: boolean
}

declare global {
  var __waState: WAState | undefined
}

function getState(): WAState {
  if (!globalThis.__waState) {
    globalThis.__waState = {
      socket: null,
      status: 'DISCONNECTED',
      qrCode: null,
      lastError: null,
      reconnectAttempts: 0,
      manualDisconnect: false,
    }
  }
  return globalThis.__waState
}

export function getConnectionStatus() {
  return getState().status
}

export function getQrCode() {
  return getState().qrCode
}

export function getLastError() {
  return getState().lastError
}

function getAuthDir(sessionName: string) {
  return `/tmp/whatsapp-auth-${sessionName}`
}

async function clearAuthState(sessionName: string) {
  await rm(getAuthDir(sessionName), { recursive: true, force: true }).catch(() => {})
}

/**
 * Initialize or re-connect the WhatsApp socket.
 * Returns the new status.
 */
export async function connectWhatsApp(): Promise<{ status: string; qrCode: string | null }> {
  const state = getState()

  // If already connected, return current status
  if (state.socket && state.status === 'CONNECTED') {
    return { status: state.status, qrCode: null }
  }

  // If currently connecting, return current status (don't double-connect)
  if (state.status === 'CONNECTING') {
    return { status: state.status, qrCode: state.qrCode }
  }

  state.status = 'CONNECTING'
  state.qrCode = null
  state.lastError = null
  state.manualDisconnect = false

  try {
    const baileys = await loadBaileys()
    // Note: useMultiFileAuthState is NOT a React hook — it's a Baileys naming convention.
    // Aliased to avoid the react-hooks/rules-of-hooks lint rule.
    const { default: makeWASocket, useMultiFileAuthState: loadAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys

    // Determine session name from DB (lazy-load db to avoid circular dep)
    const { db } = await import('../db')
    let config = await db.whatsAppConfig.findFirst()
    if (!config) {
      config = await db.whatsAppConfig.create({
        data: {
          phoneNumber: '',
          sessionName: 'portal-session',
          isConnected: false,
          connectionStatus: 'CONNECTING',
        },
      })
    }
    const sessionName = config.sessionName || 'portal-session'

    // If WhatsApp logged this session out, the stored Baileys credentials are no
    // longer valid. Clear them before creating the socket so Baileys emits a new QR.
    if (config.connectionStatus === 'ERROR' && config.disconnectReason === 'code 401') {
      await clearAuthState(sessionName)
      await db.whatsAppConfig.update({
        where: { id: config.id },
        data: {
          connectionStatus: 'DISCONNECTED',
          isConnected: false,
          qrCode: null,
          qrCodeExpiresAt: null,
          waUserId: null,
          disconnectReason: null,
        },
      })
      config = { ...config, connectionStatus: 'DISCONNECTED', disconnectReason: null, waUserId: null }
    }

    // Auth state in /tmp (persistent across restarts in containers, ephemeral in serverless)
    const authDir = getAuthDir(sessionName)
    const { state: authState, saveCreds } = await loadAuthState(authDir)

    // Use latest Baileys version
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: authState,
      printQRInTerminal: false,
      browser: ['Portal News', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: true,
      logger: {
        level: 'silent',
        info: () => {},
        debug: () => {},
        warn: () => {},
        error: (m: any) => console.error('[Baileys]', m),
        fatal: (m: any) => console.error('[Baileys fatal]', m),
        child: () => ({ level: 'silent', info: () => {}, debug: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, trace: () => {}, child: function() { return this } }),
        trace: () => {},
      } as any,
    })

    state.socket = sock

    // === Event handlers ===

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        try {
          const QRCode = (await import('qrcode')).default
          const dataUri = await QRCode.toDataURL(qr, { width: 256, margin: 1 })
          state.qrCode = dataUri
          state.status = 'NEED_QR'
          await db.whatsAppConfig.update({
            where: { id: config!.id },
            data: {
              qrCode: dataUri,
              qrCodeExpiresAt: new Date(Date.now() + 60_000),
              connectionStatus: 'NEED_QR',
              isConnected: false,
            },
          })
          await db.whatsAppLog.create({
            data: { type: 'QR', message: 'QR code gerado — escaneie para conectar', data: JSON.stringify({ sessionName }) },
          })
        } catch (e: any) {
          console.error('[WhatsApp] QR generation failed:', e)
        }
      }

      if (connection === 'open') {
        state.status = 'CONNECTED'
        state.qrCode = null
        state.reconnectAttempts = 0
        const phoneNumber = sock.user?.id?.split(':')[0] || ''
        await db.whatsAppConfig.update({
          where: { id: config!.id },
          data: {
            isConnected: true,
            connectionStatus: 'CONNECTED',
            qrCode: null,
            qrCodeExpiresAt: null,
            phoneNumber,
            waUserId: sock.user?.id || null,
            lastConnectedAt: new Date(),
          },
        })
        await db.whatsAppLog.create({
          data: { type: 'CONNECTION', message: `Conectado como ${sock.user?.id}`, phoneNumber, data: JSON.stringify({}) },
        })
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const isManualDisconnect = state.manualDisconnect
        const shouldReconnect = !isManualDisconnect && statusCode !== DisconnectReason.loggedOut
        state.status = shouldReconnect ? 'DISCONNECTED' : 'ERROR'
        state.lastError = `Connection closed (code ${statusCode})`
        state.socket = null

        await db.whatsAppConfig.update({
          where: { id: config!.id },
          data: {
            isConnected: false,
            connectionStatus: isManualDisconnect ? 'DISCONNECTED' : shouldReconnect ? 'DISCONNECTED' : 'ERROR',
            qrCode: null,
            qrCodeExpiresAt: null,
            waUserId: isManualDisconnect || shouldReconnect ? config!.waUserId : null,
            lastDisconnectedAt: new Date(),
            disconnectReason: isManualDisconnect ? 'manual' : `code ${statusCode}`,
          },
        })
        await db.whatsAppLog.create({
          data: {
            type: 'CONNECTION',
            message: isManualDisconnect
              ? 'Desconectado manualmente'
              : `Conexão fechada (code ${statusCode})${shouldReconnect ? ' — vai reconectar' : ' — deslogado, scanear QR novamente'}`,
          },
        })

        if (isManualDisconnect) {
          state.status = 'DISCONNECTED'
          state.manualDisconnect = false
        } else if (!shouldReconnect) {
          await clearAuthState(sessionName)
        } else if (state.reconnectAttempts < 5) {
          state.reconnectAttempts++
          const delay = Math.min(1000 * Math.pow(2, state.reconnectAttempts), 30000)
          setTimeout(() => {
            connectWhatsApp().catch(e => console.error('[WhatsApp] Reconnect failed:', e))
          }, delay)
        } else if (state.reconnectAttempts >= 5) {
          state.status = 'ERROR'
          state.lastError = 'Max reconnect attempts reached'
        }
      }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
      try {
        if (type !== 'notify') return
        for (const msg of messages as WAMessage[]) {
          await handleIncomingMessage(msg)
        }
      } catch (e: any) {
        console.error('[WhatsApp] messages.upsert error:', e)
      }
    })

    // Message status updates (sent, delivered, read) — uses messages.update event
    sock.ev.on('messages.update', async (updates: any[]) => {
      try {
        const { db } = await import('../db')
        for (const u of updates) {
          if (!u.key?.id || !u.update?.status) continue
          const statusMap: Record<string, string> = {
            '0': 'PENDING', '1': 'SENT', '2': 'DELIVERED', '3': 'READ',
            pending: 'PENDING', sent: 'SENT', delivered: 'DELIVERED', read: 'READ',
          }
          await db.whatsAppMessage.updateMany({
            where: { externalId: u.key.id },
            data: { status: statusMap[String(u.update.status)] || 'SENT' },
          })
        }
      } catch (e: any) {
        console.error('[WhatsApp] messages.update error:', e)
      }
    })

    sock.ev.on('contacts.update', async (updates: any[]) => {
      try {
        const { db } = await import('../db')
        for (const u of updates) {
          if (!u.id) continue
          const jid = u.id
          const phoneNumber = jid.split('@')[0]
          const name = u.name || u.notify || undefined
          await db.whatsAppContact.upsert({
            where: { jid },
            create: {
              jid,
              phoneNumber,
              pushName: u.name || u.notify || null,
              name: u.name || null,
            },
            update: {
              ...(name ? { pushName: name, name } : {}),
            },
          }).catch(() => {})
        }
      } catch (e: any) {
        console.error('[WhatsApp] contacts.update error:', e)
      }
    })

    return { status: state.status, qrCode: state.qrCode }
  } catch (e: any) {
    state.status = 'ERROR'
    state.lastError = e.message
    console.error('[WhatsApp] Connect failed:', e)
    try {
      const { db } = await import('../db')
      await db.whatsAppConfig.updateMany({
        where: { sessionName: 'portal-session' },
        data: { connectionStatus: 'ERROR', isConnected: false },
      })
      await db.whatsAppLog.create({
        data: { type: 'ERROR', message: `Falha ao conectar: ${e.message}` },
      })
    } catch {}
    return { status: 'ERROR', qrCode: null }
  }
}

export async function disconnectWhatsApp(): Promise<{ ok: boolean }> {
  const state = getState()
  state.manualDisconnect = true
  if (!state.socket) {
    state.status = 'DISCONNECTED'
    state.qrCode = null
    state.manualDisconnect = false
    try {
      const { db } = await import('../db')
      await db.whatsAppConfig.updateMany({
        data: {
          isConnected: false,
          connectionStatus: 'DISCONNECTED',
          lastDisconnectedAt: new Date(),
          disconnectReason: 'manual',
          qrCode: null,
          qrCodeExpiresAt: null,
        },
      })
    } catch {}
    return { ok: true }
  }
  try {
    await state.socket.end(new Error('Manual disconnect'))
    state.socket = null
    state.status = 'DISCONNECTED'
    state.qrCode = null
    state.manualDisconnect = false
    try {
      const { db } = await import('../db')
      await db.whatsAppConfig.updateMany({
        data: {
          isConnected: false,
          connectionStatus: 'DISCONNECTED',
          lastDisconnectedAt: new Date(),
          disconnectReason: 'manual',
          qrCode: null,
          qrCodeExpiresAt: null,
        },
      })
      await db.whatsAppLog.create({
        data: { type: 'CONNECTION', message: 'Desconectado manualmente' },
      })
    } catch {}
    return { ok: true }
  } catch (e: any) {
    state.lastError = e.message
    return { ok: false }
  }
}

export async function resetWhatsAppSession(): Promise<{ ok: boolean }> {
  const state = getState()
  state.manualDisconnect = true

  try {
    await state.socket?.end(new Error('Manual session reset')).catch(() => {})
    state.socket = null
    state.status = 'DISCONNECTED'
    state.qrCode = null
    state.lastError = null
    state.reconnectAttempts = 0
    state.manualDisconnect = false

    const { db } = await import('../db')
    const config = await db.whatsAppConfig.findFirst()
    const sessionName = config?.sessionName || 'portal-session'
    await clearAuthState(sessionName)

    await db.whatsAppConfig.updateMany({
      data: {
        phoneNumber: '',
        isConnected: false,
        connectionStatus: 'DISCONNECTED',
        qrCode: null,
        qrCodeExpiresAt: null,
        waUserId: null,
        lastDisconnectedAt: new Date(),
        disconnectReason: 'manual_reset',
      },
    })
    await db.whatsAppLog.create({
      data: { type: 'CONNECTION', message: 'Sessão removida manualmente para trocar WhatsApp' },
    })

    return { ok: true }
  } catch (e: any) {
    state.manualDisconnect = false
    state.lastError = e.message
    return { ok: false }
  }
}

export async function sendTextMessage(
  to: string,
  text: string
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  const state = getState()
  if (!state.socket || state.status !== 'CONNECTED') {
    return { success: false, error: 'WhatsApp não está conectado' }
  }
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
    const result = await state.socket.sendMessage(jid, { text })
    const externalId = result?.key?.id || undefined

    const { db } = await import('../db')
    const phoneNumber = to.replace(/\D/g, '')
    await db.whatsAppMessage.create({
      data: {
        jid,
        direction: 'OUTGOING',
        type: 'TEXT',
        body: text,
        isFromMe: true,
        status: 'SENT',
        externalId: externalId || null,
      },
    }).catch(() => {})

    await db.whatsAppLog.create({
      data: { type: 'MESSAGE_SENT', phoneNumber, message: text.substring(0, 200), data: JSON.stringify({ externalId }) },
    }).catch(() => {})

    return { success: true, externalId }
  } catch (e: any) {
    console.error('[WhatsApp] Send error:', e)
    return { success: false, error: e.message }
  }
}

export async function sendImageMessage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  const state = getState()
  if (!state.socket || state.status !== 'CONNECTED') {
    return { success: false, error: 'WhatsApp não está conectado' }
  }
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
    const result = await state.socket.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || undefined,
    })
    const externalId = result?.key?.id || undefined

    const { db } = await import('../db')
    const phoneNumber = to.replace(/\D/g, '')
    await db.whatsAppMessage.create({
      data: {
        jid,
        direction: 'OUTGOING',
        type: 'IMAGE',
        body: caption || null,
        mediaUrl: imageUrl,
        isFromMe: true,
        status: 'SENT',
        externalId: externalId || null,
      },
    }).catch(() => {})

    await db.whatsAppLog.create({
      data: { type: 'MESSAGE_SENT', phoneNumber, message: `[IMAGE] ${caption || ''}`.substring(0, 200), data: JSON.stringify({ externalId, imageUrl }) },
    }).catch(() => {})

    return { success: true, externalId }
  } catch (e: any) {
    console.error('[WhatsApp] Send image error:', e)
    return { success: false, error: e.message }
  }
}

async function handleIncomingMessage(msg: WAMessage) {
  const { db } = await import('../db')
  const jid = msg.key?.remoteJid
  if (!jid) return
  const isFromMe = !!msg.key?.fromMe
  const phoneNumber = jid.split('@')[0]

  let contact: any = null
  try {
    const pushName = (msg as any).pushName || null
    const name = pushName || undefined
    contact = await db.whatsAppContact.upsert({
      where: { jid },
      create: {
        jid,
        phoneNumber,
        pushName,
        name: pushName,
        lastMessageAt: new Date(),
      },
      update: {
        ...(name ? { pushName: name, name } : {}),
        lastMessageAt: new Date(),
      },
    })
  } catch (e: any) {
    console.error('[WhatsApp] Contact upsert failed:', e)
  }

  const messageContent = msg.message
  if (!messageContent) return

  let type = 'TEXT'
  let body: string | null = null
  let mediaUrl: string | null = null
  let mediaMimeType: string | null = null
  let fileName: string | null = null

  if (messageContent.conversation) {
    type = 'TEXT'
    body = messageContent.conversation
  } else if (messageContent.extendedTextMessage?.text) {
    type = 'TEXT'
    body = messageContent.extendedTextMessage.text
  } else if (messageContent.imageMessage) {
    type = 'IMAGE'
    body = messageContent.imageMessage.caption || null
    mediaMimeType = messageContent.imageMessage.mimetype || 'image/jpeg'
  } else if (messageContent.videoMessage) {
    type = 'VIDEO'
    body = messageContent.videoMessage.caption || null
    mediaMimeType = messageContent.videoMessage.mimetype || 'video/mp4'
  } else if (messageContent.audioMessage) {
    type = 'AUDIO'
    mediaMimeType = messageContent.audioMessage.mimetype || 'audio/ogg'
  } else if (messageContent.documentMessage) {
    type = 'DOCUMENT'
    body = messageContent.documentMessage.caption || null
    fileName = messageContent.documentMessage.fileName || null
    mediaMimeType = messageContent.documentMessage.mimetype || 'application/octet-stream'
  } else if (messageContent.stickerMessage) {
    type = 'STICKER'
    mediaMimeType = messageContent.stickerMessage.mimetype || 'image/webp'
  } else {
    type = 'SYSTEM'
    body = `[Mensagem do tipo não suportado]`
  }

  const externalId = msg.key?.id

  try {
    if (externalId) {
      // Check if message already exists (dedupe by externalId)
      const existing = await db.whatsAppMessage.findFirst({ where: { externalId } })
      if (existing) return // already persisted
    }
    await db.whatsAppMessage.create({
      data: {
        jid,
        contactId: contact?.id || null,
        direction: isFromMe ? 'OUTGOING' : 'INCOMING',
        type,
        body,
        mediaUrl,
        mediaMimeType,
        fileName,
        isFromMe,
        status: 'DELIVERED',
        externalId,
      },
    })
  } catch (e: any) {
    console.error('[WhatsApp] Message persist failed:', e)
  }

  if (!isFromMe) {
    const pushNameForLog = (msg as any).pushName || null

    // === Process unsubscribe replies (PARAR, SAIR, STOP, etc.) ===
    if (body && typeof body === 'string') {
      try {
        const { processUnsubscribeReply } = await import('./campaign-processor')
        const wasUnsubscribe = await processUnsubscribeReply(phoneNumber, body)
        if (wasUnsubscribe) return // don't log as regular message
      } catch (e) {
        console.error('[WhatsApp] Unsubscribe processor failed:', e)
      }
    }

    await db.whatsAppLog.create({
      data: {
        type: 'MESSAGE_RECEIVED',
        phoneNumber,
        message: body || `[${type}]`,
        data: JSON.stringify({ externalId, pushName: pushNameForLog }),
      },
    }).catch(() => {})
  }
}

export async function getContactsWithLastMessage(limit = 50) {
  const { db } = await import('../db')
  const contacts = await db.whatsAppContact.findMany({
    orderBy: { lastMessageAt: 'desc' },
    take: limit,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
  return contacts.map(c => ({
    id: c.id,
    jid: c.jid,
    phoneNumber: c.phoneNumber,
    name: c.name,
    pushName: c.pushName,
    profilePicUrl: c.profilePicUrl,
    lastMessageAt: c.lastMessageAt,
    lastMessage: c.messages[0] || null,
  }))
}

export async function getMessages(jid: string, limit = 100) {
  const { db } = await import('../db')
  return db.whatsAppMessage.findMany({
    where: { jid },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
}
