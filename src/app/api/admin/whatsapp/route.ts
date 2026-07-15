import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond, handleApiError } from '@/lib/api-helpers'
import {
  connectWhatsApp,
  disconnectWhatsApp,
  resetWhatsAppSession,
  getConnectionStatus,
  getQrCode,
  sendTextMessage,
  sendImageMessage,
  getContactsWithLastMessage,
  getMessages,
} from '@/lib/whatsapp/baileys-client'

// GET /api/admin/whatsapp — get config, status, and recent logs
// Optional query params:
//   ?include=contacts  — also return contacts list with last message preview
//   ?jid=X             — return message thread for this JID (requires ?include=messages)
//   ?include=messages  — return messages for the given jid
export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdminOrRespond(req)
    if (response) return response

    let config = await db.whatsAppConfig.findFirst()
    if (!config) {
      config = await db.whatsAppConfig.create({
        data: {
          phoneNumber: '',
          sessionName: 'portal-session',
          isConnected: false,
          connectionStatus: 'DISCONNECTED',
          notifyOnPublish: true,
          notifyOnReview: true,
          notifyOnLead: true,
        },
      })
    }

    const url = new URL(req.url)
    const include = url.searchParams.get('include')?.split(',') || []
    const jid = url.searchParams.get('jid')

    const recentLogs = await db.whatsAppLog.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
    })

    const result: any = {
      config: {
        ...config,
        // Override with live in-memory state if available (more accurate than DB)
        liveStatus: getConnectionStatus(),
        liveQrCode: getQrCode(),
      },
      recentLogs,
    }

    if (include.includes('contacts')) {
      result.contacts = await getContactsWithLastMessage(50)
    }

    if (include.includes('messages') && jid) {
      result.messages = await getMessages(jid, 200)
    }

    if (include.includes('stats')) {
      const [totalMessages, totalContacts, totalIncoming, totalOutgoing, errorsLast24h] = await Promise.all([
        db.whatsAppMessage.count(),
        db.whatsAppContact.count(),
        db.whatsAppMessage.count({ where: { direction: 'INCOMING' } }),
        db.whatsAppMessage.count({ where: { direction: 'OUTGOING' } }),
        db.whatsAppLog.count({ where: { type: 'ERROR', createdAt: { gte: new Date(Date.now() - 86400000) } } }),
      ])
      result.stats = { totalMessages, totalContacts, totalIncoming, totalOutgoing, errorsLast24h }
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return handleApiError(e, 'whatsapp GET')
  }
}

// POST /api/admin/whatsapp — update config OR perform action
// Body for config update:
//   { action: 'update', phoneNumber, notifyOnPublish, notifyOnReview, notifyOnLead, notifyPhone }
// Body for connect:
//   { action: 'connect' }
// Body for disconnect:
//   { action: 'disconnect' }
// Body for reset/switch chip:
//   { action: 'reset' }
// Body for send test:
//   { action: 'send', to, message, imageUrl? }
export async function POST(req: NextRequest) {
  try {
    const { user, response } = await requireAdminOrRespond(req)
    if (response) return response

    const body = await req.json().catch(() => ({}))
    const action = body.action || 'update'

    // === UPDATE CONFIG ===
    if (action === 'update') {
      let config = await db.whatsAppConfig.findFirst()
      const data = {
        phoneNumber: typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '',
        notifyOnPublish: body.notifyOnPublish ?? true,
        notifyOnReview: body.notifyOnReview ?? true,
        notifyOnLead: body.notifyOnLead ?? true,
        notifyPhone: typeof body.notifyPhone === 'string' && body.notifyPhone.trim() ? body.notifyPhone.trim() : null,
      }

      if (!config) {
        config = await db.whatsAppConfig.create({ data: { ...data, sessionName: 'portal-session' } })
      } else {
        config = await db.whatsAppConfig.update({ where: { id: config.id }, data })
      }

      return NextResponse.json({ ok: true, config })
    }

    // === CONNECT ===
    if (action === 'connect') {
      const result = await connectWhatsApp()
      return NextResponse.json({ ok: true, ...result })
    }

    // === DISCONNECT ===
    if (action === 'disconnect') {
      const result = await disconnectWhatsApp()
      return NextResponse.json({ ok: result.ok })
    }

    // === RESET SESSION / SWITCH WHATSAPP ===
    if (action === 'reset') {
      const result = await resetWhatsAppSession()
      return NextResponse.json({ ok: result.ok })
    }

    // === SEND TEST MESSAGE ===
    if (action === 'send') {
      const { to, message, imageUrl } = body
      if (!to || typeof to !== 'string') {
        return NextResponse.json({ error: 'Destinatário (to) é obrigatório' }, { status: 400 })
      }
      if (!message && !imageUrl) {
        return NextResponse.json({ error: 'Mensagem ou imagem é obrigatória' }, { status: 400 })
      }
      // Normalize phone number (strip non-digits, keep @ if JID)
      const normalizedTo = to.includes('@') ? to : to.replace(/\D/g, '')

      if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
        const result = await sendImageMessage(normalizedTo, imageUrl, message || undefined)
        return NextResponse.json(result, { status: result.success ? 200 : 400 })
      }
      if (typeof message !== 'string' || message.trim().length === 0) {
        return NextResponse.json({ error: 'Mensagem não pode estar vazia' }, { status: 400 })
      }
      const result = await sendTextMessage(normalizedTo, message)
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 })
  } catch (e: any) {
    return handleApiError(e, 'whatsapp POST')
  }
}
