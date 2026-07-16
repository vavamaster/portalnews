import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond } from '@/lib/api-helpers'
import { isStatusTransitionAllowed } from '@/lib/classifieds'

// PUT /api/admin/classifieds/[id] — moderate a listing (status change, feature, boost)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response

  const body = await req.json()
  const allowedFields = ['status', 'featured', 'boosted', 'boostedUntil', 'featuredUntil', 'expiresAt']
  const updateData: any = {}
  for (const f of allowedFields) {
    if (f in body) updateData[f] = body[f]
  }

  // If status is being changed to REJECTED without reason, allow (admin override)
  // Notify owner on status change
  const existing = await db.classifiedListing.findUnique({ where: { id }, include: { owner: true } })
  if (!existing) {
    return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
  }

  if (updateData.status !== undefined) {
    if (typeof updateData.status !== 'string' || !isStatusTransitionAllowed(existing.status, updateData.status, true)) {
      return NextResponse.json({ error: `Transição de status inválida: ${existing.status} → ${String(updateData.status)}` }, { status: 400 })
    }
    if (updateData.status === 'ACTIVE') {
      const activeSub = await db.subscription.findFirst({
        where: { userId: existing.ownerId, status: 'ACTIVE', currentPeriodEnd: { gte: new Date() } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      })
      if (!activeSub) return NextResponse.json({ error: 'O anunciante não possui assinatura ativa' }, { status: 400 })
      const activeCount = await db.classifiedListing.count({
        where: { ownerId: existing.ownerId, id: { not: id }, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      })
      if (activeSub.plan.maxListings !== -1 && activeCount >= activeSub.plan.maxListings) {
        return NextResponse.json({ error: `O plano permite no máximo ${activeSub.plan.maxListings} anúncio(s) ativo(s)` }, { status: 400 })
      }
      updateData.planId = activeSub.planId
      updateData.publishedAt = existing.publishedAt || new Date()
      if (!existing.expiresAt || existing.expiresAt <= new Date()) {
        updateData.expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      }
      updateData.pausedBySubscription = false
    } else if (updateData.status === 'PAUSED') {
      updateData.pausedBySubscription = false
    }
  }
  for (const field of ['featured', 'boosted']) {
    if (updateData[field] !== undefined && typeof updateData[field] !== 'boolean') {
      return NextResponse.json({ error: `${field} deve ser booleano` }, { status: 400 })
    }
  }
  if (updateData.featured === true || updateData.boosted === true) {
    const activeSub = await db.subscription.findFirst({
      where: { userId: existing.ownerId, status: 'ACTIVE', currentPeriodEnd: { gte: new Date() } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })
    if (updateData.featured === true && !activeSub?.plan.allowFeatured) {
      return NextResponse.json({ error: 'O plano do anunciante não permite destaque' }, { status: 400 })
    }
    if (updateData.boosted === true && !activeSub?.plan.allowBoost) {
      return NextResponse.json({ error: 'O plano do anunciante não permite boost' }, { status: 400 })
    }
  }
  for (const field of ['boostedUntil', 'featuredUntil', 'expiresAt']) {
    if (updateData[field] !== undefined && updateData[field] !== null) {
      const parsed = new Date(updateData[field])
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: `Data inválida em ${field}` }, { status: 400 })
      updateData[field] = parsed
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.classifiedListing.update({
      where: { id },
      data: updateData,
      include: { category: true, plan: true, owner: { select: { id: true, name: true, email: true } } },
    })

    // Notify owner if status changed
    if (updateData.status && updateData.status !== existing.status) {
      const statusLabels: Record<string, string> = {
        ACTIVE: 'ativado',
        PAUSED: 'pausado',
        REJECTED: 'rejeitado',
        EXPIRED: 'expirado',
        SOLD: 'marcado como vendido',
        PENDING: 'colocado em moderação',
      }
      await tx.notification.create({
        data: {
          userId: existing.ownerId,
          type: 'SYSTEM',
          title: `Anúncio ${statusLabels[updateData.status] || updateData.status}`,
          message: `Seu anúncio "${existing.title}" foi ${statusLabels[updateData.status] || updateData.status} pela administração.`,
          link: 'advertiser',
        },
      })
    }

    return u
  })

  return NextResponse.json({ listing: updated })
}

// DELETE /api/admin/classifieds/[id] — hard delete a listing (admin)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response

  const existing = await db.classifiedListing.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
  }

  const subscription = await db.subscription.findFirst({
    where: { userId: existing.ownerId, planId: existing.planId },
    orderBy: { createdAt: 'desc' },
  })
  await db.$transaction([
    db.classifiedListing.delete({ where: { id } }),
    ...(subscription && subscription.listingsUsedThisCycle > 0 ? [
      db.subscription.update({ where: { id: subscription.id }, data: { listingsUsedThisCycle: { decrement: 1 } } }),
    ] : []),
    db.notification.create({
      data: {
        userId: existing.ownerId,
        type: 'SYSTEM',
        title: 'Anúncio removido pela administração',
        message: `Seu anúncio "${existing.title}" foi removido pela administração do portal.`,
        link: 'advertiser',
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
