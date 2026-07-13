import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond } from '@/lib/api-helpers'

// PATCH /api/admin/coupons/[id] — update coupon
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response
  const { id } = await params
  const body = await req.json()
  const data: any = {}
  for (const k of ['code', 'type', 'value', 'minAmountCents', 'maxRedemptions', 'validFrom', 'validUntil', 'isActive', 'description', 'appliesTo', 'firstTimeOnly']) {
    if (k in body) {
      if (k === 'code') data[k] = body[k].toUpperCase().trim()
      else if (k === 'value') data[k] = parseFloat(body[k])
      else if (k === 'minAmountCents' || k === 'maxRedemptions') data[k] = parseInt(body[k], 10) || 0
      else if (k === 'validFrom' || k === 'validUntil') data[k] = body[k] ? new Date(body[k]) : null
      else data[k] = body[k]
    }
  }
  const coupon = await db.coupon.update({ where: { id }, data })
  return NextResponse.json({ ok: true, coupon })
}

// DELETE /api/admin/coupons/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response
  const { id } = await params
  await db.coupon.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
