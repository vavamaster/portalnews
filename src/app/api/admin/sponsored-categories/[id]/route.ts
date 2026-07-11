import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/sponsored-categories/[id] — full detail (sponsor config + ads + landing page + billing cycles + metrics)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params
  const sc = await db.sponsoredCategory.findUnique({
    where: { id },
    include: {
      category: true,
      ads: {
        include: { owner: { select: { id: true, name: true, email: true } } },
        orderBy: { order: 'asc' },
      },
      landingPage: true,
      billingCycles: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  })
  if (!sc) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  // Get last 30 days of metrics
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0)
  const metrics = await db.enterpriseMetric.findMany({
    where: { sponsoredCategoryId: sc.id, date: { gte: thirtyDaysAgo } },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json({ sponsor: sc, metrics })
}

// PATCH /api/admin/sponsored-categories/[id] — update config
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json()
  const allowed = ['mode', 'billingType', 'billingValueCents', 'billingImpressions', 'maxRotatingAds',
    'transitionType', 'transitionMs', 'commercialContactName', 'commercialContactEmail',
    'commercialContactPhone', 'bannerWidth', 'bannerHeight', 'isActive']
  const data: any = {}
  for (const k of allowed) {
    if (k in body) data[k] = body[k]
  }
  // EXCLUSIVE → maxRotatingAds = 1
  if (data.mode === 'EXCLUSIVE') data.maxRotatingAds = 1
  if (data.transitionMs !== undefined) {
    const tMs = parseInt(data.transitionMs, 10)
    if (isNaN(tMs) || tMs < 3000 || tMs > 10000) {
      return NextResponse.json({ error: 'tempo de transição deve ser entre 3000 e 10000ms' }, { status: 400 })
    }
  }
  const sc = await db.sponsoredCategory.update({ where: { id }, data })
  return NextResponse.json({ ok: true, sponsor: sc })
}

// DELETE /api/admin/sponsored-categories/[id] — remove sponsor config (keeps category)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id } = await params
  await db.sponsoredCategory.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
