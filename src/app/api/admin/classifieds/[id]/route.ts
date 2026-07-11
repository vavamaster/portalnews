import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// PUT /api/admin/classifieds/[id] — moderate a listing (status change, feature, boost)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

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
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const existing = await db.classifiedListing.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
  }

  await db.classifiedListing.delete({ where: { id } })

  // Notify owner
  await db.notification.create({
    data: {
      userId: existing.ownerId,
      type: 'SYSTEM',
      title: 'Anúncio removido pela administração',
      message: `Seu anúncio "${existing.title}" foi removido pela administração do portal.`,
      link: 'advertiser',
    },
  })

  return NextResponse.json({ ok: true })
}
