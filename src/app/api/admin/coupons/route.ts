import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond } from '@/lib/api-helpers'
import { couponSchema, validationError } from '@/lib/admin-validation'

// GET /api/admin/coupons — list all coupons
export async function GET(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response
  const coupons = await db.coupon.findMany({
    include: { _count: { select: { redemptions: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ coupons })
}

// POST /api/admin/coupons — create coupon
export async function POST(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response
  const parsed = couponSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })
  const body = parsed.data
  const coupon = await db.coupon.create({
    data: {
      code: body.code.toUpperCase().trim(),
      type: body.type, // PERCENT | FIXED
      value: body.value,
      minAmountCents: body.minAmountCents || 0,
      maxRedemptions: body.maxRedemptions ?? -1,
      validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      isActive: body.isActive !== false,
      description: body.description || null,
      appliesTo: body.appliesTo || 'SUBSCRIPTION',
      firstTimeOnly: body.firstTimeOnly || false,
    },
  })
  return NextResponse.json({ ok: true, coupon })
}
