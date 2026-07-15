import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isEnterpriseCycleEligible } from '@/lib/enterprise'

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

  // Category-level daily aggregates include every rotating company and must not
  // be exposed to an individual advertiser. Per-ad lifetime counters are safe.
  const now = new Date()
  let validCycles = billingCycles.filter(cycle => (
    cycle.sponsoredCategory.isActive
    && cycle.sponsoredCategory.mode !== 'DISABLED'
    && isEnterpriseCycleEligible(cycle, now)
  ))
  const exclusiveSponsorIds = [...new Set(validCycles
    .filter(cycle => cycle.sponsoredCategory.mode === 'EXCLUSIVE')
    .map(cycle => cycle.sponsoredCategoryId))]
  if (exclusiveSponsorIds.length > 0) {
    const exclusiveCycles = await db.enterpriseBillingCycle.findMany({
      where: { sponsoredCategoryId: { in: exclusiveSponsorIds }, status: 'ACTIVE' },
      include: { user: { select: { enterpriseLink: { select: { isActive: true } } } } },
      orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
    })
    const winnerBySponsor = new Map<string, string>()
    for (const cycle of exclusiveCycles) {
      if (cycle.user.enterpriseLink?.isActive && isEnterpriseCycleEligible(cycle, now) && !winnerBySponsor.has(cycle.sponsoredCategoryId)) {
        winnerBySponsor.set(cycle.sponsoredCategoryId, cycle.userId)
      }
    }
    validCycles = validCycles.filter(cycle => (
      cycle.sponsoredCategory.mode !== 'EXCLUSIVE' || winnerBySponsor.get(cycle.sponsoredCategoryId) === user.id
    ))
  }
  const availableSponsors = [...new Map(validCycles.map(cycle => [cycle.sponsoredCategoryId, {
    id: cycle.sponsoredCategoryId,
    mode: cycle.sponsoredCategory.mode,
    maxRotatingAds: cycle.sponsoredCategory.maxRotatingAds,
    category: cycle.sponsoredCategory.category,
  }])).values()]
  const servingCycleIds = new Set(validCycles.map(cycle => cycle.id))

  // Totals
  const totals = {
    impressions: ads.reduce((s, a) => s + a.impressions, 0),
    clicks: ads.reduce((s, a) => s + a.clicks, 0),
    activeAds: ads.filter(a => a.status === 'ACTIVE' && validCycles.some(cycle => cycle.sponsoredCategoryId === a.sponsoredCategoryId)).length,
    totalAds: ads.length,
    ctr: 0,
  }
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0

  return NextResponse.json({
    link,
    ads,
    billingCycles: billingCycles.map(cycle => ({ ...cycle, isServing: servingCycleIds.has(cycle.id) })),
    metrics: [],
    availableSponsors,
    totals,
  })
}
