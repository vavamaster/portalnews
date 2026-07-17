import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { consumeRequestLimit } from '@/lib/request-rate-limit'

// POST /api/classifieds/[id]/contact - send a lead message
// Rate limit: non-auth users limited to 3 leads/hour per IP; auth users limited to 20/hour per user

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser(req)
    const body = await req.json()
    const { senderName, senderEmail, senderPhone, subject, message, channel } = body

    // === Basic validation ===
    if (!senderName || typeof senderName !== 'string' || senderName.trim().length < 2) {
      return NextResponse.json({ error: 'Nome é obrigatório (mínimo 2 caracteres)' }, { status: 400 })
    }
    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return NextResponse.json({ error: 'Mensagem é obrigatória (mínimo 5 caracteres)' }, { status: 400 })
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: 'Mensagem muito longa (máximo 5000 caracteres)' }, { status: 400 })
    }
    if (senderName.length > 200) {
      return NextResponse.json({ error: 'Nome muito longo' }, { status: 400 })
    }

    // Validate email format if provided
    if (senderEmail && typeof senderEmail === 'string' && senderEmail.trim()) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRe.test(senderEmail)) {
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
      }
    }

    // Validate channel
    const validChannels = ['PANEL', 'WHATSAPP', 'PHONE', 'EMAIL']
    const finalChannel = validChannels.includes(channel) ? channel : 'PANEL'

    // === Rate limiting ===
    // Non-auth: persistent by IP, 3/hour. Auth: persistent by user id, 20/hour.
    const rate = await consumeRequestLimit(req, user ? {
      scope: 'classified-contact-user', subject: user.id, includeIp: false, limit: 20, windowSeconds: 60 * 60,
    } : {
      scope: 'classified-contact-guest', subject: 'lead', limit: 3, windowSeconds: 60 * 60,
    })
    if (!rate.allowed) {
      return NextResponse.json({
        error: 'Limite de mensagens atingido. Tente novamente mais tarde.',
      }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } })
    }

    const listing = await db.classifiedListing.findUnique({
      where: { id },
      include: { plan: true, owner: true },
    })
    if (!listing) return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
    if (listing.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Anúncio não está ativo' }, { status: 400 })
    }

    // === Owner cannot message own listing ===
    if (user && user.id === listing.ownerId) {
      return NextResponse.json({ error: 'Você não pode enviar mensagem para o seu próprio anúncio' }, { status: 400 })
    }

    // === Check lead limits on owner's subscription ===
    const ownerSub = await db.subscription.findFirst({
      where: { userId: listing.ownerId, status: 'ACTIVE', currentPeriodEnd: { gte: new Date() } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!ownerSub) return NextResponse.json({ error: 'O anunciante não possui assinatura ativa' }, { status: 403 })
    if (ownerSub.plan) {
      const plan = ownerSub.plan
      if (plan.maxLeadsPerMonth !== -1) {
        if (ownerSub.leadsReceivedThisCycle >= plan.maxLeadsPerMonth) {
          return NextResponse.json({ error: 'Este anunciante atingiu o limite de mensagens este mês.' }, { status: 429 })
        }
      }
    }

    // === For PANEL channel, check if plan allows panel messages ===
    const channelAllowed = {
      PANEL: ownerSub.plan.allowPanelMessage,
      WHATSAPP: ownerSub.plan.allowWhatsApp,
      PHONE: ownerSub.plan.allowPhone,
      EMAIL: ownerSub.plan.allowEmail,
    }[finalChannel]
    if (!channelAllowed) {
      return NextResponse.json({ error: 'O plano do anunciante não permite este canal de contato' }, { status: 403 })
    }
    // For WHATSAPP/PHONE/EMAIL channels, the lead is just a notification record —
    // the user actually contacts via external channel. Still create a lead for analytics.

    const lead = await db.$transaction([
      db.lead.create({
        data: {
          listingId: id,
          senderId: user?.id || null,
          senderName: senderName.trim().slice(0, 200),
          senderEmail: senderEmail?.trim() || null,
          senderPhone: senderPhone?.trim() || null,
          subject: subject?.trim()?.slice(0, 200) || null,
          message: message.trim().slice(0, 5000),
          channel: finalChannel,
        },
      }),
      db.classifiedListing.update({
        where: { id },
        data: { contactsCount: { increment: 1 } },
      }),
      // increment leads count on subscription
      ...(ownerSub ? [
        db.subscription.update({
          where: { id: ownerSub.id },
          data: { leadsReceivedThisCycle: { increment: 1 } },
        }),
      ] : []),
      // notify listing owner via in-app notification
      db.notification.create({
        data: {
          userId: listing.ownerId,
          type: 'LEAD',
          title: `Nova mensagem de ${senderName}`,
          message: `${senderName} enviou uma mensagem sobre "${listing.title}".`,
          link: 'advertiser',
        },
      }),
    ])

    // === WhatsApp notification to listing owner (if enabled) ===
    try {
      const waConfig = await db.whatsAppConfig.findFirst()
      if (waConfig?.isConnected && waConfig.notifyOnLead) {
        const target = waConfig.notifyPhone || waConfig.phoneNumber
        if (target) {
          const { sendWhatsAppMessage } = await import('@/lib/whatsapp-sender')
          const waMessage = `🔔 *Nova mensagem no classificado*\n\n*Anúncio:* ${listing.title}\n*De:* ${senderName}\n${senderEmail ? `*Email:* ${senderEmail}\n` : ''}${senderPhone ? `*Telefone:* ${senderPhone}\n` : ''}\n*Mensagem:*\n${message.trim().slice(0, 500)}\n\nAcesse o painel para responder.`
          await sendWhatsAppMessage(waConfig, target, waMessage)
        }
      }
    } catch (e) {
      console.error('[Classified contact] WhatsApp notify failed:', e)
    }

    return NextResponse.json({ lead: lead[0] })
  } catch (error) {
    console.error('Classified contact error:', error)
    return NextResponse.json({ error: 'Não foi possível enviar a mensagem' }, { status: 500 })
  }
}
