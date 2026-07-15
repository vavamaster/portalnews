import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond } from '@/lib/api-helpers'

// GET /api/admin/sponsored-categories/[id] — full detail (sponsor config + ads + landing page + billing cycles + metrics)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response

  const { id } = await params
  const sc = await db.sponsoredCategory.findUnique({
    where: { id },
    include: {
      category: true,
      ads: {
        include: { owner: { select: { id: true, name: true, email: true } } },
        orderBy: { order: 'asc' },
      },
      landingPage: true,
      billingCycles: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  })
  if (!sc) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  // Get last 30 days of metrics
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0)
  const metrics = await db.enterpriseMetric.findMany({
    where: { sponsoredCategoryId: sc.id, date: { gte: thirtyDaysAgo } },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json({ sponsor: sc, metrics })
}

// PATCH /api/admin/sponsored-categories/[id] — update config
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response
  const { id } = await params
  const current = await db.sponsoredCategory.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const body = await req.json()
  const allowed = ['mode', 'billingType', 'billingValueCents', 'billingImpressions', 'maxRotatingAds',
    'transitionType', 'transitionMs', 'commercialContactName', 'commercialContactEmail',
    'commercialContactPhone', 'bannerWidth', 'bannerHeight', 'isActive']
  const data: any = {}
  for (const k of allowed) {
    if (k in body) data[k] = body[k]
  }
  if (data.mode !== undefined && !['EXCLUSIVE', 'ROTATING', 'DISABLED'].includes(data.mode)) {
    return NextResponse.json({ error: 'Modo de patrocínio inválido' }, { status: 400 })
  }
  if (data.billingType !== undefined && !['MONTHLY', 'IMPRESSIONS'].includes(data.billingType)) {
    return NextResponse.json({ error: 'Tipo de cobrança inválido' }, { status: 400 })
  }
  if (data.transitionType !== undefined && !['FADE', 'SLIDE', 'NONE'].includes(data.transitionType)) {
    return NextResponse.json({ error: 'Tipo de transição inválido' }, { status: 400 })
  }
  if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive inválido' }, { status: 400 })
  }
  for (const key of ['commercialContactName', 'commercialContactEmail', 'commercialContactPhone']) {
    if (data[key] !== undefined) {
      if (data[key] !== null && typeof data[key] !== 'string') {
        return NextResponse.json({ error: `${key} inválido` }, { status: 400 })
      }
      data[key] = typeof data[key] === 'string' ? data[key].trim() || null : null
    }
  }
  if (data.commercialContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.commercialContactEmail)) {
    return NextResponse.json({ error: 'Email comercial inválido' }, { status: 400 })
  }
  for (const key of ['billingValueCents', 'billingImpressions', 'maxRotatingAds', 'transitionMs', 'bannerWidth', 'bannerHeight']) {
    if (data[key] !== undefined) {
      const value = Number(data[key])
      if (!Number.isInteger(value)) return NextResponse.json({ error: `${key} inválido` }, { status: 400 })
      data[key] = value
    }
  }
  if (data.billingValueCents !== undefined && data.billingValueCents < 0) {
    return NextResponse.json({ error: 'Valor da cobrança inválido' }, { status: 400 })
  }
  const finalBillingType = data.billingType || current.billingType
  const finalBillingImpressions = data.billingImpressions ?? current.billingImpressions
  if (finalBillingType === 'IMPRESSIONS' && finalBillingImpressions <= 0) {
    return NextResponse.json({ error: 'As impressões devem ser maiores que zero' }, { status: 400 })
  }
  if (data.maxRotatingAds !== undefined && (data.maxRotatingAds < 1 || data.maxRotatingAds > 5)) {
    return NextResponse.json({ error: 'O limite rotativo deve ficar entre 1 e 5' }, { status: 400 })
  }
  if (data.bannerWidth !== undefined && (data.bannerWidth < 100 || data.bannerWidth > 4000)) {
    return NextResponse.json({ error: 'Largura do banner inválida' }, { status: 400 })
  }
  if (data.bannerHeight !== undefined && (data.bannerHeight < 50 || data.bannerHeight > 2000)) {
    return NextResponse.json({ error: 'Altura do banner inválida' }, { status: 400 })
  }
  // EXCLUSIVE → maxRotatingAds = 1
  if (data.mode === 'EXCLUSIVE') data.maxRotatingAds = 1
  if (data.transitionMs !== undefined) {
    const tMs = parseInt(data.transitionMs, 10)
    if (isNaN(tMs) || tMs < 3000 || tMs > 10000) {
      return NextResponse.json({ error: 'tempo de transição deve ser entre 3000 e 10000ms' }, { status: 400 })
    }
  }
  const sc = await db.sponsoredCategory.update({ where: { id }, data })
  if (data.isActive === false || data.mode === 'DISABLED') {
    await db.enterpriseAd.updateMany({
      where: { sponsoredCategoryId: id, status: 'ACTIVE' },
      data: { status: 'PAUSED' },
    })
  }
  return NextResponse.json({ ok: true, sponsor: sc })
}

// DELETE /api/admin/sponsored-categories/[id] — deactivate while preserving billing history
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response
  const { id } = await params
  const existing = await db.sponsoredCategory.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  await db.$transaction([
    db.sponsoredCategory.update({ where: { id }, data: { isActive: false, mode: 'DISABLED' } }),
    db.enterpriseAd.updateMany({
      where: { sponsoredCategoryId: id, status: 'ACTIVE' },
      data: { status: 'PAUSED' },
    }),
  ])
  return NextResponse.json({ ok: true, deactivated: true })
}
