import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/posts/review - list posts pending review (admin only)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('status') || 'PENDING'
  const limit = parseInt(url.searchParams.get('limit') || '50', 10)

  const where: any = {}
  if (status === 'PENDING') {
    where.status = 'PENDING'
  } else if (status === 'REVIEWED') {
    where.status = { in: ['PUBLISHED', 'REJECTED'] }
    where.reviewerId = { not: null }
  } else if (status === 'AUTO') {
    where.rejectionReason = { in: ['AUTO_TIMEOUT'] }
  } else if (status === 'ALL') {
    // no filter
  } else {
    where.status = status
  }

  const posts = await db.post.findMany({
    where,
    include: {
      author: {
        select: { id: true, name: true, avatar: true, email: true, editorProfile: true },
      },
      category: true,
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: status === 'PENDING' ? { autoActionAt: 'asc' } : { reviewedAt: 'desc' },
    take: limit,
  })

  // Get summary stats
  const [pendingCount, autoActionDueCount, todayApproved, todayRejected] = await Promise.all([
    db.post.count({ where: { status: 'PENDING' } }),
    db.post.count({ where: { status: 'PENDING', autoActionAt: { not: null } } }),
    db.post.count({
      where: {
        status: 'PUBLISHED',
        reviewerId: { not: null },
        reviewedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    db.post.count({
      where: {
        status: 'REJECTED',
        reviewedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ])

  return NextResponse.json({
    posts,
    stats: { pendingCount, autoActionDueCount, todayApproved, todayRejected },
  })
}
