import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notify } from '@/lib/achievements'
import { activateEnterpriseCycleOnPayment } from '@/lib/enterprise-billing'
import { getGatewayConfig } from '@/lib/payment-gateway'

/**
 * Webhook Mercado Pago — confirma pagamento automaticamente
 * Configurar: https://www.mercadopago.com.br/developers/panel/app
 * URL: https://[seu-dominio]/api/webhooks/mercadopago
 *
 * Security: verifies payment status by querying MP API (does NOT trust webhook payload).
 * MP webhooks fire for ALL status changes (pending, rejected, cancelled, approved).
 * We must GET the payment from MP API to confirm the actual status.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // MP sends { type: "payment", data: { id: "123456789" } }
    if (body.type !== 'payment' || !body.data?.id) {
      // Could also be { type: "subscription_preapproval", ... } for recurring
      if (body.type === 'subscription_preapproval' && body.data?.id) {
        return NextResponse.json({ ok: true }) // handle preapproval events separately
      }
      return NextResponse.json({ ok: true })
    }

    const mpPaymentId = String(body.data.id)

    // C6 fix: Query MP API to get the ACTUAL payment status (don't trust webhook)
    const gateway = await getGatewayConfig("MERCADO_PAGO")
    let mpPaymentStatus: string | null = null

    if (gateway && gateway.provider === 'MERCADO_PAGO') {
      try {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
          headers: { Authorization: `Bearer ${gateway.apiKey}` },
          signal: AbortSignal.timeout(10000),
        })
        if (mpRes.ok) {
          const mpData = await mpRes.json()
          mpPaymentStatus = mpData.status // approved | pending | in_process | rejected | cancelled
        }
      } catch (e) {
        console.error('MP API query failed:', e)
        // If we can't verify, don't activate — safer to wait
        return NextResponse.json({ ok: true, message: 'Could not verify payment status' })
      }
    }

    // Only proceed if payment is approved
    if (mpPaymentStatus !== 'approved') {
      // Handle rejection
      if (mpPaymentStatus === 'rejected' || mpPaymentStatus === 'cancelled') {
        const tx = await db.paymentTransaction.findFirst({
          where: { externalId: mpPaymentId },
        })
        if (tx && tx.status === 'PENDING') {
          await db.paymentTransaction.update({
            where: { id: tx.id },
            data: { status: 'FAILED' },
          })
        }
      }
      return NextResponse.json({ ok: true, message: `Payment status: ${mpPaymentStatus}` })
    }

    // Payment is approved — find the transaction
    const tx = await db.paymentTransaction.findFirst({
      where: { externalId: mpPaymentId },
      include: { user: true },
    })

    if (!tx) return NextResponse.json({ ok: true, message: 'Transaction not found' })

    if (tx.status !== 'PAID') {
      await db.$transaction([
        db.paymentTransaction.update({
          where: { id: tx.id },
          data: { status: 'PAID' },
        }),
        db.subscription.updateMany({
          where: { externalSubId: tx.externalId, status: { in: ['ACTIVE', 'PAST_DUE', 'PENDING'] } },
          data: {
            status: 'ACTIVE',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            listingsUsedThisCycle: 0,
            leadsReceivedThisCycle: 0,
          },
        }),
      ])

      await notify(tx.userId, 'SYSTEM', 'Pagamento confirmado! 🎉', 'Sua assinatura está ativa.', 'advertiser')
      await activateEnterpriseCycleOnPayment(tx.id)

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
            console.error('Mercado Pago coupon redemption failed:', e)
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Mercado Pago webhook error:', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
