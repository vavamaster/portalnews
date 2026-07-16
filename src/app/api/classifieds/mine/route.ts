import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/classifieds/mine - current user's listings + stats
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const now = new Date()
  const [listings, subscription, totalViews, totalLeads, reviewStats] = await Promise.all([
    db.classifiedListing.findMany({
      where: { ownerId: user.id },
      include: {
        category: true,
        plan: true,
        _count: { select: { leads: true, reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.subscription.findFirst({
      where: { userId: user.id, status: 'ACTIVE', currentPeriodEnd: { gte: now } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.classifiedListing.aggregate({
      where: { ownerId: user.id },
      _sum: { views: true },
    }),
    db.lead.count({
      where: { listing: { ownerId: user.id } },
    }),
    db.review.aggregate({
      where: { listing: { ownerId: user.id } },
      _count: { _all: true },
      _avg: { rating: true },
    }),
  ])
  const quotaListings = listings.filter(l => l.status === 'ACTIVE' || l.status === 'PENDING').length

  // Get leads for the last 7 days by day
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentLeads = await db.lead.findMany({
    where: { listing: { ownerId: user.id }, createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true, channel: true },
  })
  const leadsByDay: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    const count = recentLeads.filter(l => l.createdAt.toISOString().slice(0, 10) === dateStr).length
    leadsByDay.push({ date: dateStr, count })
  }

  return NextResponse.json({
    listings,
    subscription,
    stats: {
      totalListings: listings.length,
      activeListings: listings.filter(l => l.status === 'ACTIVE' && !!l.expiresAt && l.expiresAt > now).length,
      quotaListings,
      totalViews: totalViews._sum.views || 0,
      totalLeads,
      totalReviews: reviewStats._count._all,
      avgRating: reviewStats._avg.rating || 0,
    },
    leadsByDay,
  })
}
