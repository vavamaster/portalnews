import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { safeReqJson } from '@/lib/api-helpers'

// GET /api/admin/header-ads — list all ads
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const ads = await db.headerAd.findMany({ orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] })
  return NextResponse.json({ ads })
}

// POST /api/admin/header-ads — create new ad
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const body = await safeReqJson<any>(req)
  if (!body.ok) return body.response
  const data = body.data

  if (!data.name || !data.images) {
    return NextResponse.json({ error: 'name e images são obrigatórios' }, { status: 400 })
  }

  const ad = await db.headerAd.create({
    data: {
      name: data.name,
      type: data.type || 'static',
      images: typeof data.images === 'string' ? data.images : JSON.stringify(data.images),
      linkUrl: data.linkUrl || null,
      animation: data.animation || 'fade',
      slideInterval: parseInt(data.slideInterval) || 5000,
      position: data.position || 'below-nav',
      startAt: data.startAt ? new Date(data.startAt) : null,
      endAt: data.endAt ? new Date(data.endAt) : null,
      daysOfWeek: data.daysOfWeek || null,
      hourRange: data.hourRange || null,
      isActive: data.isActive ?? true,
      priority: parseInt(data.priority) || 0,
      openNewTab: data.openNewTab ?? true,
      widthHint: parseInt(data.widthHint) || 728,
      heightHint: parseInt(data.heightHint) || 90,
    },
  })
  return NextResponse.json({ ok: true, ad })
}

// PUT /api/admin/header-ads?id=xxx — update ad
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const body = await safeReqJson<any>(req)
  if (!body.ok) return body.response
  const data = body.data

  const update: any = {}
  if (data.name !== undefined) update.name = data.name
  if (data.type !== undefined) update.type = data.type
  if (data.images !== undefined) update.images = typeof data.images === 'string' ? data.images : JSON.stringify(data.images)
  if (data.linkUrl !== undefined) update.linkUrl = data.linkUrl || null
  if (data.animation !== undefined) update.animation = data.animation
  if (data.slideInterval !== undefined) update.slideInterval = parseInt(data.slideInterval) || 5000
  if (data.position !== undefined) update.position = data.position
  if (data.startAt !== undefined) update.startAt = data.startAt ? new Date(data.startAt) : null
  if (data.endAt !== undefined) update.endAt = data.endAt ? new Date(data.endAt) : null
  if (data.daysOfWeek !== undefined) update.daysOfWeek = data.daysOfWeek || null
  if (data.hourRange !== undefined) update.hourRange = data.hourRange || null
  if (data.isActive !== undefined) update.isActive = data.isActive
  if (data.priority !== undefined) update.priority = parseInt(data.priority) || 0
  if (data.openNewTab !== undefined) update.openNewTab = data.openNewTab
  if (data.widthHint !== undefined) update.widthHint = parseInt(data.widthHint) || 728
  if (data.heightHint !== undefined) update.heightHint = parseInt(data.heightHint) || 90

  const ad = await db.headerAd.update({ where: { id }, data: update })
  return NextResponse.json({ ok: true, ad })
}

// DELETE /api/admin/header-ads?id=xxx
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  await db.headerAd.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
