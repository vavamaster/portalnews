import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getUserActivePlan } from '@/lib/plans'

function toPublicListing(listing: any, includeDocument = false) {
  const { document, plan, ...rest } = listing
  const {
    asaasPlanId: _asaasPlanId,
    mercadoPagoPlanId: _mercadoPagoPlanId,
    stripePriceId: _stripePriceId,
    ...publicPlan
  } = plan || {}
  return { ...rest, document: includeDocument ? document : null, plan: publicPlan }
}

// GET /api/classifieds
// Query params:
//   slug=...               - single listing by slug
//   search=...             - free-text search on title/description
//   category=slug          - filter by category slug
//   city=...               - filter by city (case-insensitive contains)
//   state=...
//   minPrice=...           - min price
//   maxPrice=...           - max price
//   personType=PF|PJ       - filter by person type
//   plan=FREE|PROFESSIONAL... - filter by plan
//   featured=true          - only featured
//   boosted=true           - only boosted
//   sort=recent|price_asc|price_desc|relevance
//   limit=...
//   offset=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const slug = url.searchParams.get('slug')

  if (slug) {
    const currentUser = await getCurrentUser(req)
    const listing = await db.classifiedListing.findUnique({
      where: { slug },
      include: {
        category: true,
        owner: { select: { id: true, name: true, avatar: true, verificationStatus: true } },
        plan: true,
        reviews: { include: { reviewer: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: 'desc' } },
        _count: { select: { reviews: true, leads: true } },
      },
    })
    if (!listing || listing.status !== 'ACTIVE' || !listing.expiresAt || listing.expiresAt <= new Date()) {
      return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
    }
    await db.classifiedListing.update({
      where: { id: listing.id },
      data: { views: { increment: 1 } },
    })
    const canSeeDocument = currentUser?.id === listing.ownerId || ['MASTER', 'ADMIN'].includes(currentUser?.role || '')
    return NextResponse.json({ listing: toPublicListing({ ...listing, views: listing.views + 1 }, canSeeDocument) })
  }

  // Build where clause — Fix #25: also filter by expiresAt to hide expired listings
  const where: any = {
    status: 'ACTIVE',
    expiresAt: { gt: new Date() }, // don't show listings past their expiry
  }
  const search = url.searchParams.get('search')?.trim().slice(0, 120)
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ]
  }
  const categorySlug = url.searchParams.get('category')
  if (categorySlug) {
    const cat = await db.classifiedCategory.findUnique({ where: { slug: categorySlug } })
    if (!cat) return NextResponse.json({ listings: [], total: 0, limit: 20, offset: 0 })
    where.categoryId = cat.id
  }
  const city = url.searchParams.get('city')
  if (city) where.city = { contains: city }
  const state = url.searchParams.get('state')
  if (state) where.state = state
  const personType = url.searchParams.get('personType')
  if (personType && !['PF', 'PJ'].includes(personType)) {
    return NextResponse.json({ error: 'Tipo de pessoa inválido' }, { status: 400 })
  }
  if (personType) where.personType = personType

  const minPrice = url.searchParams.get('minPrice')
  const maxPrice = url.searchParams.get('maxPrice')
  if (minPrice || maxPrice) {
    where.price = {}
    const parsedMin = minPrice ? Number(minPrice) : undefined
    const parsedMax = maxPrice ? Number(maxPrice) : undefined
    if ((parsedMin !== undefined && (!Number.isFinite(parsedMin) || parsedMin < 0))
      || (parsedMax !== undefined && (!Number.isFinite(parsedMax) || parsedMax < 0))
      || (parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax)) {
      return NextResponse.json({ error: 'Faixa de preço inválida' }, { status: 400 })
    }
    if (parsedMin !== undefined) where.price.gte = parsedMin
    if (parsedMax !== undefined) where.price.lte = parsedMax
  }

  const planSlug = url.searchParams.get('plan')
  if (planSlug) {
    const plan = await db.plan.findUnique({ where: { slug: planSlug } })
    if (!plan) return NextResponse.json({ listings: [], total: 0, limit: 20, offset: 0 })
    where.planId = plan.id
  }

  if (url.searchParams.get('featured') === 'true') {
    where.featured = true
    where.featuredUntil = { gte: new Date() }
  }
  if (url.searchParams.get('boosted') === 'true') {
    where.boosted = true
    where.boostedUntil = { gte: new Date() }
  }

  const requestedSort = url.searchParams.get('sort') || 'relevance'
  const sort = ['recent', 'price_asc', 'price_desc', 'relevance'].includes(requestedSort) ? requestedSort : 'relevance'
  let orderBy: any[] = []
  // Always show featured+boosted first
  orderBy.push({ featured: 'desc' })
  orderBy.push({ boosted: 'desc' })
  if (sort === 'recent') {
    orderBy.push({ publishedAt: 'desc' })
  } else if (sort === 'price_asc') {
    orderBy.push({ price: 'asc' })
  } else if (sort === 'price_desc') {
    orderBy.push({ price: 'desc' })
  } else {
    // relevance = views desc
    orderBy.push({ views: 'desc' })
  }

  const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '20', 10)
  const requestedOffset = Number.parseInt(url.searchParams.get('offset') || '0', 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20
  const offset = Number.isFinite(requestedOffset) ? Math.min(Math.max(requestedOffset, 0), 10_000) : 0

  const [listings, total] = await Promise.all([
    db.classifiedListing.findMany({
      where,
      include: {
        category: true,
        owner: { select: { id: true, name: true, avatar: true, verificationStatus: true } },
        plan: true,
        _count: { select: { reviews: true } },
      },
      orderBy,
      take: limit,
      skip: offset,
    }),
    db.classifiedListing.count({ where }),
  ])

  return NextResponse.json({ listings: listings.map(listing => toPublicListing(listing)), total, limit, offset })
}

// POST - create new classified listing
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login para anunciar' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    const { title, description, price, isNegotiable, categoryId, personType, document,
      businessName, phone, whatsapp, email, website, address, city, state, zipCode,
      latitude, longitude, photos, logoUrl, services, usePoints } = body

    if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 160
      || typeof description !== 'string' || description.trim().length < 20 || description.trim().length > 10_000
      || typeof categoryId !== 'string' || !['PF', 'PJ'].includes(personType)) {
      return NextResponse.json({ error: 'Título, descrição, categoria e tipo de pessoa são obrigatórios' }, { status: 400 })
    }

    const category = await db.classifiedCategory.findUnique({ where: { id: categoryId } })
    if (!category) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 400 })

    const parsedPrice = price === null || price === undefined || price === '' ? null : Number(price)
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice >= 1_000_000_000)) {
      return NextResponse.json({ error: 'Preço inválido' }, { status: 400 })
    }

    // Get user's active subscription
    const subscription = await getUserActivePlan(user.id, db)
    if (!subscription) {
      return NextResponse.json({ error: 'Você precisa de um plano ativo para anunciar. Escolha um plano.' }, { status: 403 })
    }
    const plan = subscription.plan
    const { getPlanConfig } = await import('@/lib/plans')
    const planConfig = getPlanConfig(plan.slug)
    if (planConfig && planConfig.personType !== 'BOTH' && planConfig.personType !== personType) {
      return NextResponse.json({ error: `O plano ${plan.name} aceita apenas anúncios ${planConfig.personType}.` }, { status: 400 })
    }

    // Check if user can publish based on plan limits
    const activeListingsCount = await db.classifiedListing.count({
      where: { ownerId: user.id, status: { in: ['ACTIVE', 'PENDING'] } },
    })
    const maxListings = plan.maxListings === -1 ? Infinity : plan.maxListings
    const isExtraListing = activeListingsCount >= maxListings

    // If extra listing and plan allows points - charge points
    let pointsToCharge = 0
    if (isExtraListing) {
      if (!plan.allowPoints || plan.pointsPerListing <= 0) {
        return NextResponse.json({
          error: `Você atingiu o limite de ${maxListings} anúncio(s) do plano ${plan.name}. Faça upgrade para publicar mais.`,
        }, { status: 403 })
      }
      if (!usePoints) {
        return NextResponse.json({
          error: `Limite atingido. Use ${plan.pointsPerListing} pontos para publicar um anúncio extra.`,
          needPoints: true,
          pointsCost: plan.pointsPerListing,
          userPoints: user.points,
        }, { status: 402 })
      }
      if (user.points < plan.pointsPerListing) {
        return NextResponse.json({
          error: `Pontos insuficientes. Você precisa de ${plan.pointsPerListing} pontos, tem ${user.points}.`,
        }, { status: 403 })
      }
      pointsToCharge = plan.pointsPerListing
    }

    // Validate plan features
    if (photos && Array.isArray(photos) && plan.maxPhotosPerListing !== -1 && photos.length > plan.maxPhotosPerListing) {
      return NextResponse.json({ error: `Seu plano permite no máximo ${plan.maxPhotosPerListing} fotos` }, { status: 400 })
    }
    if (services && Array.isArray(services) && plan.maxServicesPerListing !== -1 && services.length > plan.maxServicesPerListing) {
      return NextResponse.json({ error: `Seu plano permite no máximo ${plan.maxServicesPerListing} serviços/produtos` }, { status: 400 })
    }
    // === Strip contact info that plan doesn't allow (consolidated via lib/classifieds.ts) ===
    const { sanitizeListingByPlan } = await import('@/lib/classifieds')
    const sanitized = sanitizeListingByPlan(plan, {
      phone, whatsapp, email, website, logoUrl, address, latitude, longitude, services, photos,
    })

    // === Generate slug ===
    const { slugify, uniqueSlug: genUniqueSlug } = await import('@/lib/utils')
    const baseSlug = slugify(title)
    const finalSlug = await genUniqueSlug(baseSlug, async (s) => !!(await db.classifiedListing.findUnique({ where: { slug: s } })))

    // Use transaction for atomic creation + points debit
    const listing = await db.$transaction(async (tx) => {
      const created = await tx.classifiedListing.create({
        data: {
          slug: finalSlug,
          title: title.trim(), description: description.trim(),
          price: parsedPrice,
          isNegotiable: !!isNegotiable,
          categoryId,
          ownerId: user.id,
          planId: plan.id,
          personType,
          document: document || null,
          businessName: businessName || null,
          phone: sanitized.phone,
          whatsapp: sanitized.whatsapp,
          email: sanitized.email,
          website: sanitized.website,
          address: sanitized.address,
          city: typeof city === 'string' ? city.trim().slice(0, 120) || null : null,
          state: typeof state === 'string' ? state.trim().slice(0, 2).toUpperCase() || null : null,
          zipCode: typeof zipCode === 'string' ? zipCode.trim().slice(0, 12) || null : null,
          latitude: sanitized.latitude,
          longitude: sanitized.longitude,
          photos: sanitized.photos && sanitized.photos.length > 0 ? JSON.stringify(sanitized.photos) : null,
          logoUrl: sanitized.logoUrl,
          services: sanitized.services,
          status: 'PENDING',
          publishedAt: null,
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          featured: plan.allowFeatured && plan.slug === 'PREMIUM', // premium gets auto-featured
          featuredUntil: plan.allowFeatured && plan.slug === 'PREMIUM' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        },
        include: { category: true, plan: true },
      })

      // Charge points if extra listing
      if (pointsToCharge > 0) {
        const debit = await tx.user.updateMany({
          where: { id: user.id, points: { gte: pointsToCharge } },
          data: { points: { decrement: pointsToCharge } },
        })
        if (debit.count !== 1) throw new Error('Pontos insuficientes')
        await tx.pointTransaction.create({
          data: {
            userId: user.id,
            amount: -pointsToCharge,
            reason: 'CLASSIFIED_EXTRA_LISTING',
            postId: created.id,
          },
        })
      }
      // increment subscription usage
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { listingsUsedThisCycle: { increment: 1 } },
      })

      // Notify user
      await tx.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: 'Anúncio enviado para moderação',
          message: `"${title.trim()}" será publicado após a aprovação da administração.`,
          link: 'advertiser',
        },
      })

      return created
    })

    // After successful creation, check referral bonus + achievements (outside transaction)
    try {
      const { checkReferralBonus, autoCheckAchievements } = await import('@/lib/achievements')
      await checkReferralBonus(user.id)
      await autoCheckAchievements(user.id)
    } catch (e) {
      // don't fail the listing creation if achievement check fails
      console.error('Achievement check failed:', e)
    }

    return NextResponse.json({ listing, pointsCharged: pointsToCharge })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
