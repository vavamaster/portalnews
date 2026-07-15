import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { adminAdSchema, validationError } from '@/lib/admin-validation'
import { handleApiError } from '@/lib/api-helpers'
import { auditAdminAction } from '@/lib/admin-audit'

// GET - list ads (with filters)
// ?status=ALL (admin: all ads), ?status=PENDING (admin: moderation queue), ?placement=HOME_SIDEBAR (public: active only)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const placement = url.searchParams.get('placement')
  const status = url.searchParams.get('status')
  const ownerOnly = url.searchParams.get('ownerOnly') === 'true'

  const user = await getCurrentUser(req)
  const isAdmin = !!user && ['MASTER', 'ADMIN'].includes(user.role)

  const where: any = {}
  if (placement) where.placement = placement

  // Status is an administrative filter. Public callers always receive only
  // active, scheduled ads; authenticated owners can inspect only their own.
  if (status && !isAdmin && !ownerOnly) {
    return NextResponse.json({ error: user ? 'Permissão negada' : 'Não autorizado' }, { status: user ? 403 : 401 })
  }
  if (!placement && !status && !ownerOnly && !isAdmin) {
    return NextResponse.json({ error: user ? 'Permissão negada' : 'Não autorizado' }, { status: user ? 403 : 401 })
  }

  if (status && status !== 'ALL') {
    where.status = status
  } else if (!status && placement && !ownerOnly && !isAdmin) {
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

  const ads = await db.ad.findMany({
    where,
    include: { owner: { select: { id: true, name: true, ...(isAdmin || ownerOnly ? { email: true } : {}) } } },
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
    const parsed = adminAdSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })
    const { title, content, imageUrl, linkUrl, placement, status, categoryId, startAt, endAt } = parsed.data
    const ad = await db.ad.create({
      data: {
        title, content, imageUrl: imageUrl || null, linkUrl: linkUrl || null, placement,
        status,
        isFreeAd: false,
        ownerId: user.id,
        categoryId: categoryId || null,
        startAt: startAt ? new Date(startAt) : new Date(),
        endAt: endAt ? new Date(endAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    await auditAdminAction(req, user, 'CREATE', 'AD', ad.id, { placement, status })
    return NextResponse.json({ ad })
  } catch (e: any) {
    return handleApiError(e, 'admin ad create')
  }
}
