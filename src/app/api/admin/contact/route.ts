import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/contact — list contact messages
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('status') || 'ALL'

  const where: any = {}
  if (status !== 'ALL') where.status = status

  const [messages, total, byStatus] = await Promise.all([
    db.contactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.contactMessage.count({ where }),
    db.contactMessage.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ])

  return NextResponse.json({
    messages,
    total,
    byStatus: byStatus.reduce((acc: any, s) => ({ ...acc, [s.status]: s._count._all }), {}),
  })
}

// PATCH /api/admin/contact — update message status (mark as read/replied/archived)
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { id, status } = await req.json()
  if (!id || !['NEW', 'READ', 'REPLIED', 'ARCHIVED'].includes(status)) {
    return NextResponse.json({ error: 'id e status (NEW|READ|REPLIED|ARCHIVED) obrigatórios' }, { status: 400 })
  }

  const updated = await db.contactMessage.update({
    where: { id },
    data: { status },
  })

  return NextResponse.json({ message: updated })
}
