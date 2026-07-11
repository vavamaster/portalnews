import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/enterprise/me
// Returns the EnterpriseUserLink + all sponsored categories the user has ads in.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const link = await db.enterpriseUserLink.findUnique({
    where: { userId: user.id },
  })
  if (!link || !link.isActive) {
    return NextResponse.json({ error: 'Você não tem acesso Enterprise' }, { status: 403 })
  }

  // Get all ads owned by this user, grouped by sponsor
  const ads = await db.enterpriseAd.findMany({
    where: { ownerId: user.id },
    include: {
      sponsoredCategory: {
        include: {
          category: { select: { id: true, name: true, slug: true, color: true } },
          landingPage: { select: { id: true, companyName: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Get billing cycles for this user
  const billingCycles = await db.enterpriseBillingCycle.findMany({
    where: { userId: user.id },
    include: {
      sponsoredCategory: {
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Aggregate metrics (last 30 days, across all sponsors)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const sponsorIds = [...new Set(ads.map(a => a.sponsoredCategoryId))]
  const metrics = sponsorIds.length === 0 ? [] : await db.enterpriseMetric.findMany({
    where: { sponsoredCategoryId: { in: sponsorIds }, date: { gte: thirtyDaysAgo } },
    orderBy: { date: 'asc' },
  })

  // Totals
  const totals = {
    impressions: ads.reduce((s, a) => s + a.impressions, 0),
    clicks: ads.reduce((s, a) => s + a.clicks, 0),
    activeAds: ads.filter(a => a.status === 'ACTIVE').length,
    totalAds: ads.length,
    ctr: 0,
  }
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0

  return NextResponse.json({
    link,
    ads,
    billingCycles,
    metrics,
    totals,
  })
}
