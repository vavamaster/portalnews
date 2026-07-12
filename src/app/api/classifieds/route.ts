import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getUserActivePlan } from '@/lib/plans'

// GET /api/classifieds
// Query params:
//   slug=...               - single listing by slug (owner-view: returns PAUSED/EXPIRED if owner)
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
    const listing = await db.classifiedListing.findUnique({
      where: { slug },
      include: {
        category: true,
        owner: { select: { id: true, name: true, avatar: true, email: true } },
        plan: true,
        reviews: { include: { reviewer: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: 'desc' } },
        _count: { select: { reviews: true, leads: true } },
      },
    })
    if (!listing) {
      return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
    }
    // Public can only see ACTIVE listings. Owner (or admin) can see any status.
    if (listing.status !== 'ACTIVE') {
      const currentUser = await getCurrentUser(req)
      const isOwner = currentUser?.id === listing.ownerId
      const isAdmin = currentUser && ['MASTER', 'ADMIN'].includes(currentUser.role)
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
      }
    }
    // Only increment views for ACTIVE listings viewed by non-owner
    if (listing.status === 'ACTIVE') {
      const currentUser = await getCurrentUser(req)
      const isOwner = currentUser?.id === listing.ownerId
      if (!isOwner) {
        await db.classifiedListing.update({
          where: { id: listing.id },
          data: { views: { increment: 1 } },
        })
        return NextResponse.json({ listing: { ...listing, views: listing.views + 1 } })
      }
    }
    return NextResponse.json({ listing })
  }

  // Build where clause — only ACTIVE listings with valid (or null) expiry
  const where: any = {
    status: 'ACTIVE',
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ],
  }
  const search = url.searchParams.get('search')
  if (search) {
    const q = search.toLowerCase()
    where.OR = [
      ...(where.OR || []),
      { title: { contains: q } },
      { description: { contains: q } },
      // also try original case for proper nouns
      { title: { contains: search } },
      { description: { contains: search } },
    ]
  }
  const categorySlug = url.searchParams.get('category')
  if (categorySlug) {
    const cat = await db.classifiedCategory.findUnique({ where: { slug: categorySlug } })
    if (cat) where.categoryId = cat.id
    else return NextResponse.json({ listings: [], total: 0, limit: 0, offset: 0 })
  }
  const city = url.searchParams.get('city')
  if (city) where.city = { contains: city }
  const state = url.searchParams.get('state')
  if (state) where.state = state
  const personType = url.searchParams.get('personType')
  if (personType && ['PF', 'PJ'].includes(personType)) where.personType = personType

  const minPrice = url.searchParams.get('minPrice')
  const maxPrice = url.searchParams.get('maxPrice')
  if (minPrice || maxPrice) {
    where.price = {}
    if (minPrice) {
      const n = parseFloat(minPrice)
      if (!isNaN(n)) where.price.gte = n
    }
    if (maxPrice) {
      const n = parseFloat(maxPrice)
      if (!isNaN(n)) where.price.lte = n
    }
  }

  const planSlug = url.searchParams.get('plan')
  if (planSlug) {
    const plan = await db.plan.findUnique({ where: { slug: planSlug } })
    if (plan) where.planId = plan.id
  }

  if (url.searchParams.get('featured') === 'true') {
    where.featured = true
    where.featuredUntil = { gte: new Date() }
  }
  if (url.searchParams.get('boosted') === 'true') {
    where.boosted = true
    where.boostedUntil = { gte: new Date() }
  }

  const sort = url.searchParams.get('sort') || 'relevance'
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

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0)

  const [listings, total] = await Promise.all([
    db.classifiedListing.findMany({
      where,
      include: {
        category: true,
        owner: { select: { id: true, name: true, avatar: true } },
        plan: true,
        _count: { select: { reviews: true } },
      },
      orderBy,
      take: limit,
      skip: offset,
    }),
    db.classifiedListing.count({ where }),
  ])

  return NextResponse.json({ listings, total, limit, offset })
}

// Normalize a URL: ensure protocol, return null if invalid
function normalizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  // Add protocol if missing
  const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(withProto)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

// Validate photo URLs — strip invalid entries
function normalizePhotoList(photos: any): string[] | null {
  if (!Array.isArray(photos)) return null
  return photos
    .map(p => typeof p === 'string' ? normalizeUrl(p) : null)
    .filter((p): p is string => !!p)
}

// Validate a single URL field, returning null if invalid or empty
function urlOrNull(url: any): string | null {
  if (typeof url !== 'string') return null
  return normalizeUrl(url)
}

// POST - create new classified listing
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login para anunciar' }, { status: 401 })

    const body = await req.json()
    const {
      title, description, price, isNegotiable, categoryId, personType, document,
      businessName, phone, whatsapp, email, website, address, city, state, zipCode,
      latitude, longitude, photos, logoUrl, services, usePoints,
    } = body

    // === Basic validation ===
    if (!title || typeof title !== 'string' || title.trim().length < 5) {
      return NextResponse.json({ error: 'Título é obrigatório (mínimo 5 caracteres)' }, { status: 400 })
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json({ error: 'Descrição é obrigatória (mínimo 10 caracteres)' }, { status: 400 })
    }
    if (!categoryId || typeof categoryId !== 'string') {
      return NextResponse.json({ error: 'Categoria é obrigatória' }, { status: 400 })
    }
    if (!personType || !['PF', 'PJ'].includes(personType)) {
      return NextResponse.json({ error: 'Tipo de pessoa inválido (use PF ou PJ)' }, { status: 400 })
    }

    // Validate category exists
    const categoryExists = await db.classifiedCategory.findUnique({ where: { id: categoryId } })
    if (!categoryExists) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 400 })
    }

    // Validate email format if provided
    if (email && typeof email === 'string' && email.trim()) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRe.test(email)) {
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
      }
    }

    // Get user's active subscription
    const subscription = await getUserActivePlan(user.id, db)
    if (!subscription) {
      return NextResponse.json({ error: 'Você precisa de um plano ativo para anunciar. Escolha um plano.' }, { status: 403 })
    }
    const plan = subscription.plan

    // === Business rule: personType must match plan's allowed personType ===
    // Plan config in src/lib/plans.ts declares personType: 'PF' | 'PJ' | 'BOTH'
    // The Plan DB model doesn't have this column, so we read from the in-memory config
    const { getPlanConfig } = await import('@/lib/plans')
    const planConfig = getPlanConfig(plan.slug)
    if (planConfig && planConfig.personType !== 'BOTH' && planConfig.personType !== personType) {
      return NextResponse.json({
        error: `O plano ${plan.name} é exclusivo para ${planConfig.personType === 'PF' ? 'Pessoa Física (CPF)' : 'Pessoa Jurídica (CNPJ)'}.`,
      }, { status: 400 })
    }

    // === Plan limit check (race-condition-safe via transaction) ===
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
      // Re-fetch fresh user points to avoid race
      const freshUser = await db.user.findUnique({ where: { id: user.id } })
      if (!freshUser || freshUser.points < plan.pointsPerListing) {
        return NextResponse.json({
          error: `Pontos insuficientes. Você precisa de ${plan.pointsPerListing} pontos.`,
        }, { status: 403 })
      }
      pointsToCharge = plan.pointsPerListing
    }

    // === Photo / services validation ===
    const validPhotos = normalizePhotoList(photos)
    if (validPhotos && validPhotos.length > plan.maxPhotosPerListing) {
      return NextResponse.json({ error: `Seu plano permite no máximo ${plan.maxPhotosPerListing} fotos` }, { status: 400 })
    }
    if (services && Array.isArray(services) && plan.maxServicesPerListing !== -1 && services.length > plan.maxServicesPerListing) {
      return NextResponse.json({ error: `Seu plano permite no máximo ${plan.maxServicesPerListing} serviços/produtos` }, { status: 400 })
    }

    // === Strip contact info that plan doesn't allow (server-side enforcement) ===
    const finalPhone = plan.allowPhone ? (typeof phone === 'string' ? phone.trim() || null : null) : null
    const finalWhatsapp = plan.allowWhatsApp ? (typeof whatsapp === 'string' ? whatsapp.trim() || null : null) : null
    const finalEmail = plan.allowEmail ? (typeof email === 'string' ? email.trim() || null : null) : null
    const finalWebsite = plan.allowEmail ? urlOrNull(website) : null
    const finalLogo = plan.allowLogo ? urlOrNull(logoUrl) : null
    const finalMap = plan.allowMap ? { latitude, longitude } : { latitude: null, longitude: null }
    const finalServices = plan.allowServices ? (Array.isArray(services) ? JSON.stringify(services) : null) : null
    const finalAddress = plan.allowMap ? (typeof address === 'string' ? address.trim() || null : null) : null

    // === Generate slug ===
    const baseSlug = title.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      .slice(0, 80) // cap slug length
    let uniqueSlug = baseSlug
    let i = 1
    while (await db.classifiedListing.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${i++}`
    }

    // === Validate price ===
    let finalPrice: number | null = null
    if (price !== undefined && price !== null && price !== '') {
      const n = typeof price === 'number' ? price : parseFloat(String(price))
      if (!isNaN(n) && n >= 0 && n < 1000000000) {
        finalPrice = n
      }
    }

    // === Use transaction for atomic creation + points debit ===
    const listing = await db.$transaction(async (tx) => {
      // Re-check plan limit inside transaction to prevent race
      const currentCount = await tx.classifiedListing.count({
        where: { ownerId: user.id, status: { in: ['ACTIVE', 'PENDING'] } },
      })
      const currentMax = plan.maxListings === -1 ? Infinity : plan.maxListings
      const isExtra = currentCount >= currentMax
      if (isExtra && pointsToCharge === 0 && (!plan.allowPoints || plan.pointsPerListing <= 0)) {
        throw new Error('LIMITE_ATINGIDO')
      }
      // Re-check points balance inside transaction
      if (pointsToCharge > 0) {
        const fresh = await tx.user.findUnique({ where: { id: user.id } })
        if (!fresh || fresh.points < pointsToCharge) {
          throw new Error('PONTOS_INSUFICIENTES')
        }
      }

      const created = await tx.classifiedListing.create({
        data: {
          slug: uniqueSlug,
          title: title.trim(),
          description: description.trim(),
          price: finalPrice,
          isNegotiable: !!isNegotiable,
          categoryId,
          ownerId: user.id,
          planId: plan.id,
          personType,
          document: typeof document === 'string' ? document.trim() || null : null,
          businessName: typeof businessName === 'string' ? businessName.trim() || null : null,
          phone: finalPhone,
          whatsapp: finalWhatsapp,
          email: finalEmail,
          website: finalWebsite,
          address: finalAddress,
          city: typeof city === 'string' ? city.trim() || null : null,
          state: typeof state === 'string' ? state.trim() || null : null,
          zipCode: typeof zipCode === 'string' ? zipCode.trim() || null : null,
          latitude: finalMap.latitude,
          longitude: finalMap.longitude,
          photos: validPhotos && validPhotos.length > 0 ? JSON.stringify(validPhotos) : null,
          logoUrl: finalLogo,
          services: finalServices,
          status: 'ACTIVE', // direct activation for simplicity (could be PENDING for moderation)
          publishedAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          featured: plan.allowFeatured && plan.slug === 'PREMIUM',
          featuredUntil: plan.allowFeatured && plan.slug === 'PREMIUM' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        },
        include: { category: true, plan: true },
      })

      // Charge points if extra listing (race-safe via conditional update)
      if (pointsToCharge > 0) {
        const r = await tx.user.updateMany({
          where: { id: user.id, points: { gte: pointsToCharge } },
          data: { points: { decrement: pointsToCharge } },
        })
        if (r.count === 0) throw new Error('PONTOS_INSUFICIENTES')
        await tx.pointTransaction.create({
          data: {
            userId: user.id,
            amount: -pointsToCharge,
            reason: 'CLASSIFIED_EXTRA_LISTING',
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
          title: 'Anúncio publicado!',
          message: `"${title}" está no ar no plano ${plan.name}.`,
          link: 'advertiser',
        },
      })

      return created
    }).catch((err: Error) => {
      if (err.message === 'LIMITE_ATINGIDO') {
        return { __error: 'Limite de anúncios atingido em transação concorrente. Tente novamente.' }
      }
      if (err.message === 'PONTOS_INSUFICIENTES') {
        return { __error: 'Pontos insuficientes em transação concorrente.' }
      }
      throw err
    })

    if ('__error' in listing) {
      return NextResponse.json({ error: (listing as any).__error }, { status: 403 })
    }

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
    console.error('Classified create error:', e)
    return NextResponse.json({ error: e.message || 'Erro interno ao criar anúncio' }, { status: 500 })
  }
}
