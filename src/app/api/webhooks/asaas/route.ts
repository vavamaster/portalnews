import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notify } from '@/lib/achievements'
import { activateEnterpriseCycleOnPayment } from '@/lib/enterprise-billing'

/**
 * Webhook Asaas — confirma pagamento automaticamente
 * Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE
 *
 * Configurar no Asaas: https://sandbox.asaas.com/config/conta/notificacoes
 * URL: https://[seu-dominio]/api/webhooks/asaas
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const eventType = body.event

    if (!eventType || !body.payment) {
      return NextResponse.json({ ok: true })
    }

    const asaasPaymentId = body.payment.id
    const tx = await db.paymentTransaction.findFirst({
      where: { externalId: asaasPaymentId },
      include: { user: true },
    })

    if (!tx) return NextResponse.json({ ok: true, message: 'Transaction not found' })

    if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {
      if (tx.status !== 'PAID') {
        await db.$transaction([
          db.paymentTransaction.update({
            where: { id: tx.id },
            data: { status: 'PAID' },
          }),
          db.subscription.updateMany({
            where: { externalSubId: tx.externalId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
            data: { status: 'ACTIVE' },
          }),
        ])

        await notify(tx.userId, 'SYSTEM', 'Pagamento confirmado! 🎉', `Sua assinatura está ativa.`, 'advertiser')
        // Activate Enterprise billing cycle if this payment is linked to one
        await activateEnterpriseCycleOnPayment(tx.id)
      }
    } else if (eventType === 'PAYMENT_OVERDUE') {
      await db.paymentTransaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED' },
      })
      await db.subscription.updateMany({
        where: { externalSubId: tx.externalId },
        data: { status: 'PAST_DUE' },
      })
      await notify(tx.userId, 'SYSTEM', 'Pagamento vencido', 'Sua assinatura está em atraso. Regularize para manter o acesso.', 'advertiser')
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Asaas webhook error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
