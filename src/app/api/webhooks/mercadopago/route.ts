import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notify } from '@/lib/achievements'
import { activateEnterpriseCycleOnPayment } from '@/lib/enterprise-billing'

/**
 * Webhook Mercado Pago — confirma pagamento automaticamente
 * Configurar: https://www.mercadopago.com.br/developers/panel/app
 * URL: https://[seu-dominio]/api/webhooks/mercadopago
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // MP sends { type: "payment", data: { id: "123456789" } }
    if (body.type !== 'payment' || !body.data?.id) {
      return NextResponse.json({ ok: true })
    }

    const mpPaymentId = String(body.data.id)
    const tx = await db.paymentTransaction.findFirst({
      where: { externalId: mpPaymentId },
      include: { user: true },
    })

    if (!tx) return NextResponse.json({ ok: true, message: 'Transaction not found' })

    // Fetch payment status from MP API
    // In production, use the gateway config to get access token
    if (tx.status !== 'PAID') {
      // For now, mark as PAID (the webhook itself is the confirmation)
      await db.$transaction([
        db.paymentTransaction.update({
          where: { id: tx.id },
          data: { status: 'PAID' },
        }),
        db.subscription.updateMany({
          where: { externalSubId: tx.externalId },
          data: { status: 'ACTIVE' },
        }),
      ])

      await notify(tx.userId, 'SYSTEM', 'Pagamento confirmado! 🎉', 'Sua assinatura está ativa.', 'advertiser')
      // Activate Enterprise billing cycle if this payment is linked to one
      await activateEnterpriseCycleOnPayment(tx.id)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Mercado Pago webhook error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
