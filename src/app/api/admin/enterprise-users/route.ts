import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/enterprise-users
// Lists ALL users with Enterprise access (EnterpriseUserLink), with their ad counts.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const links = await db.enterpriseUserLink.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, avatar: true }
      },
    },
    orderBy: { assignedAt: 'desc' },
  })

  const userIds = links.map(link => link.userId)
  const [adCounts, cycleCounts] = userIds.length === 0 ? [[], []] : await Promise.all([
    db.enterpriseAd.groupBy({ by: ['ownerId'], where: { ownerId: { in: userIds } }, _count: { _all: true } }),
    db.enterpriseBillingCycle.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _count: { _all: true } }),
  ])
  const adsByUser = new Map(adCounts.map(item => [item.ownerId, item._count._all]))
  const cyclesByUser = new Map(cycleCounts.map(item => [item.userId, item._count._all]))

  const result = links.map(link => ({
      id: link.id,
      userId: link.userId,
      companyName: link.companyName,
      isActive: link.isActive,
      assignedAt: link.assignedAt,
      user: link.user,
      adCount: adsByUser.get(link.userId) || 0,
      cycleCount: cyclesByUser.get(link.userId) || 0,
    }))

  return NextResponse.json({ users: result })
}
