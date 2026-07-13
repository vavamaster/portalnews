import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond } from '@/lib/api-helpers'

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
  const body = await req.json()
  if (!body.code || !body.type || body.value === undefined) {
    return NextResponse.json({ error: 'code, type e value são obrigatórios' }, { status: 400 })
  }
  const coupon = await db.coupon.create({
    data: {
      code: body.code.toUpperCase().trim(),
      type: body.type, // PERCENT | FIXED
      value: parseFloat(body.value),
      minAmountCents: parseInt(body.minAmountCents, 10) || 0,
      maxRedemptions: parseInt(body.maxRedemptions, 10) || -1,
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
