import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isEnterpriseCycleEligible } from '@/lib/enterprise'

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
      _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
      sponsoredCategory: {
        include: {
          ads: { select: { id: true, title: true, status: true, ownerId: true, owner: { select: { name: true } } } },
          landingPage: { select: { id: true, companyName: true, slug: true } },
          _count: { select: { billingCycles: true } },
        },
      },
    },
  })

  const sponsorIds = categories.flatMap(category => category.sponsoredCategory ? [category.sponsoredCategory.id] : [])
  const activeCycles = sponsorIds.length === 0 ? [] : await db.enterpriseBillingCycle.findMany({
    where: { sponsoredCategoryId: { in: sponsorIds }, status: 'ACTIVE' },
    orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
  })
  const activeCycleBySponsor = new Map<string, typeof activeCycles[number]>()
  for (const cycle of activeCycles) {
    if (isEnterpriseCycleEligible(cycle) && !activeCycleBySponsor.has(cycle.sponsoredCategoryId)) {
      activeCycleBySponsor.set(cycle.sponsoredCategoryId, cycle)
    }
  }

  // Compute current status for each sponsor without per-category queries.
  const result = categories.map((c) => {
    const sc = c.sponsoredCategory
    const activeCycle = sc ? activeCycleBySponsor.get(sc.id) || null : null
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      color: c.color,
      icon: c.icon,
      postCount: c._count.posts,
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
  })

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

  const category = await db.category.findUnique({ where: { id: categoryId }, select: { id: true } })
  if (!category) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
  const finalMode = mode || 'ROTATING'
  const finalBillingType = billingType || 'MONTHLY'
  const finalTransitionType = transitionType || 'FADE'
  if (!['EXCLUSIVE', 'ROTATING', 'DISABLED'].includes(finalMode)) {
    return NextResponse.json({ error: 'Modo de patrocínio inválido' }, { status: 400 })
  }
  if (!['MONTHLY', 'IMPRESSIONS'].includes(finalBillingType)) {
    return NextResponse.json({ error: 'Tipo de cobrança inválido' }, { status: 400 })
  }
  if (!['FADE', 'SLIDE', 'NONE'].includes(finalTransitionType)) {
    return NextResponse.json({ error: 'Tipo de transição inválido' }, { status: 400 })
  }

  const valueCents = Number(billingValueCents ?? 0)
  const impressionBudget = Number(billingImpressions ?? 0)
  const width = Number(bannerWidth ?? 1200)
  const height = Number(bannerHeight ?? 200)
  if (!Number.isInteger(valueCents) || valueCents < 0) {
    return NextResponse.json({ error: 'Valor da cobrança inválido' }, { status: 400 })
  }
  if (finalBillingType === 'IMPRESSIONS' && (!Number.isInteger(impressionBudget) || impressionBudget <= 0)) {
    return NextResponse.json({ error: 'Informe uma quantidade de impressões maior que zero' }, { status: 400 })
  }
  if (!Number.isInteger(width) || width < 100 || width > 4000 || !Number.isInteger(height) || height < 50 || height > 2000) {
    return NextResponse.json({ error: 'Dimensões do banner inválidas' }, { status: 400 })
  }
  const contact = (value: unknown, max: number) => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value !== 'string' || value.trim().length > max) throw new Error('Contato comercial inválido')
    return value.trim() || null
  }
  let contactName: string | null
  let contactEmail: string | null
  let contactPhone: string | null
  try {
    contactName = contact(commercialContactName, 160)
    contactEmail = contact(commercialContactEmail, 254)
    contactPhone = contact(commercialContactPhone, 40)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: 'Email comercial inválido' }, { status: 400 })
  }

  // Validate transition time
  const tMs = Number(transitionMs ?? 5000)
  if (isNaN(tMs) || tMs < 3000 || tMs > 10000) {
    return NextResponse.json({ error: 'tempo de transição deve ser entre 3000 e 10000ms' }, { status: 400 })
  }

  // EXCLUSIVE mode enforces maxRotatingAds = 1
  const finalMaxRotatingAds = finalMode === 'EXCLUSIVE' ? 1 : Math.min(Math.max(parseInt(maxRotatingAds, 10) || 3, 1), 5)

  const sc = await db.sponsoredCategory.upsert({
    where: { categoryId },
    update: {
      mode: finalMode,
      billingType: finalBillingType,
      billingValueCents: valueCents,
      billingImpressions: finalBillingType === 'IMPRESSIONS' ? impressionBudget : 0,
      maxRotatingAds: finalMaxRotatingAds,
      transitionType: finalTransitionType,
      transitionMs: tMs,
      commercialContactName: contactName,
      commercialContactEmail: contactEmail,
      commercialContactPhone: contactPhone,
      bannerWidth: width,
      bannerHeight: height,
      isActive: finalMode !== 'DISABLED',
    },
    create: {
      categoryId,
      mode: finalMode,
      billingType: finalBillingType,
      billingValueCents: valueCents,
      billingImpressions: finalBillingType === 'IMPRESSIONS' ? impressionBudget : 0,
      maxRotatingAds: finalMaxRotatingAds,
      transitionType: finalTransitionType,
      transitionMs: tMs,
      commercialContactName: contactName,
      commercialContactEmail: contactEmail,
      commercialContactPhone: contactPhone,
      bannerWidth: width,
      bannerHeight: height,
      isActive: finalMode !== 'DISABLED',
    },
  })

  return NextResponse.json({ ok: true, sponsor: sc })
}
