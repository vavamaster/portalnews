import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { ENTERPRISE_AD_STATUSES, findServingEnterpriseCycle, parseEnterpriseAdInput } from '@/lib/enterprise'

// PATCH /api/admin/sponsored-categories/[id]/ads/[adId]
// Approve / reject / pause / edit an ad.
// Body: { status?, rejectionReason?, title?, subtitle?, logoUrl?, imageUrl?, videoUrl?, linkUrl?, ctaText?, order? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; adId: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id, adId } = await params
  // C-04 fix: verify the ad belongs to this sponsored category
  const existing = await db.enterpriseAd.findFirst({
    where: { id: adId, sponsoredCategoryId: id },
    include: { sponsoredCategory: true },
  })
  if (!existing) return NextResponse.json({ error: 'Anúncio não encontrado neste sponsor' }, { status: 404 })

  const body = await req.json().catch(() => null)
  let data: Record<string, unknown>
  try {
    data = parseEnterpriseAdInput(body, { partial: true, admin: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dados inválidos' }, { status: 400 })
  }

  if (body && 'status' in body) {
    if (typeof body.status !== 'string' || !ENTERPRISE_AD_STATUSES.includes(body.status as any)) {
      return NextResponse.json({ error: 'Status do anúncio inválido' }, { status: 400 })
    }
    data.status = body.status
  }
  if (body && 'rejectionReason' in body) {
    data.rejectionReason = typeof body.rejectionReason === 'string'
      ? body.rejectionReason.trim().slice(0, 500) || null
      : null
  }
  for (const key of ['startAt', 'endAt'] as const) {
    if (body && key in body) {
      if (!body[key]) {
        data[key] = null
      } else {
        const date = new Date(String(body[key]))
        if (Number.isNaN(date.getTime())) return NextResponse.json({ error: `${key} inválido` }, { status: 400 })
        data[key] = date
      }
    }
  }
  const finalStart = (data.startAt as Date | null | undefined) === undefined ? existing.startAt : data.startAt as Date | null
  const finalEnd = (data.endAt as Date | null | undefined) === undefined ? existing.endAt : data.endAt as Date | null
  if (finalStart && finalEnd && finalEnd <= finalStart) {
    return NextResponse.json({ error: 'A data final deve ser posterior à inicial' }, { status: 400 })
  }
  if (data.status === 'REJECTED' && !data.rejectionReason) {
    return NextResponse.json({ error: 'Informe o motivo da rejeição' }, { status: 400 })
  }

  if (data.status === 'ACTIVE') {
    if (!existing.sponsoredCategory.isActive || existing.sponsoredCategory.mode === 'DISABLED') {
      return NextResponse.json({ error: 'A categoria patrocinada está desativada' }, { status: 409 })
    }
    if (!await findServingEnterpriseCycle(id, existing.ownerId)) {
      return NextResponse.json({ error: 'A empresa não possui ciclo válido nesta categoria' }, { status: 409 })
    }
    const activeCount = await db.enterpriseAd.count({
      where: {
        sponsoredCategoryId: id,
        id: { not: adId },
        ...(existing.sponsoredCategory.mode === 'EXCLUSIVE' ? {} : { ownerId: existing.ownerId }),
        status: 'ACTIVE',
      },
    })
    if (activeCount >= existing.sponsoredCategory.maxRotatingAds) {
      return NextResponse.json({ error: `Limite de ${existing.sponsoredCategory.maxRotatingAds} anúncio(s) ativo(s) atingido` }, { status: 409 })
    }
    data.rejectionReason = null
  }

  const ad = await db.enterpriseAd.update({ where: { id: adId }, data })
  return NextResponse.json({ ok: true, ad })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; adId: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id, adId } = await params

  // C-04 fix: verify the ad belongs to this sponsored category
  const existing = await db.enterpriseAd.findFirst({ where: { id: adId, sponsoredCategoryId: id } })
  if (!existing) return NextResponse.json({ error: 'Anúncio não encontrado neste sponsor' }, { status: 404 })

  await db.enterpriseAd.delete({ where: { id: adId } })
  return NextResponse.json({ ok: true })
}
