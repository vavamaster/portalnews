import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/sponsored-categories
// Returns all categories with their sponsor config (or empty if not configured).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const categories = await db.category.findMany({
    orderBy: { order: 'asc' },
    include: {
      sponsoredCategory: {
        include: {
          ads: { select: { id: true, title: true, status: true, ownerId: true, owner: { select: { name: true } } } },
          landingPage: { select: { id: true, companyName: true, slug: true } },
          _count: { select: { billingCycles: true } },
        },
      },
    },
  })

  // Compute current status for each sponsor
  const result = await Promise.all(categories.map(async (c) => {
    const sc = c.sponsoredCategory
    let activeCycle: any = null
    if (sc) {
      activeCycle = await db.enterpriseBillingCycle.findFirst({
        where: { sponsoredCategoryId: sc.id, status: 'ACTIVE' },
        orderBy: { endAt: 'desc' },
      })
    }
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      color: c.color,
      icon: c.icon,
      postCount: await db.post.count({ where: { categoryId: c.id, status: 'PUBLISHED' } }),
      sponsor: sc ? {
        id: sc.id,
        mode: sc.mode,
        billingType: sc.billingType,
        billingValueCents: sc.billingValueCents,
        billingImpressions: sc.billingImpressions,
        maxRotatingAds: sc.maxRotatingAds,
        transitionType: sc.transitionType,
        transitionMs: sc.transitionMs,
        bannerWidth: sc.bannerWidth,
        bannerHeight: sc.bannerHeight,
        commercialContactName: sc.commercialContactName,
        commercialContactEmail: sc.commercialContactEmail,
        commercialContactPhone: sc.commercialContactPhone,
        isActive: sc.isActive,
        ads: sc.ads,
        landingPage: sc.landingPage,
        hasActiveCycle: Boolean(activeCycle),
        activeCycle: activeCycle ? {
          id: activeCycle.id,
          status: activeCycle.status,
          type: activeCycle.type,
          endAt: activeCycle.endAt,
          impressionsUsed: activeCycle.impressionsUsed,
        } : null,
        billingCyclesCount: sc._count.billingCycles,
      } : null,
    }
  }))

  return NextResponse.json({ categories: result })
}

// POST /api/admin/sponsored-categories
// Body: { categoryId, mode, billingType, billingValueCents, billingImpressions, maxRotatingAds, transitionType, transitionMs, commercialContactName, commercialContactEmail, commercialContactPhone, bannerWidth, bannerHeight }
// Creates or updates a sponsored category config.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const {
    categoryId, mode, billingType, billingValueCents, billingImpressions,
    maxRotatingAds, transitionType, transitionMs, commercialContactName,
    commercialContactEmail, commercialContactPhone, bannerWidth, bannerHeight,
  } = body

  if (!categoryId) return NextResponse.json({ error: 'categoryId é obrigatório' }, { status: 400 })

  // Validate transition time
  const tMs = parseInt(transitionMs, 10)
  if (isNaN(tMs) || tMs < 3000 || tMs > 10000) {
    return NextResponse.json({ error: 'tempo de transição deve ser entre 3000 e 10000ms' }, { status: 400 })
  }

  // EXCLUSIVE mode enforces maxRotatingAds = 1
  const finalMaxRotatingAds = mode === 'EXCLUSIVE' ? 1 : Math.min(Math.max(parseInt(maxRotatingAds, 10) || 3, 1), 5)

  const sc = await db.sponsoredCategory.upsert({
    where: { categoryId },
    update: {
      mode,
      billingType,
      billingValueCents: parseInt(billingValueCents, 10) || 0,
      billingImpressions: parseInt(billingImpressions, 10) || 0,
      maxRotatingAds: finalMaxRotatingAds,
      transitionType,
      transitionMs: tMs,
      commercialContactName: commercialContactName || null,
      commercialContactEmail: commercialContactEmail || null,
      commercialContactPhone: commercialContactPhone || null,
      bannerWidth: parseInt(bannerWidth, 10) || 1200,
      bannerHeight: parseInt(bannerHeight, 10) || 200,
    },
    create: {
      categoryId,
      mode,
      billingType,
      billingValueCents: parseInt(billingValueCents, 10) || 0,
      billingImpressions: parseInt(billingImpressions, 10) || 0,
      maxRotatingAds: finalMaxRotatingAds,
      transitionType,
      transitionMs: tMs,
      commercialContactName: commercialContactName || null,
      commercialContactEmail: commercialContactEmail || null,
      commercialContactPhone: commercialContactPhone || null,
      bannerWidth: parseInt(bannerWidth, 10) || 1200,
      bannerHeight: parseInt(bannerHeight, 10) || 200,
    },
  })

  return NextResponse.json({ ok: true, sponsor: sc })
}
