import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// PATCH /api/admin/sponsored-categories/[id]/billing/[cycleId]
// Edit a billing cycle — change status, value, dates, etc.
// Body: { status?, valueCents?, type?, impressionsLimit?, startAt?, endAt? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; cycleId: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { cycleId } = await params
  const body = await req.json()
  const data: any = {}
  if (body.status !== undefined) data.status = body.status
  if (body.valueCents !== undefined) data.valueCents = parseInt(body.valueCents, 10) || 0
  if (body.type !== undefined) data.type = body.type
  if (body.impressionsLimit !== undefined) data.impressionsLimit = parseInt(body.impressionsLimit, 10) || 0
  if (body.startAt !== undefined) data.startAt = body.startAt ? new Date(body.startAt) : null
  if (body.endAt !== undefined) data.endAt = body.endAt ? new Date(body.endAt) : null

  const cycle = await db.enterpriseBillingCycle.update({ where: { id: cycleId }, data })

  // If status changed to ACTIVE, unpause the user's ads in this sponsor
  if (body.status === 'ACTIVE') {
    await db.enterpriseAd.updateMany({
      where: { sponsoredCategoryId: cycle.sponsoredCategoryId, ownerId: cycle.userId, status: 'PAUSED' },
      data: { status: 'ACTIVE' },
    })
  }
  // If status changed to EXPIRED or CANCELLED, pause the user's ads
  if (body.status === 'EXPIRED' || body.status === 'CANCELLED') {
    await db.enterpriseAd.updateMany({
      where: { sponsoredCategoryId: cycle.sponsoredCategoryId, ownerId: cycle.userId, status: 'ACTIVE' },
      data: { status: 'PAUSED' },
    })
  }

  return NextResponse.json({ ok: true, cycle })
}

// DELETE /api/admin/sponsored-categories/[id]/billing/[cycleId]
// Delete a billing cycle (use with caution — loses historical data).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; cycleId: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { cycleId } = await params
  await db.enterpriseBillingCycle.delete({ where: { id: cycleId } })
  return NextResponse.json({ ok: true })
}
