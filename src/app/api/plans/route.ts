import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAllGateways } from '@/lib/payment-gateway'

// GET /api/plans - public list of plans
export async function GET() {
  const [plans, gateways] = await Promise.all([
    db.plan.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    }),
    getAllGateways(),
  ])
  return NextResponse.json({
    plans: plans.map(plan => {
      const publicPlan: Record<string, unknown> = { ...plan }
      delete publicPlan.asaasPlanId
      delete publicPlan.mercadoPagoPlanId
      delete publicPlan.stripePriceId
      return publicPlan
    }),
    gateways: gateways
      .filter(gateway => gateway.isEnabled)
      .map(gateway => ({
        provider: gateway.provider,
        displayName: gateway.displayName,
        isDefault: gateway.isDefault,
        acceptsPix: gateway.acceptsPix,
        acceptsBoleto: gateway.acceptsBoleto,
        acceptsCreditCard: gateway.acceptsCreditCard,
      })),
  })
}
