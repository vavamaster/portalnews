import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// POST /api/classifieds/[id]/contact - send a lead message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser(req)
    const body = await req.json()
    const { senderName, senderEmail, senderPhone, subject, message, channel } = body

    if (!senderName || !message) {
      return NextResponse.json({ error: 'Nome e mensagem são obrigatórios' }, { status: 400 })
    }

    const listing = await db.classifiedListing.findUnique({
      where: { id },
      include: { plan: true, owner: true },
    })
    if (!listing) return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
    if (listing.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Anúncio não está ativo' }, { status: 400 })
    }

    // Check lead limits on owner's subscription
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

    // For PANEL channel, check if plan allows panel messages
    if (channel === 'PANEL' && !listing.plan.allowPanelMessage) {
      return NextResponse.json({ error: 'Este anúncio não aceita mensagens pelo painel' }, { status: 403 })
    }

    const lead = await db.$transaction([
      db.lead.create({
        data: {
          listingId: id,
          senderId: user?.id || null,
          senderName,
          senderEmail: senderEmail || null,
          senderPhone: senderPhone || null,
          subject: subject || null,
          message,
          channel: channel || 'PANEL',
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
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
