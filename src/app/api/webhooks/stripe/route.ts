import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notify } from '@/lib/achievements'
import { activateEnterpriseCycleOnPayment } from '@/lib/enterprise-billing'

/**
 * Webhook Stripe — confirma pagamento automaticamente
 * Configurar: https://dashboard.stripe.com/webhooks
 * URL: https://[seu-dominio]/api/webhooks/stripe
 * Events: checkout.session.completed, invoice.paid, customer.subscription.deleted
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const eventType = body.type

    if (!eventType) return NextResponse.json({ ok: true })

    // checkout.session.completed — payment confirmed
    if (eventType === 'checkout.session.completed') {
      const session = body.data?.object
      const sessionId = session?.id
      const clientRef = session?.client_reference_id

      const tx = await db.paymentTransaction.findFirst({
        where: { externalId: sessionId },
      })

      if (tx && tx.status !== 'PAID') {
        await db.$transaction([
          db.paymentTransaction.update({
            where: { id: tx.id },
            data: { status: 'PAID' },
          }),
          db.subscription.updateMany({
            where: { externalSubId: sessionId },
            data: { status: 'ACTIVE' },
          }),
        ])
        await notify(tx.userId, 'SYSTEM', 'Pagamento confirmado! 🎉', 'Sua assinatura está ativa.', 'advertiser')
        // Activate Enterprise billing cycle if this payment is linked to one
        await activateEnterpriseCycleOnPayment(tx.id)
      }
    }

    // invoice.paid — recurring payment succeeded
    if (eventType === 'invoice.paid') {
      const invoice = body.data?.object
      const subId = invoice?.subscription

      // Extend subscription period
      const sub = await db.subscription.findFirst({
        where: { externalSubId: subId },
      })
      if (sub) {
        const newEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        await db.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: newEnd,
            listingsUsedThisCycle: 0,
            leadsReceivedThisCycle: 0,
          },
        })
        await db.paymentTransaction.create({
          data: {
            userId: sub.userId, type: 'SUBSCRIPTION',
            amountCents: invoice.amount_paid || 0,
            provider: 'STRIPE', status: 'PAID',
            description: `Renovação automática — ${new Date().toLocaleDateString('pt-BR')}`,
            externalId: invoice.id,
          },
        })
        await notify(sub.userId, 'SYSTEM', 'Renovação automática confirmada!', 'Sua assinatura foi renovada por mais 30 dias.', 'advertiser')
      }
    }

    // customer.subscription.deleted — subscription canceled
    if (eventType === 'customer.subscription.deleted') {
      const subObj = body.data?.object
      const subId = subObj?.id
      await db.subscription.updateMany({
        where: { externalSubId: subId },
        data: { status: 'CANCELED' },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Stripe webhook error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
