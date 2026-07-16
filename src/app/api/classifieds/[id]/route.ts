import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isStatusTransitionAllowed, normalizeClassifiedMediaUrl, normalizeExternalUrl } from '@/lib/classifieds'
import { getUserActivePlan } from '@/lib/plans'

function withoutPrivatePlanIds(plan: any) {
  if (!plan) return plan
  const publicPlan = { ...plan }
  delete publicPlan.asaasPlanId
  delete publicPlan.mercadoPagoPlanId
  delete publicPlan.stripePriceId
  return publicPlan
}

// GET /api/classifieds/[id] - return single listing by ID (any status if owner/admin)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await db.classifiedListing.findUnique({
    where: { id },
    include: {
      category: true,
      owner: { select: { id: true, name: true, avatar: true, verificationStatus: true } },
      plan: true,
      reviews: { include: { reviewer: { select: { id: true, name: true, avatar: true } } } },
    },
  })
  if (!listing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const currentUser = await getCurrentUser(req)
  const isOwner = currentUser?.id === listing.ownerId
  const isAdmin = currentUser && ['MASTER', 'ADMIN'].includes(currentUser.role)
  const publiclyAvailable = listing.status === 'ACTIVE' && !!listing.expiresAt && listing.expiresAt > new Date()
  if (!publiclyAvailable) {
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }
  }
  return NextResponse.json({
    listing: {
      ...listing,
      document: isOwner || isAdmin ? listing.document : null,
      plan: withoutPrivatePlanIds(listing.plan),
    },
  })
}

// PUT /api/classifieds/[id] - update listing (owner or admin)
// Owner can: edit fields, pause/resume, mark as sold, delete
// Admin can: do all of the above
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const existing = await db.classifiedListing.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const isOwner = existing.ownerId === user.id
  const isAdmin = ['MASTER', 'ADMIN'].includes(user.role)
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  // === Status transition validation ===
  // Owner can: ACTIVE<->PAUSED, ACTIVE->SOLD, PAUSED->SOLD, SOLD->ACTIVE
  // Admin can do anything
  if (body.status && body.status !== existing.status) {
    if (!isStatusTransitionAllowed(existing.status, body.status, isAdmin)) {
      return NextResponse.json({
        error: `Transição de status inválida: ${existing.status} → ${body.status}.`,
      }, { status: 400 })
    }
  }

  // Load plan to enforce feature compliance
  const plan = await db.plan.findUnique({ where: { id: existing.planId } })
  if (plan) {
    // Re-validate plan limits on edit (photos / services)
    if (body.photos && Array.isArray(body.photos)) {
      const validPhotos = body.photos
        .map((p: any) => normalizeClassifiedMediaUrl(p))
        .filter((p: string | null): p is string => !!p)
      if (plan.maxPhotosPerListing !== -1 && validPhotos.length > plan.maxPhotosPerListing) {
        return NextResponse.json({
          error: `Seu plano permite no máximo ${plan.maxPhotosPerListing} fotos`,
        }, { status: 400 })
      }
      body.photos = validPhotos
    }
    if (body.services !== undefined && !Array.isArray(body.services)) {
      return NextResponse.json({ error: 'Serviços devem ser enviados como uma lista' }, { status: 400 })
    }
    if (body.services && plan.maxServicesPerListing !== -1 && body.services.length > plan.maxServicesPerListing) {
      return NextResponse.json({
        error: `Seu plano permite no máximo ${plan.maxServicesPerListing} serviços/produtos`,
      }, { status: 400 })
    }
  }

  // Whitelist editable fields. Bug fix: was 'categorySlug' (wrong field), now 'categoryId'.
  const allowedFields = [
    'title', 'description', 'price', 'isNegotiable',
    'phone', 'whatsapp', 'email', 'website', 'logoUrl',
    'latitude', 'longitude', 'address', 'city', 'state', 'zipCode',
    'photos', 'services', 'categoryId', 'personType', 'document', 'businessName',
    'status', // for pause/resume/sold transitions (validated above)
  ]
  const updateData: any = {}
  for (const f of allowedFields) {
    if (body[f] !== undefined) updateData[f] = body[f]
  }

  if (updateData.title !== undefined) {
    if (typeof updateData.title !== 'string' || updateData.title.trim().length < 3 || updateData.title.trim().length > 160) {
      return NextResponse.json({ error: 'Título deve ter entre 3 e 160 caracteres' }, { status: 400 })
    }
    updateData.title = updateData.title.trim()
  }
  if (updateData.description !== undefined) {
    if (typeof updateData.description !== 'string' || updateData.description.trim().length < 20 || updateData.description.trim().length > 10_000) {
      return NextResponse.json({ error: 'Descrição deve ter entre 20 e 10000 caracteres' }, { status: 400 })
    }
    updateData.description = updateData.description.trim()
  }

  // Validate categoryId if provided
  if (updateData.categoryId !== undefined) {
    const cat = await db.classifiedCategory.findUnique({ where: { id: updateData.categoryId } })
    if (!cat) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 400 })
    }
  }

  // Validate personType if provided
  if (updateData.personType !== undefined && !['PF', 'PJ'].includes(updateData.personType)) {
    return NextResponse.json({ error: 'Tipo de pessoa inválido' }, { status: 400 })
  }

  // Validate email if provided
  if (updateData.email !== undefined && updateData.email !== null && updateData.email !== '') {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(updateData.email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
  }

  // Validate price if provided
  if (updateData.price !== undefined && updateData.price !== null && updateData.price !== '') {
    const n = typeof updateData.price === 'number' ? updateData.price : parseFloat(String(updateData.price))
    if (isNaN(n) || n < 0 || n >= 1000000000) {
      return NextResponse.json({ error: 'Preço inválido' }, { status: 400 })
    }
    updateData.price = n
  }

  // Normalize URLs
  if ('website' in updateData) updateData.website = normalizeExternalUrl(updateData.website)
  if ('logoUrl' in updateData) updateData.logoUrl = normalizeClassifiedMediaUrl(updateData.logoUrl)

  // Strip contact info the plan doesn't allow (re-enforce on edit)
  if (plan) {
    if (!plan.allowPhone) updateData.phone = null
    if (!plan.allowWhatsApp) updateData.whatsapp = null
    if (!plan.allowEmail) { updateData.email = null; updateData.website = null }
    if (!plan.allowLogo) updateData.logoUrl = null
    if (!plan.allowMap) { updateData.latitude = null; updateData.longitude = null; updateData.address = null }
    if (!plan.allowServices) updateData.services = null
  }

  // Serialize arrays
  if (updateData.photos !== undefined) {
    updateData.photos = Array.isArray(updateData.photos) ? JSON.stringify(updateData.photos) : updateData.photos
  }
  if (updateData.services !== undefined) {
    updateData.services = JSON.stringify(updateData.services
      .filter((item: any) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item: any) => ({
        name: typeof item.name === 'string' ? item.name.trim().slice(0, 120) : '',
        price: Number.isFinite(Number(item.price)) && Number(item.price) >= 0 ? Math.min(Number(item.price), 999_999_999) : 0,
        description: typeof item.description === 'string' ? item.description.trim().slice(0, 1000) : '',
        photo: normalizeClassifiedMediaUrl(item.photo) || '',
      }))
      .filter((item: any) => item.name))
  }

  // If transitioning to SOLD, no extra fields needed
  // If transitioning from SOLD back to ACTIVE, reactivate
  if (updateData.status === 'ACTIVE') {
    const subscription = await getUserActivePlan(existing.ownerId, db)
    if (!subscription) return NextResponse.json({ error: 'Você precisa de um plano ativo para reativar o anúncio' }, { status: 403 })
    const activeCount = await db.classifiedListing.count({
      where: { ownerId: existing.ownerId, id: { not: id }, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    })
    if (subscription.plan.maxListings !== -1 && activeCount >= subscription.plan.maxListings) {
      return NextResponse.json({ error: `Limite de ${subscription.plan.maxListings} anúncio(s) atingido` }, { status: 403 })
    }
    if (!existing.expiresAt || existing.expiresAt <= new Date()) {
      return NextResponse.json({ error: 'Anúncio expirado. Renove-o antes de reativar.' }, { status: 400 })
    }
  }

  if (updateData.status === 'PAUSED' && isOwner) updateData.pausedBySubscription = false
  if (updateData.status === 'ACTIVE') updateData.pausedBySubscription = false

  const listing = await db.classifiedListing.update({
    where: { id },
    data: updateData,
    include: { category: true, plan: true },
  })

  // Notify owner on status change (if admin changed it)
  if (updateData.status && updateData.status !== existing.status && !isOwner) {
    const statusLabels: Record<string, string> = {
      ACTIVE: 'ativado', PAUSED: 'pausado', REJECTED: 'rejeitado',
      EXPIRED: 'expirado', SOLD: 'marcado como vendido', PENDING: 'colocado em moderação',
    }
    await db.notification.create({
      data: {
        userId: existing.ownerId,
        type: 'SYSTEM',
        title: `Anúncio ${statusLabels[updateData.status] || updateData.status}`,
        message: `Seu anúncio "${existing.title}" foi ${statusLabels[updateData.status] || updateData.status}.`,
        link: 'advertiser',
      },
    })
  }

  return NextResponse.json({ listing })
}

// DELETE /api/classifieds/[id] - hard delete (owner or admin)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const existing = await db.classifiedListing.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const isOwner = existing.ownerId === user.id
  const isAdmin = ['MASTER', 'ADMIN'].includes(user.role)
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  const subscription = await db.subscription.findFirst({
    where: { userId: existing.ownerId, planId: existing.planId },
    orderBy: { createdAt: 'desc' },
  })
  await db.$transaction([
    db.classifiedListing.delete({ where: { id } }),
    ...(subscription && subscription.listingsUsedThisCycle > 0 ? [
      db.subscription.update({
        where: { id: subscription.id },
        data: { listingsUsedThisCycle: { decrement: 1 } },
      }),
    ] : []),
  ])
  return NextResponse.json({ ok: true })
}
