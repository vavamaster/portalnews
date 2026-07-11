import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/classifieds — list all classifieds for moderation
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('status') || 'ALL'
  const search = url.searchParams.get('search') || ''
  const categorySlug = url.searchParams.get('category')
  const planSlug = url.searchParams.get('plan')

  const where: any = {}
  if (status !== 'ALL') where.status = status
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ]
  }
  if (categorySlug) {
    const cat = await db.classifiedCategory.findUnique({ where: { slug: categorySlug } })
    if (cat) where.categoryId = cat.id
  }
  if (planSlug) {
    const plan = await db.plan.findUnique({ where: { slug: planSlug } })
    if (plan) where.planId = plan.id
  }

  const [listings, total, byStatus, byPlan] = await Promise.all([
    db.classifiedListing.findMany({
      where,
      include: {
        category: true,
        owner: { select: { id: true, name: true, email: true, avatar: true } },
        plan: true,
        _count: { select: { leads: true, reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.classifiedListing.count({ where }),
    db.classifiedListing.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    db.classifiedListing.groupBy({
      by: ['planId'],
      _count: { _all: true },
    }),
  ])

  const plansMap = await db.plan.findMany()
  const byPlanWithSlug = byPlan.map(b => {
    const plan = plansMap.find(p => p.id === b.planId)
    return { planSlug: plan?.slug || 'unknown', planName: plan?.name || 'N/A', count: b._count._all }
  })

  return NextResponse.json({
    listings,
    total,
    byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count._all }), {}),
    byPlan: byPlanWithSlug,
  })
}
