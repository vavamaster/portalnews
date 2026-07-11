import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/users/search?q=joao
// Search users by name or email — used in admin autocomplete inputs.
// Returns up to 20 results with id, name, email, role, avatar.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || ''

  if (q.length < 2) {
    return NextResponse.json({ users: [] })
  }

  // Case-insensitive search on name and email
  const users = await db.user.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { email: { contains: q } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
    },
    take: 20,
    orderBy: { name: 'asc' },
  })

  // Also check if each user has Enterprise access
  const links = await db.enterpriseUserLink.findMany({
    where: { userId: { in: users.map(u => u.id) } },
    select: { userId: true, companyName: true, isActive: true },
  })
  const linkMap = new Map(links.map(l => [l.userId, l]))

  return NextResponse.json({
    users: users.map(u => ({
      ...u,
      hasEnterpriseAccess: Boolean(linkMap.get(u.id)?.isActive),
      enterpriseCompanyName: linkMap.get(u.id)?.companyName || null,
    })),
  })
}
