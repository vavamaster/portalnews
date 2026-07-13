import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond, handleApiError } from '@/lib/api-helpers'
import { pauseCampaign, resumeCampaign, cancelCampaign } from '@/lib/whatsapp/campaign-processor'

// GET /api/admin/whatsapp/campaigns — list campaigns
// ?status=&type=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdminOrRespond(req)
    if (response) return response

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0)

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type

    const [campaigns, total] = await Promise.all([
      db.whatsAppCampaign.findMany({
        where,
        include: {
          list: { select: { name: true } },
          article: { select: { title: true, slug: true } },
          _count: { select: { recipients: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.whatsAppCampaign.count({ where }),
    ])

    return NextResponse.json({ campaigns, total, limit, offset })
  } catch (e: any) {
    return handleApiError(e, 'campaigns GET')
  }
}

// POST /api/admin/whatsapp/campaigns — create + schedule a campaign
// Body: { name, message, imageUrl?, listId?, articleId?, scheduledAt?, type? }
//   or { action: 'pause'|'resume'|'cancel', campaignId }
export async function POST(req: NextRequest) {
  try {
    const { user, response } = await requireAdminOrRespond(req)
    if (response) return response

    const body = await req.json().catch(() => ({}))

    // === Action: pause/resume/cancel ===
    if (body.action && body.campaignId) {
      if (body.action === 'pause') {
        await pauseCampaign(body.campaignId)
        return NextResponse.json({ ok: true })
      }
      if (body.action === 'resume') {
        await resumeCampaign(body.campaignId)
        return NextResponse.json({ ok: true })
      }
      if (body.action === 'cancel') {
        await cancelCampaign(body.campaignId)
        return NextResponse.json({ ok: true })
      }
      return NextResponse.json({ error: `Ação desconhecida: ${body.action}` }, { status: 400 })
    }

    // === Create new campaign ===
    const { name, message, imageUrl, listId, articleId, scheduledAt, type } = body
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return NextResponse.json({ error: 'name é obrigatório (mín 3 chars)' }, { status: 400 })
    }
    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return NextResponse.json({ error: 'message é obrigatória (mín 5 chars)' }, { status: 400 })
    }

    // Validate list exists if provided
    if (listId) {
      const list = await db.whatsAppSubscriberList.findUnique({ where: { id: listId } })
      if (!list) return NextResponse.json({ error: 'Lista não encontrada' }, { status: 400 })
    }

    // If scheduledAt not provided, schedule for next allowed time (now if allowed)
    let scheduleDate: Date
    if (scheduledAt) {
      scheduleDate = new Date(scheduledAt)
      if (isNaN(scheduleDate.getTime())) {
        return NextResponse.json({ error: 'scheduledAt inválido' }, { status: 400 })
      }
    } else {
      scheduleDate = new Date(Date.now() + 60_000) // 1 min from now
    }

    const campaign = await db.whatsAppCampaign.create({
      data: {
        name: name.trim(),
        type: type || 'MANUAL',
        message: message.trim(),
        imageUrl: imageUrl || null,
        articleId: articleId || null,
        listId: listId || null,
        status: 'SCHEDULED',
        scheduledAt: scheduleDate,
        createdBy: user.id,
      },
    })

    return NextResponse.json({ ok: true, campaign })
  } catch (e: any) {
    return handleApiError(e, 'campaigns POST')
  }
}
