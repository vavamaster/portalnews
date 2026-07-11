import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/leads - leads for current user (as advertiser) or sent by user
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') || 'received'

  if (mode === 'received') {
    const leads = await db.lead.findMany({
      where: { listing: { ownerId: user.id } },
      include: {
        listing: { select: { id: true, title: true, slug: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ leads })
  } else {
    const leads = await db.lead.findMany({
      where: { senderId: user.id },
      include: {
        listing: { select: { id: true, title: true, slug: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ leads })
  }
}
