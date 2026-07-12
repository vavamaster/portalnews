import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'

/**
 * Unified payment webhook — DEPRECATED for security.
 * Use gateway-specific webhooks instead:
 * - /api/webhooks/asaas
 * - /api/webhooks/mercadopago
 * - /api/webhooks/stripe
 *
 * This endpoint now requires admin authentication to prevent fraud.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado. Use webhooks específicos: /api/webhooks/asaas, /api/webhooks/mercadopago, /api/webhooks/stripe' }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    message: 'Use gateway-specific webhooks: /api/webhooks/asaas, /api/webhooks/mercadopago, /api/webhooks/stripe'
  })
}
