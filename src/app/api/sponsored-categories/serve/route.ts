import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/sponsored-categories/serve?categoryId=xxx
// Public endpoint — returns the active ad(s) for a sponsored category.
// Picks ONE ad to serve (rotating picks a random one weighted by order; exclusive picks the single active ad).
// Also increments the impression counter for the chosen ad and the daily metric.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const categoryId = url.searchParams.get('categoryId')
    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId é obrigatório' }, { status: 400 })
    }

    // Find the sponsored category config for this category
    const sc = await db.sponsoredCategory.findUnique({
      where: { categoryId },
      include: {
        ads: {
          where: { status: 'ACTIVE' },
          orderBy: { order: 'asc' },
        },
        landingPage: true,
      },
    })

    // No sponsor or disabled → return empty (the client shows a "Anuncie aqui" placeholder)
    if (!sc || !sc.isActive || sc.mode === 'DISABLED' || sc.ads.length === 0) {
      return NextResponse.json({ sponsored: false, ad: null })
    }

    // Verify there's at least one active billing cycle for this sponsor
    const activeCycle = await db.enterpriseBillingCycle.findFirst({
      where: {
        sponsoredCategoryId: sc.id,
        status: 'ACTIVE',
        // For monthly: endAt in the future (or null)
        // For impressions: impressionsUsed < impressionsLimit
        OR: [
          { type: 'MONTHLY', AND: [{ OR: [{ endAt: null }, { endAt: { gt: new Date() } }] }] },
          { type: 'IMPRESSIONS', impressionsUsed: { lt: sc.billingImpressions } },
        ],
      },
    })
    if (!activeCycle) {
      // No active billing — pause all ads (will be done by cron, but double-check here)
      return NextResponse.json({ sponsored: false, ad: null, reason: 'no_active_cycle' })
    }

    // Pick an ad to serve
    let chosenAd
    if (sc.mode === 'EXCLUSIVE') {
      chosenAd = sc.ads[0]
    } else {
      // ROTATING: pick a random ad weighted by order (lower order = higher weight)
      // Simple approach: random pick from active ads
      chosenAd = sc.ads[Math.floor(Math.random() * sc.ads.length)]
    }

    if (!chosenAd) {
      return NextResponse.json({ sponsored: false, ad: null })
    }

    // Increment impression counter (async, fire-and-forget)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    db.enterpriseAd.update({
      where: { id: chosenAd.id },
      data: { impressions: { increment: 1 } },
    }).catch(() => {})
    db.enterpriseMetric.upsert({
      where: { sponsoredCategoryId_date: { sponsoredCategoryId: sc.id, date: today } },
      update: { impressions: { increment: 1 } },
      create: { sponsoredCategoryId: sc.id, date: today, impressions: 1 },
    }).catch(() => {})
    // If impressions-based billing, also increment the cycle counter
    if (activeCycle.type === 'IMPRESSIONS') {
      db.enterpriseBillingCycle.update({
        where: { id: activeCycle.id },
        data: { impressionsUsed: { increment: 1 } },
      }).catch(() => {})
    }

    // Return the ad payload (no owner-sensitive data)
    return NextResponse.json({
      sponsored: true,
      mode: sc.mode,
      transitionType: sc.transitionType,
      transitionMs: sc.transitionMs,
      bannerWidth: sc.bannerWidth,
      bannerHeight: sc.bannerHeight,
      // In ROTATING mode, also return all ads so the client can rotate without re-fetching
      ads: sc.mode === 'ROTATING'
        ? sc.ads.map(a => ({
            id: a.id,
            title: a.title,
            subtitle: a.subtitle,
            logoUrl: a.logoUrl,
            imageUrl: a.imageUrl,
            videoUrl: a.videoUrl,
            linkUrl: a.linkUrl || (sc.landingPage ? `/empresa/${sc.landingPage.slug}` : null),
            ctaText: a.ctaText,
          }))
        : [{
            id: chosenAd.id,
            title: chosenAd.title,
            subtitle: chosenAd.subtitle,
            logoUrl: chosenAd.logoUrl,
            imageUrl: chosenAd.imageUrl,
            videoUrl: chosenAd.videoUrl,
            linkUrl: chosenAd.linkUrl || (sc.landingPage ? `/empresa/${sc.landingPage.slug}` : null),
            ctaText: chosenAd.ctaText,
          }],
      landingPageSlug: sc.landingPage?.slug || null,
    })
  } catch (e: any) {
    console.error('[SponsoredCategory] serve error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
