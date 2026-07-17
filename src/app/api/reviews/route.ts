import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { consumeRequestLimit } from '@/lib/request-rate-limit'

// GET /api/reviews?listingId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const listingId = url.searchParams.get('listingId')
  if (!listingId) return NextResponse.json({ reviews: [] })
  const listing = await db.classifiedListing.findFirst({
    where: { id: listingId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    select: { ownerId: true },
  })
  if (!listing) return NextResponse.json({ reviews: [] })
  const activeSub = await db.subscription.findFirst({
    where: { userId: listing.ownerId, status: 'ACTIVE', currentPeriodEnd: { gte: new Date() } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!activeSub?.plan.allowReviews) return NextResponse.json({ reviews: [] })
  const reviews = await db.review.findMany({
    where: { listingId },
    include: { reviewer: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ reviews })
}

// POST - create review
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login para avaliar' }, { status: 401 })
    const rateLimit = await consumeRequestLimit(req, {
      scope: 'reviews-user', subject: user.id, includeIp: false, limit: 20, windowSeconds: 60 * 60,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Muitas avaliações em pouco tempo.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }
    const body = await req.json()
    const { listingId, rating, comment } = body
    if (typeof listingId !== 'string' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Avaliação inválida' }, { status: 400 })
    }
    if (comment !== undefined && comment !== null && (typeof comment !== 'string' || comment.trim().length > 2000)) {
      return NextResponse.json({ error: 'Comentário inválido ou muito longo' }, { status: 400 })
    }
    const listing = await db.classifiedListing.findUnique({
      where: { id: listingId },
      include: { plan: true, owner: true },
    })
    if (!listing) return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
    if (listing.status !== 'ACTIVE' || !listing.expiresAt || listing.expiresAt <= new Date()) {
      return NextResponse.json({ error: 'Anúncio não está disponível para avaliações' }, { status: 400 })
    }
    if (listing.ownerId === user.id) {
      return NextResponse.json({ error: 'Você não pode avaliar o próprio anúncio' }, { status: 400 })
    }
    const activeSub = await db.subscription.findFirst({
      where: { userId: listing.ownerId, status: 'ACTIVE', currentPeriodEnd: { gte: new Date() } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!activeSub?.plan.allowReviews) {
      return NextResponse.json({ error: 'Este anúncio não aceita avaliações' }, { status: 403 })
    }
    // Check unique review per user per listing
    const existing = await db.review.findUnique({
      where: { listingId_reviewerId: { listingId, reviewerId: user.id } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Você já avaliou este anúncio' }, { status: 400 })
    }

    // Award points for review (5 pts)
    const reviewPoints = 5
    const [review] = await db.$transaction([
      db.review.create({
        data: { listingId, reviewerId: user.id, rating, comment: comment?.trim() || null },
        include: { reviewer: { select: { id: true, name: true, avatar: true } } },
      }),
      db.user.update({
        where: { id: user.id },
        data: { points: { increment: reviewPoints } },
      }),
      db.pointTransaction.create({
        data: { userId: user.id, amount: reviewPoints, reason: 'REVIEW', postId: listingId },
      }),
      // notify listing owner
      db.notification.create({
        data: {
          userId: listing.ownerId,
          type: 'REVIEW',
          title: `Nova avaliação de ${user.name}`,
          message: `${user.name} avaliou "${listing.title}" com ${rating} estrela(s).`,
          link: 'advertiser',
        },
      }),
    ])

    // Auto-check achievements
    const { autoCheckAchievements } = await import('@/lib/achievements')
    await autoCheckAchievements(user.id)

    return NextResponse.json({ review, pointsAwarded: reviewPoints })
  } catch (error) {
    console.error('[reviews] unexpected error:', error)
    return NextResponse.json({ error: 'Não foi possível registrar a avaliação' }, { status: 500 })
  }
}
