import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// POST /api/classifieds/[id]/contact - send a lead message
// Rate limit: non-auth users limited to 3 leads/hour per IP; auth users limited to 20/hour per user
const leadRateMap = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(key: string, max: number, windowMs: number): { allowed: boolean; resetAt: number } {
  const now = Date.now()
  const entry = leadRateMap.get(key)
  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs
    leadRateMap.set(key, { count: 1, resetAt })
    return { allowed: true, resetAt }
  }
  if (entry.count >= max) {
    return { allowed: false, resetAt: entry.resetAt }
  }
  entry.count++
  return { allowed: true, resetAt: entry.resetAt }
}

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
    // Non-auth: by IP, 3/hour. Auth: by user id, 20/hour.
    const rateKey = user ? `user:${user.id}` : `ip:${req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'}`
    const rateMax = user ? 20 : 3
    const rate = checkRateLimit(rateKey, rateMax, 60 * 60 * 1000)
    if (!rate.allowed) {
      const minsLeft = Math.ceil((rate.resetAt - Date.now()) / 60000)
      return NextResponse.json({
        error: `Limite de mensagens atingido. Tente novamente em ${minsLeft} minuto(s).`,
      }, { status: 429 })
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
      where: { userId: listing.ownerId, status: 'ACTIVE' },
      include: { plan: true },
    })
    if (ownerSub && ownerSub.plan) {
      const plan = ownerSub.plan
      if (plan.maxLeadsPerMonth !== -1) {
        if (ownerSub.leadsReceivedThisCycle >= plan.maxLeadsPerMonth) {
          return NextResponse.json({ error: 'Este anunciante atingiu o limite de mensagens este mês.' }, { status: 429 })
        }
      }
    }

    // === For PANEL channel, check if plan allows panel messages ===
    if (finalChannel === 'PANEL' && !listing.plan.allowPanelMessage) {
      return NextResponse.json({ error: 'Este anúncio não aceita mensagens pelo painel' }, { status: 403 })
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
      // notify listing owner
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

    return NextResponse.json({ lead: lead[0] })
  } catch (e: any) {
    console.error('Classified contact error:', e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
