import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isEnterpriseCycleEligible, safeEnterpriseUrl } from '@/lib/enterprise'
import { createAdTrackingToken } from '@/lib/ad-tracking'

export const dynamic = 'force-dynamic'

// GET /api/sponsored-categories/serve?categoryId=xxx
// Public endpoint — returns the active ad(s) for a sponsored category.
// Returns only ads whose owner has a valid contract for this category.
// Impressions are recorded separately when each creative actually becomes visible.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const categoryId = url.searchParams.get('categoryId')
    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId é obrigatório' }, { status: 400 })
    }

    // Find the sponsored category config for this category
    const now = new Date()
    const sc = await db.sponsoredCategory.findUnique({
      where: { categoryId },
      include: {
        ads: {
          where: {
            status: 'ACTIVE',
            // M-03 fix: filter by scheduling dates
            AND: [
              { OR: [{ startAt: null }, { startAt: { lte: now } }] },
              { OR: [{ endAt: null }, { endAt: { gt: now } }] },
            ],
          },
          orderBy: { order: 'asc' },
        },
        landingPage: true,
      },
    })

    // No sponsor or disabled → return empty (the client shows a "Anuncie aqui" placeholder)
    if (!sc || !sc.isActive || sc.mode === 'DISABLED' || sc.ads.length === 0) {
      return NextResponse.json({ sponsored: false, ad: null })
    }

    // Billing must cover the owner of each individual creative. A paid company
    // must never unlock another company's ad in rotating mode.
    const activeCycles = await db.enterpriseBillingCycle.findMany({
      where: {
        sponsoredCategoryId: sc.id,
        status: 'ACTIVE',
      },
      orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
    })

    const activeEnterpriseLinks = await db.enterpriseUserLink.findMany({
      where: { userId: { in: [...new Set(sc.ads.map(ad => ad.ownerId))] }, isActive: true },
      select: { userId: true },
    })
    const enabledOwners = new Set(activeEnterpriseLinks.map(link => link.userId))
    const eligibleAds = sc.ads.filter(ad => enabledOwners.has(ad.ownerId) && activeCycles.some(cycle => (
      cycle.userId === ad.ownerId && isEnterpriseCycleEligible(cycle, now)
    )))

    if (eligibleAds.length === 0) {
      return NextResponse.json({ sponsored: false, ad: null, reason: 'no_active_cycle' })
    }

    // Defensive selection for exclusive mode: the newest active contract wins
    // until the reconciliation job expires any legacy conflicting cycles.
    const exclusiveOwnerId = sc.mode === 'EXCLUSIVE'
      ? activeCycles.find(cycle => enabledOwners.has(cycle.userId) && isEnterpriseCycleEligible(cycle, now))?.userId
      : null
    const servedAds = sc.mode === 'EXCLUSIVE'
      ? eligibleAds.filter(ad => ad.ownerId === exclusiveOwnerId).slice(0, 1)
      : eligibleAds

    if (servedAds.length === 0) return NextResponse.json({ sponsored: false, ad: null })

    // Return the ad payload (no owner-sensitive data)
    return NextResponse.json({
      sponsored: true,
      mode: sc.mode,
      transitionType: sc.transitionType,
      transitionMs: sc.transitionMs,
      bannerWidth: sc.bannerWidth,
      bannerHeight: sc.bannerHeight,
      ads: servedAds.map(a => ({
        id: a.id,
        title: a.title,
        subtitle: a.subtitle,
        logoUrl: safeEnterpriseUrl(a.logoUrl, { allowRelative: true }),
        imageUrl: safeEnterpriseUrl(a.imageUrl, { allowRelative: true }),
        videoUrl: safeEnterpriseUrl(a.videoUrl, { youtubeOnly: true }),
        linkUrl: safeEnterpriseUrl(a.linkUrl, { allowRelative: true }) || (sc.landingPage ? `/empresa/${encodeURIComponent(sc.landingPage.slug)}` : null),
        ctaText: a.ctaText,
        trackingToken: createAdTrackingToken(a.id, 'enterprise'),
      })),
      landingPageSlug: sc.landingPage?.slug || null,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (e: any) {
    console.error('[SponsoredCategory] serve error:', e)
    return NextResponse.json({ error: 'Não foi possível carregar o anúncio patrocinado' }, { status: 500 })
  }
}
