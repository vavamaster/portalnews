import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/reviews?listingId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const listingId = url.searchParams.get('listingId')
  if (!listingId) return NextResponse.json({ reviews: [] })
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
    const body = await req.json()
    const { listingId, rating, comment } = body
    if (!listingId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Avaliação inválida' }, { status: 400 })
    }
    const listing = await db.classifiedListing.findUnique({
      where: { id: listingId },
      include: { plan: true, owner: true },
    })
    if (!listing) return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
    if (!listing.plan.allowReviews) {
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
        data: { listingId, reviewerId: user.id, rating, comment: comment || null },
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
