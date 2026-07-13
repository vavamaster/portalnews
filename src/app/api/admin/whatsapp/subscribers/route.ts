import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond, handleApiError } from '@/lib/api-helpers'

// GET /api/admin/whatsapp/subscribers — list subscribers with filters
// ?search=&listId=&isActive=&isVerified=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdminOrRespond(req)
    if (response) return response

    const url = new URL(req.url)
    const search = url.searchParams.get('search') || ''
    const listId = url.searchParams.get('listId')
    const isActive = url.searchParams.get('isActive')
    const isVerified = url.searchParams.get('isVerified')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0)

    const where: any = {}
    if (search) {
      where.OR = [
        { phoneNumber: { contains: search } },
        { name: { contains: search } },
      ]
    }
    if (isActive === 'true') where.isActive = true
    if (isActive === 'false') where.isActive = false
    if (isVerified === 'true') where.isVerified = true
    if (isVerified === 'false') where.isVerified = false
    if (listId) where.lists = { some: { listId } }

    const [subscribers, total] = await Promise.all([
      db.whatsAppSubscriber.findMany({
        where,
        include: {
          lists: { include: { list: true } },
          _count: { select: { campaignRecipients: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.whatsAppSubscriber.count({ where }),
    ])

    return NextResponse.json({ subscribers, total, limit, offset })
  } catch (e: any) {
    return handleApiError(e, 'subscribers GET')
  }
}

// POST /api/admin/whatsapp/subscribers — manually add subscriber
// Body: { phoneNumber, name?, listIds?: string[] }
export async function POST(req: NextRequest) {
  try {
    const { response } = await requireAdminOrRespond(req)
    if (response) return response

    const body = await req.json().catch(() => ({}))
    const { phoneNumber, name, listIds } = body
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'phoneNumber é obrigatório' }, { status: 400 })
    }
    const normalized = phoneNumber.replace(/\D/g, '')
    if (normalized.length < 10 || normalized.length > 15) {
      return NextResponse.json({ error: 'Número inválido' }, { status: 400 })
    }

    const subscriber = await db.whatsAppSubscriber.upsert({
      where: { phoneNumber: normalized },
      create: {
        phoneNumber: normalized,
        name: name || null,
        isVerified: true, // admin-added = pre-verified
        verifiedAt: new Date(),
        optInSource: 'MANUAL',
        isActive: true,
      },
      update: {
        isActive: true,
        ...(name ? { name } : {}),
      },
    })

    // Add to default list
    const defaultList = await db.whatsAppSubscriberList.findFirst({ where: { isDefault: true } })
    if (defaultList) {
      await db.whatsAppSubscriberListEntry.upsert({
        where: { subscriberId_listId: { subscriberId: subscriber.id, listId: defaultList.id } },
        create: { subscriberId: subscriber.id, listId: defaultList.id },
        update: {},
      }).catch(() => {})
    }
    // Add to selected lists
    if (Array.isArray(listIds)) {
      for (const listId of listIds) {
        await db.whatsAppSubscriberListEntry.upsert({
          where: { subscriberId_listId: { subscriberId: subscriber.id, listId } },
          create: { subscriberId: subscriber.id, listId },
          update: {},
        }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, subscriber })
  } catch (e: any) {
    return handleApiError(e, 'subscribers POST')
  }
}
