import { NextRequest, NextResponse } from 'next/server'
import { getGatewayConfig } from '@/lib/payment-gateway'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notify } from '@/lib/achievements'

/**
 * PATCH /api/subscriptions/[id]
 * Body: { autoRenew?: boolean, cancelNow?: boolean }
 *
 * - { autoRenew: false } → disables auto-renew (subscription stays active until period ends)
 * - { cancelNow: true } → cancels immediately (also cancels at gateway if applicable)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  // Find subscription — user can only cancel their own
  const sub = await db.subscription.findFirst({
    where: { id, userId: user.id },
    include: { plan: true },
  })

  if (!sub) return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })

  // Just toggle autoRenew
  if (body.autoRenew !== undefined && !body.cancelNow) {
    const updated = await db.subscription.update({
      where: { id: sub.id },
      data: { autoRenew: body.autoRenew },
    })
    await notify(user.id, 'SYSTEM',
      body.autoRenew ? 'Renovação automática ativada' : 'Renovação automática desativada',
      body.autoRenew
        ? 'Sua assinatura será renovada automaticamente ao final do período.'
        : 'Sua assinatura permanece ativa até o final do período atual, mas não será renovada.',
      'advertiser'
    )
    return NextResponse.json({ ok: true, subscription: updated })
  }

  // Cancel immediately
  if (body.cancelNow) {
    // Try to cancel at gateway
    if (sub.externalSubId && sub.paymentProvider !== 'NONE') {
      try {
        const gateway = await getGatewayConfig(sub.paymentProvider as any)
        if (gateway) {
          // Cancel at gateway based on provider
          if (sub.paymentProvider === 'STRIPE') {
            await fetch(`https://api.stripe.com/v1/subscriptions/${sub.externalSubId}/cancel`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${gateway.apiKey}` },
            })
          } else if (sub.paymentProvider === 'ASAAS') {
            const baseUrl = gateway.isSandbox ? 'https://sandbox.asaas.com' : 'https://api.asaas.com'
            await fetch(`${baseUrl}/api/v3/subscriptions/${sub.externalSubId}/cancel`, {
              method: 'POST',
              headers: { access_token: gateway.apiKey },
            })
          } else if (sub.paymentProvider === 'MERCADO_PAGO') {
            await fetch(`https://api.mercadopago.com/preapproval/${sub.externalSubId}`, {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${gateway.apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: 'cancelled' }),
            })
          }
        }
      } catch (e) {
        console.error('Gateway cancellation failed:', e)
        // Continue with local cancellation even if gateway fails
      }
    }

    const updated = await db.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELED', autoRenew: false },
    })
    await notify(user.id, 'SYSTEM', 'Assinatura cancelada', `Sua assinatura ${sub.plan.name} foi cancelada.`, 'advertiser')
    return NextResponse.json({ ok: true, subscription: updated })
  }

  return NextResponse.json({ error: 'Nenhuma ação especificada' }, { status: 400 })
}
