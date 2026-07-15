import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond } from '@/lib/api-helpers'
import { couponSchema, validationError } from '@/lib/admin-validation'

// PATCH /api/admin/coupons/[id] — update coupon
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response
  const { id } = await params
  const parsed = couponSchema.partial().safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })
  const data: any = { ...parsed.data }
  if (data.code) data.code = data.code.toUpperCase()
  if ('validFrom' in data) data.validFrom = data.validFrom ? new Date(data.validFrom) : null
  if ('validUntil' in data) data.validUntil = data.validUntil ? new Date(data.validUntil) : null
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
