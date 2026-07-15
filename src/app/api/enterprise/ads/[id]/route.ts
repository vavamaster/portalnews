import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { findServingEnterpriseCycle, parseEnterpriseAdInput } from '@/lib/enterprise'

// PATCH /api/enterprise/ads/[id]
// Enterprise user edits their own ad. Cannot change status (only admin can approve).
// Body: { title?, subtitle?, logoUrl?, imageUrl?, videoUrl?, linkUrl?, ctaText? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const link = await db.enterpriseUserLink.findUnique({ where: { userId: user.id } })
  if (!link || !link.isActive) {
    return NextResponse.json({ error: 'Você não tem acesso Enterprise' }, { status: 403 })
  }

  const { id } = await params
  const ad = await db.enterpriseAd.findUnique({ where: { id } })
  if (!ad || ad.ownerId !== user.id) {
    return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  let data: Record<string, unknown>
  try {
    data = parseEnterpriseAdInput(body, { partial: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dados inválidos' }, { status: 400 })
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true, ad })

  // Approved and rejected creatives must return to review after any edit.
  if (['ACTIVE', 'REJECTED'].includes(ad.status)) {
    const cycle = await findServingEnterpriseCycle(ad.sponsoredCategoryId, user.id)
    if (!cycle) {
      return NextResponse.json({ error: 'Você precisa de um ciclo ativo para reenviar este anúncio' }, { status: 403 })
    }
    data.status = 'PENDING'
    data.rejectionReason = null
  }

  const updated = await db.enterpriseAd.update({ where: { id }, data })

  if (data.status === 'PENDING') {
    const admin = await db.user.findFirst({ where: { role: 'MASTER' } })
    if (admin) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: 'SYSTEM',
          title: '🎯 Anúncio Enterprise reenviado',
          message: `${link.companyName} atualizou um anúncio que precisa de nova aprovação.`,
          link: 'admin',
        },
      }).catch(() => {})
    }
  }
  return NextResponse.json({ ok: true, ad: updated })
}

// DELETE /api/enterprise/ads/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const link = await db.enterpriseUserLink.findUnique({ where: { userId: user.id } })
  if (!link || !link.isActive) {
    return NextResponse.json({ error: 'Você não tem acesso Enterprise' }, { status: 403 })
  }

  const { id } = await params
  const ad = await db.enterpriseAd.findUnique({ where: { id } })
  if (!ad || ad.ownerId !== user.id) {
    return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
  }

  await db.enterpriseAd.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
