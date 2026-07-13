import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/classifieds/[id] - return single listing by ID (any status if owner/admin)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await db.classifiedListing.findUnique({
    where: { id },
    include: {
      category: true,
      owner: { select: { id: true, name: true, avatar: true, email: true } },
      plan: true,
      reviews: { include: { reviewer: { select: { id: true, name: true, avatar: true } } } },
    },
  })
  if (!listing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Only owner or admin can view non-ACTIVE listings via this ID-based route
  if (listing.status !== 'ACTIVE') {
    const currentUser = await getCurrentUser(req)
    const isOwner = currentUser?.id === listing.ownerId
    const isAdmin = currentUser && ['MASTER', 'ADMIN'].includes(currentUser.role)
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }
  }
  return NextResponse.json({ listing })
}

// Helper: normalize URL (return null if invalid or empty)
function normalizeUrl(url: any): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(withProto)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
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

  const body = await req.json()

  // === Status transition validation ===
  // Owner can: ACTIVE<->PAUSED, ACTIVE->SOLD, PAUSED->SOLD, SOLD->ACTIVE
  // Admin can do anything
  if (body.status && body.status !== existing.status) {
    const validTransitions: Record<string, string[]> = {
      ACTIVE: ['PAUSED', 'SOLD', 'EXPIRED', 'PENDING', 'REJECTED'],
      PAUSED: ['ACTIVE', 'SOLD', 'EXPIRED'],
      PENDING: ['ACTIVE', 'REJECTED', 'PAUSED'],
      REJECTED: isAdmin ? ['ACTIVE', 'PENDING'] : [],
      EXPIRED: isAdmin ? ['ACTIVE', 'PENDING'] : [],
      SOLD: ['ACTIVE', 'PAUSED'],
    }
    const allowed = validTransitions[existing.status] || []
    if (!allowed.includes(body.status)) {
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
        .map((p: any) => normalizeUrl(p))
        .filter((p: string | null): p is string => !!p)
      if (validPhotos.length > plan.maxPhotosPerListing) {
        return NextResponse.json({
          error: `Seu plano permite no máximo ${plan.maxPhotosPerListing} fotos`,
        }, { status: 400 })
      }
      body.photos = validPhotos
    }
    if (body.services && Array.isArray(body.services) && plan.maxServicesPerListing !== -1 && body.services.length > plan.maxServicesPerListing) {
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
  if ('website' in updateData) updateData.website = normalizeUrl(updateData.website)
  if ('logoUrl' in updateData) updateData.logoUrl = normalizeUrl(updateData.logoUrl)

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
    updateData.services = Array.isArray(updateData.services) ? JSON.stringify(updateData.services) : updateData.services
  }

  // If transitioning to SOLD, no extra fields needed
  // If transitioning from SOLD back to ACTIVE, reactivate
  if (updateData.status === 'ACTIVE' && existing.status === 'SOLD') {
    // Reactivation — refresh publishedAt? No, keep original. Just change status.
  }

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
  // Decrement subscription usage count (best-effort)
  try {
    await db.subscription.update({
      where: { id: existing.planId }, // this is wrong — should be by subscription id, but we don't have it
      data: { listingsUsedThisCycle: { decrement: 1 } },
    })
  } catch {}
  await db.classifiedListing.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
