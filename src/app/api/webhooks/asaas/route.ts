import { NextRequest, NextResponse } from 'next/server'
import { getGatewayConfig } from '@/lib/payment-gateway'
import { db } from '@/lib/db'
import { notify } from '@/lib/achievements'
import { activateEnterpriseCycleOnPayment } from '@/lib/enterprise-billing'

/**
 * Webhook Asaas — confirma pagamento automaticamente
 * Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE
 *
 * Configurar no Asaas: https://sandbox.asaas.com/config/conta/notificacoes
 * URL: https://[seu-dominio]/api/webhooks/asaas
 *
 * Security: validates the request came from Asaas by checking the access token header.
 * Asaas sends the webhook using your API access_token in the header.
 */
export async function POST(req: NextRequest) {
  try {
    // Security: verify Asaas access token header — REQUIRED, not optional
    const accessToken = req.headers.get('asaas-access-token')
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 401 })
    }
    const gateway = await getGatewayConfig("ASAAS")
    if (!gateway || !gateway.apiKey || accessToken !== gateway.apiKey) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await req.json()
    const eventType = body.event

    if (!eventType || !body.payment) {
      return NextResponse.json({ ok: true })
    }

    const asaasPaymentId = body.payment.id
    const asaasSubscriptionId = body.payment.subscription // Asaas recurring payments include this

    // C5 fix: try to find the transaction by payment ID first, then by subscription ID
    let tx = await db.paymentTransaction.findFirst({
      where: { externalId: asaasPaymentId },
      include: { user: true },
    })

    // If not found by payment ID, try by subscription ID (for recurring payments)
    if (!tx && asaasSubscriptionId) {
      tx = await db.paymentTransaction.findFirst({
        where: { externalId: asaasSubscriptionId },
        include: { user: true },
      })
    }

    // Still not found — try to find via Subscription's externalSubId
    if (!tx && asaasSubscriptionId) {
      const sub = await db.subscription.findFirst({
        where: { externalSubId: asaasSubscriptionId },
        include: { user: true },
      })
      if (sub) {
        tx = await db.paymentTransaction.findFirst({
          where: { userId: sub.userId, status: 'PENDING', type: 'SUBSCRIPTION' },
          orderBy: { createdAt: 'desc' },
          include: { user: true },
        })
      }
    }

    if (!tx) return NextResponse.json({ ok: true, message: 'Transaction not found' })

    if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {
      if (tx.status !== 'PAID') {
        if (tx.type === 'SUBSCRIPTION') {
          await db.$transaction([
            db.paymentTransaction.update({ where: { id: tx.id }, data: { status: 'PAID' } }),
            db.subscription.updateMany({
              where: { externalSubId: asaasSubscriptionId || tx.externalId, status: { in: ['ACTIVE', 'PAST_DUE', 'PENDING'] } },
              data: {
                status: 'ACTIVE',
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                listingsUsedThisCycle: 0,
                leadsReceivedThisCycle: 0,
              },
            }),
          ])
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
              console.error('Asaas coupon redemption failed:', e)
            }
          }
        }
      }
      if (tx.type === 'ENTERPRISE_SPONSOR') await activateEnterpriseCycleOnPayment(tx.id)
    } else if (eventType === 'PAYMENT_OVERDUE') {
      await db.paymentTransaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED' },
      })
      if (tx.type === 'SUBSCRIPTION') {
        await db.subscription.updateMany({
          where: { externalSubId: asaasSubscriptionId || tx.externalId },
          data: { status: 'PAST_DUE' },
        })
        await notify(tx.userId, 'SYSTEM', 'Pagamento vencido', 'Sua assinatura está em atraso. Regularize para manter o acesso.', 'advertiser')
      } else if (tx.type === 'ENTERPRISE_SPONSOR') {
        await notify(tx.userId, 'SYSTEM', 'Pagamento Enterprise vencido', 'A cobrança do seu anúncio está em atraso.', 'enterprise')
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Asaas webhook error:', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
