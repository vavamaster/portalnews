import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { validateCoupon } from '@/lib/achievements'

// POST - validate a coupon before applying
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login' }, { status: 401 })
    const { code, amountCents, appliesTo } = await req.json()
    if (!code) return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 })
    const result = await validateCoupon(code, user.id, amountCents || 0, appliesTo || 'SUBSCRIPTION')
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
