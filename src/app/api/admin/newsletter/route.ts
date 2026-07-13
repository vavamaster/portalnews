import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond } from '@/lib/api-helpers'

// GET /api/admin/newsletter — list subscribers
export async function GET(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response

  const url = new URL(req.url)
  const status = url.searchParams.get('status') || 'ALL'

  const where: any = {}
  if (status !== 'ALL') where.status = status

  const [subscribers, total, byStatus] = await Promise.all([
    db.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true, email: true, name: true, status: true, source: true,
        confirmedAt: true, createdAt: true,
      },
    }),
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ])

  return NextResponse.json({
    subscribers,
    total,
    byStatus: byStatus.reduce((acc: any, s) => ({ ...acc, [s.status]: s._count._all }), {}),
  })
}
