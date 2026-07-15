import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import {
  activateEnterpriseCycle,
  ENTERPRISE_BILLING_TYPES,
  ENTERPRISE_CYCLE_STATUSES,
  pauseEnterpriseAdsWithoutCoverage,
} from '@/lib/enterprise'

// PATCH /api/admin/sponsored-categories/[id]/billing/[cycleId]
// Edit a billing cycle — change status, value, dates, etc.
// Body: { status?, valueCents?, type?, impressionsLimit?, startAt?, endAt? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; cycleId: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id, cycleId } = await params
  const existing = await db.enterpriseBillingCycle.findFirst({
    where: { id: cycleId, sponsoredCategoryId: id },
  })
  if (!existing) return NextResponse.json({ error: 'Ciclo não encontrado neste sponsor' }, { status: 404 })
  const body = await req.json()
  const data: any = {}
  if (body.status !== undefined) {
    if (!ENTERPRISE_CYCLE_STATUSES.includes(body.status)) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    data.status = body.status
  }
  if (body.valueCents !== undefined) {
    const value = Number(body.valueCents)
    if (!Number.isInteger(value) || value < 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    data.valueCents = value
  }
  if (body.type !== undefined) {
    if (!ENTERPRISE_BILLING_TYPES.includes(body.type)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    data.type = body.type
  }
  if (body.impressionsLimit !== undefined) {
    const limit = Number(body.impressionsLimit)
    if (!Number.isInteger(limit) || limit < 0) return NextResponse.json({ error: 'Limite de impressões inválido' }, { status: 400 })
    data.impressionsLimit = limit
  }
  if (body.startAt !== undefined) {
    const date = body.startAt ? new Date(body.startAt) : null
    if (!date || Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Data inicial inválida' }, { status: 400 })
    data.startAt = date
  }
  if (body.endAt !== undefined) {
    const date = body.endAt ? new Date(body.endAt) : null
    if (date && Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Data final inválida' }, { status: 400 })
    data.endAt = date
  }

  const finalType = data.type || existing.type
  const finalLimit = data.impressionsLimit ?? existing.impressionsLimit
  const finalStart = data.startAt || existing.startAt
  const finalEnd = data.endAt === undefined ? existing.endAt : data.endAt
  if (finalType === 'IMPRESSIONS' && finalLimit <= 0) {
    return NextResponse.json({ error: 'O limite de impressões deve ser maior que zero' }, { status: 400 })
  }
  if (finalType === 'MONTHLY' && finalEnd && finalEnd <= finalStart) {
    return NextResponse.json({ error: 'A data final deve ser posterior à inicial' }, { status: 400 })
  }
  if (data.status === 'ACTIVE' && finalType === 'MONTHLY' && finalEnd && finalEnd <= new Date()) {
    return NextResponse.json({ error: 'Não é possível ativar um ciclo mensal já vencido' }, { status: 400 })
  }
  if (data.status === 'ACTIVE' && finalType === 'IMPRESSIONS' && existing.impressionsUsed >= finalLimit) {
    return NextResponse.json({ error: 'Crie um novo ciclo: este limite de impressões já foi consumido' }, { status: 400 })
  }

  const requestedStatus = data.status
  if (requestedStatus === 'ACTIVE') delete data.status
  let cycle = await db.enterpriseBillingCycle.update({ where: { id: cycleId }, data })

  // If status changed to ACTIVE, unpause the user's ads in this sponsor
  if (body.status === 'ACTIVE') {
    cycle = (await activateEnterpriseCycle(cycle.id)) || cycle
  }
  if (requestedStatus && requestedStatus !== 'ACTIVE') {
    await pauseEnterpriseAdsWithoutCoverage(cycle.sponsoredCategoryId, cycle.userId)
  }

  return NextResponse.json({ ok: true, cycle })
}

// DELETE /api/admin/sponsored-categories/[id]/billing/[cycleId]
// Cancel a billing cycle while preserving payment and audit history.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; cycleId: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id, cycleId } = await params
  const cycle = await db.enterpriseBillingCycle.findFirst({
    where: { id: cycleId, sponsoredCategoryId: id },
  })
  if (!cycle) return NextResponse.json({ error: 'Ciclo não encontrado neste sponsor' }, { status: 404 })
  await db.enterpriseBillingCycle.update({ where: { id: cycleId }, data: { status: 'CANCELLED' } })
  await pauseEnterpriseAdsWithoutCoverage(cycle.sponsoredCategoryId, cycle.userId)
  return NextResponse.json({ ok: true, cancelled: true })
}
