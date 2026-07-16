import { NextRequest, NextResponse } from 'next/server'
import { getGatewayConfig } from '@/lib/payment-gateway'
import { db } from '@/lib/db'
import { notify } from '@/lib/achievements'
import { activateEnterpriseCycleOnPayment } from '@/lib/enterprise-billing'
import { activateClassifiedSubscription, pauseListingsForUser } from '@/lib/classifieds'

/**
 * Webhook Stripe — confirma pagamento automaticamente
 * Configurar: https://dashboard.stripe.com/webhooks
 * URL: https://[seu-dominio]/api/webhooks/stripe
 * Events: checkout.session.completed, invoice.paid, customer.subscription.deleted
 *
 * Security: verifies Stripe signature header using webhookSecret from gateway config.
 * Without valid signature, the request is rejected.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.text()
    const signature = req.headers.get('stripe-signature')

    // Security: verify Stripe signature — REQUIRED, not optional
    const gateway = await getGatewayConfig("STRIPE")
    if (!gateway?.webhookSecret) {
      return NextResponse.json({ error: 'webhookSecret não configurado' }, { status: 500 })
    }
    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 401 })
    }
    try {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(gateway.secretKey || gateway.apiKey)
      await stripe.webhooks.constructEvent(payload, signature, gateway.webhookSecret)
    } catch (e: any) {
      console.error('Stripe signature verification failed:', e.message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(payload)
    const eventType = body.type

    if (!eventType) return NextResponse.json({ ok: true })

    // checkout.session.completed — payment confirmed
    if (eventType === 'checkout.session.completed') {
      const session = body.data?.object
      const sessionId = session?.id
      if (session?.payment_status !== 'paid' && session?.payment_status !== 'no_payment_required') {
        return NextResponse.json({ ok: true, message: `Checkout status: ${session?.payment_status || 'unknown'}` })
      }

      const tx = await db.paymentTransaction.findFirst({
        where: { externalId: sessionId },
      })

      if (tx && tx.status !== 'PAID') {
        if (tx.type === 'SUBSCRIPTION') {
          const subscription = await db.subscription.findFirst({
            where: { externalSubId: sessionId, status: { in: ['ACTIVE', 'PAST_DUE', 'PENDING'] } },
            orderBy: { createdAt: 'desc' },
          })
          if (!subscription) throw new Error('Assinatura Stripe correspondente não encontrada')
          await activateClassifiedSubscription(subscription.id, { externalSubId: session.subscription || sessionId })
          await db.paymentTransaction.update({ where: { id: tx.id }, data: { status: 'PAID' } })
          await notify(tx.userId, 'SYSTEM', 'Pagamento confirmado! 🎉', 'Sua assinatura está ativa.', 'advertiser')
        } else {
          await db.paymentTransaction.update({ where: { id: tx.id }, data: { status: 'PAID' } })
        }

        // P1-8 fix: record coupon redemption so coupons can't be reused indefinitely.
        // currentRedemptions is only incremented when a NEW CouponRedemption row is
        // created (unique constraint on couponId+userId prevents double-counting on
        // duplicate webhooks).
        if (tx.couponId) {
          try {
            await db.$transaction([
              db.couponRedemption.create({
                data: { couponId: tx.couponId, userId: tx.userId, transactionId: tx.id },
              }),
              db.coupon.update({
                where: { id: tx.couponId },
                data: { currentRedemptions: { increment: 1 } },
              }),
            ])
          } catch (e: any) {
            // P2002 = already redeemed by this user for this coupon — ignore.
            if (e?.code !== 'P2002') {
              console.error('Stripe coupon redemption failed:', e)
            }
          }
        }
        if (tx.type === 'ENTERPRISE_SPONSOR') await activateEnterpriseCycleOnPayment(tx.id)
      }
    }

    if (eventType === 'checkout.session.expired') {
      const sessionId = body.data?.object?.id
      const transaction = await db.paymentTransaction.findFirst({ where: { externalId: sessionId, status: 'PENDING' } })
      if (transaction) {
        await db.$transaction([
          db.paymentTransaction.update({ where: { id: transaction.id }, data: { status: 'FAILED' } }),
          db.subscription.updateMany({
            where: { userId: transaction.userId, externalSubId: sessionId, status: 'PENDING' },
            data: { status: 'CANCELED', autoRenew: false },
          }),
        ])
      }
    }

    // invoice.paid — recurring payment succeeded
    if (eventType === 'invoice.paid') {
      const invoice = body.data?.object
      const subId = invoice?.subscription

      // A4 fix: try to find subscription by externalSubId, then by latest PENDING tx for this user
      let sub = await db.subscription.findFirst({
        where: { externalSubId: subId },
      })

      // If not found by subId, try by sessionId (older subscriptions stored session ID)
      if (!sub) {
        const tx = await db.paymentTransaction.findFirst({
          where: { externalId: subId, type: 'SUBSCRIPTION' },
        })
        if (tx) {
          sub = await db.subscription.findFirst({
            where: { userId: tx.userId, status: 'ACTIVE' },
          })
        }
      }

      if (sub) {
        // Update externalSubId to the real Stripe subscription ID (A4 fix)
        const newEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        await activateClassifiedSubscription(sub.id, { externalSubId: subId, periodEnd: newEnd })
        const existingInvoice = await db.paymentTransaction.findFirst({ where: { externalId: invoice.id } })
        if (!existingInvoice) {
          await db.paymentTransaction.create({
            data: {
              userId: sub.userId, type: 'SUBSCRIPTION',
              amountCents: invoice.amount_paid || 0,
              provider: 'STRIPE', status: 'PAID',
              description: `Renovação automática — ${new Date().toLocaleDateString('pt-BR')}`,
              externalId: invoice.id,
            },
          })
        }
        await notify(sub.userId, 'SYSTEM', 'Renovação automática confirmada!', 'Sua assinatura foi renovada por mais 30 dias.', 'advertiser')
      }
    }

    // customer.subscription.deleted — subscription canceled
    if (eventType === 'customer.subscription.deleted') {
      const subObj = body.data?.object
      const subId = subObj?.id
      const canceledSubscriptions = await db.subscription.findMany({
        where: { externalSubId: subId },
        select: { userId: true },
      })
      await db.subscription.updateMany({
        where: { externalSubId: subId },
        data: { status: 'CANCELED', autoRenew: false },
      })
      for (const canceled of canceledSubscriptions) {
        const otherActive = await db.subscription.findFirst({
          where: { userId: canceled.userId, status: 'ACTIVE', currentPeriodEnd: { gte: new Date() }, externalSubId: { not: subId } },
        })
        if (!otherActive) await pauseListingsForUser(canceled.userId, 'Sua assinatura Stripe foi cancelada.')
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Stripe webhook error:', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
