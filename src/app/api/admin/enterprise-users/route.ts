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

  // For each link, count the user's enterprise ads and billing cycles
  const result = await Promise.all(links.map(async (link) => {
    const adCount = await db.enterpriseAd.count({
      where: { ownerId: link.userId }
    })
    const cycleCount = await db.enterpriseBillingCycle.count({
      where: { userId: link.userId }
    })
    return {
      id: link.id,
      userId: link.userId,
      companyName: link.companyName,
      isActive: link.isActive,
      assignedAt: link.assignedAt,
      user: link.user,
      adCount,
      cycleCount,
    }
  }))

  return NextResponse.json({ users: result })
}
