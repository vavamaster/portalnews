import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond, handleApiError } from '@/lib/api-helpers'

// GET /api/admin/whatsapp/lists — list all subscriber lists
export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdminOrRespond(req)
    if (response) return response

    const lists = await db.whatsAppSubscriberList.findMany({
      include: { _count: { select: { subscribers: true, campaigns: true } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })
    return NextResponse.json({ lists })
  } catch (e: any) {
    return handleApiError(e, 'lists GET')
  }
}

// POST /api/admin/whatsapp/lists — create a list
// Body: { name, description?, color?, categorySlug?, isDefault?, isAuto? }
export async function POST(req: NextRequest) {
  try {
    const { response } = await requireAdminOrRespond(req)
    if (response) return response

    const body = await req.json().catch(() => ({}))
    const { name, description, color, categorySlug, isDefault, isAuto } = body
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'name é obrigatório (mín 2 chars)' }, { status: 400 })
    }

    // If isDefault, unset other defaults
    if (isDefault) {
      await db.whatsAppSubscriberList.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const list = await db.whatsAppSubscriberList.create({
      data: {
        name: name.trim(),
        description: description || null,
        color: color || 'blue',
        categorySlug: categorySlug || null,
        isDefault: !!isDefault,
        isAuto: !!isAuto,
      },
    })
    return NextResponse.json({ ok: true, list })
  } catch (e: any) {
    return handleApiError(e, 'lists POST')
  }
}
