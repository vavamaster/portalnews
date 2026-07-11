import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET - list ads (with filters)
// ?status=ALL (admin: all ads), ?status=PENDING (admin: moderation queue), ?placement=HOME_SIDEBAR (public: active only)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const placement = url.searchParams.get('placement')
  const status = url.searchParams.get('status')
  const ownerOnly = url.searchParams.get('ownerOnly') === 'true'

  const user = await getCurrentUser(req)

  const where: any = {}
  if (placement) where.placement = placement

  // Status filtering logic
  if (status && status !== 'ALL') {
    where.status = status
  } else if (!status && placement) {
    // Public request with placement but no status → only ACTIVE
    where.status = 'ACTIVE'
    const now = new Date()
    where.OR = [
      { startAt: null, endAt: null },
      { startAt: { lte: now }, endAt: { gte: now } },
      { startAt: { lte: now }, endAt: null },
    ]
  }

  // Owner filter
  if (ownerOnly) {
    if (!user) return NextResponse.json({ ads: [] })
    where.ownerId = user.id
  }

  // Admin can see all; non-admin can only see ACTIVE or own
  if (status === 'ALL' && !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const ads = await db.ad.findMany({
    where,
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ ads })
}

// POST - create ad (admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (!['MASTER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Apenas administradores podem criar anúncios diretamente' }, { status: 403 })
    }
    const body = await req.json()
    const { title, content, imageUrl, linkUrl, placement, status, categoryId, startAt, endAt } = body
    if (!title || !placement) {
      return NextResponse.json({ error: 'Título e posicionamento obrigatórios' }, { status: 400 })
    }
    const ad = await db.ad.create({
      data: {
        title, content, imageUrl, linkUrl, placement,
        status: status || 'ACTIVE',
        isFreeAd: false,
        ownerId: user.id,
        categoryId: categoryId || null,
        startAt: startAt ? new Date(startAt) : new Date(),
        endAt: endAt ? new Date(endAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    return NextResponse.json({ ad })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
