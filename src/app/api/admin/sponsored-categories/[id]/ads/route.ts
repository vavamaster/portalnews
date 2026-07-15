import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { ENTERPRISE_AD_STATUSES, findServingEnterpriseCycle, parseEnterpriseAdInput } from '@/lib/enterprise'

// POST /api/admin/sponsored-categories/[id]/ads
// Admin creates an ad on behalf of a company user.
// Body: { ownerId, title, subtitle, logoUrl, imageUrl, videoUrl, linkUrl, ctaText, status, order, startAt, endAt }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id } = await params
  const sc = await db.sponsoredCategory.findUnique({ where: { id } })
  if (!sc) return NextResponse.json({ error: 'Sponsor não encontrado' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.ownerId !== 'string' || !body.ownerId.trim()) {
    return NextResponse.json({ error: 'ownerId e title são obrigatórios' }, { status: 400 })
  }

  const ownerLink = await db.enterpriseUserLink.findUnique({ where: { userId: body.ownerId } })
  if (!ownerLink?.isActive) {
    return NextResponse.json({ error: 'O usuário não possui acesso Enterprise ativo' }, { status: 400 })
  }

  let creative: Record<string, unknown>
  try {
    creative = parseEnterpriseAdInput(body, { admin: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dados inválidos' }, { status: 400 })
  }

  const status = typeof body.status === 'string' ? body.status : 'PENDING'
  if (!ENTERPRISE_AD_STATUSES.includes(status as any)) {
    return NextResponse.json({ error: 'Status do anúncio inválido' }, { status: 400 })
  }
  if (status === 'ACTIVE' && !await findServingEnterpriseCycle(sc.id, body.ownerId)) {
    return NextResponse.json({ error: 'Não é possível ativar: a empresa não possui ciclo válido nesta categoria' }, { status: 409 })
  }

  const parseDate = (value: unknown) => {
    if (!value) return null
    const date = new Date(String(value))
    if (Number.isNaN(date.getTime())) throw new Error('Data inválida')
    return date
  }
  let startAt: Date | null
  let endAt: Date | null
  try {
    startAt = parseDate(body.startAt)
    endAt = parseDate(body.endAt)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
  if (startAt && endAt && endAt <= startAt) {
    return NextResponse.json({ error: 'A data final deve ser posterior à inicial' }, { status: 400 })
  }

  // Enforce maxRotatingAds
  const activeAds = await db.enterpriseAd.count({
    where: {
      sponsoredCategoryId: sc.id,
      ...(sc.mode === 'EXCLUSIVE' ? {} : { ownerId: body.ownerId }),
      status: { in: ['ACTIVE', 'PENDING'] },
    },
  })
  if (activeAds >= sc.maxRotatingAds) {
    return NextResponse.json({
      error: `Limite de ${sc.maxRotatingAds} anúncio(s) ativo(s) por empresa nesta categoria`,
    }, { status: 400 })
  }

  const ad = await db.enterpriseAd.create({
    data: {
      sponsoredCategoryId: sc.id,
      ownerId: body.ownerId,
      ...(creative as any),
      status,
      startAt,
      endAt,
    },
  })
  return NextResponse.json({ ok: true, ad })
}
