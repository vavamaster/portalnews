import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notify } from '@/lib/achievements'
import { activateEnterpriseCycleOnPayment } from '@/lib/enterprise-billing'
import { getGatewayConfig } from '@/lib/payment-gateway'
import { activateClassifiedSubscription, pauseListingsForUser } from '@/lib/classifieds'

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
    const gateway = await getGatewayConfig("MERCADO_PAGO")
    const accessToken = gateway?.accessToken || gateway?.apiKey
    if (!gateway || !gateway.isEnabled || !accessToken) {
      return NextResponse.json({ error: 'Gateway Mercado Pago não configurado' }, { status: 500 })
    }

    if (body.type === 'subscription_authorized_payment' && body.data?.id) {
      const authorizedId = String(body.data.id)
      const invoiceRes = await fetch(`https://api.mercadopago.com/authorized_payments/${encodeURIComponent(authorizedId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      })
      if (!invoiceRes.ok) return NextResponse.json({ ok: true, message: 'Could not verify authorized payment' })
      const invoice = await invoiceRes.json()
      if (invoice.payment?.status !== 'approved') {
        return NextResponse.json({ ok: true, message: `Authorized payment status: ${invoice.payment?.status || invoice.status}` })
      }
      const eventExternalId = `mp_authorized_${authorizedId}`
      const alreadyProcessed = await db.paymentTransaction.findFirst({ where: { externalId: eventExternalId } })
      if (alreadyProcessed) return NextResponse.json({ ok: true, message: 'Already processed' })
      const subscription = await db.subscription.findFirst({
        where: { externalSubId: String(invoice.preapproval_id), status: { in: ['PENDING', 'PAST_DUE', 'ACTIVE'] } },
        orderBy: { createdAt: 'desc' },
      })
      if (!subscription) return NextResponse.json({ ok: true, message: 'Subscription not found' })
      const originalTransaction = await db.paymentTransaction.findFirst({
        where: { userId: subscription.userId, externalId: String(invoice.preapproval_id), type: 'SUBSCRIPTION' },
        orderBy: { createdAt: 'desc' },
      })
      await activateClassifiedSubscription(subscription.id, { externalSubId: String(invoice.preapproval_id) })
      if (originalTransaction?.status === 'PENDING') {
        await db.paymentTransaction.update({
          where: { id: originalTransaction.id },
          data: { status: 'PAID', externalId: eventExternalId },
        })
        if (originalTransaction.couponId) {
          try {
            await db.$transaction([
              db.couponRedemption.create({ data: { couponId: originalTransaction.couponId, userId: originalTransaction.userId, transactionId: originalTransaction.id } }),
              db.coupon.update({ where: { id: originalTransaction.couponId }, data: { currentRedemptions: { increment: 1 } } }),
            ])
          } catch (error: any) {
            if (error?.code !== 'P2002') console.error('Mercado Pago coupon redemption failed:', error)
          }
        }
      } else {
        await db.paymentTransaction.create({
          data: {
            userId: subscription.userId,
            type: 'SUBSCRIPTION',
            amountCents: Math.round(Number(invoice.transaction_amount || 0) * 100),
            provider: 'MERCADO_PAGO',
            status: 'PAID',
            description: `Renovação automática — ${new Date().toLocaleDateString('pt-BR')}`,
            externalId: eventExternalId,
          },
        })
      }
      await notify(subscription.userId, 'SYSTEM', 'Pagamento confirmado!', 'Sua assinatura está ativa.', 'advertiser')
      return NextResponse.json({ ok: true })
    }

    if (body.type === 'subscription_preapproval' && body.data?.id) {
      const preapprovalId = String(body.data.id)
      const preapprovalRes = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(preapprovalId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      })
      if (!preapprovalRes.ok) return NextResponse.json({ ok: true, message: 'Could not verify preapproval' })
      const preapproval = await preapprovalRes.json()
      if (['canceled', 'cancelled', 'paused'].includes(preapproval.status)) {
        const canceled = await db.subscription.findMany({
          where: { externalSubId: preapprovalId },
          select: { userId: true },
        })
        await db.subscription.updateMany({
          where: { externalSubId: preapprovalId },
          data: { status: preapproval.status === 'paused' ? 'PAST_DUE' : 'CANCELED', autoRenew: false },
        })
        for (const item of canceled) {
          const otherActive = await db.subscription.findFirst({
            where: { userId: item.userId, status: 'ACTIVE', currentPeriodEnd: { gte: new Date() }, externalSubId: { not: preapprovalId } },
          })
          if (!otherActive) await pauseListingsForUser(item.userId, 'Sua assinatura Mercado Pago foi suspensa ou cancelada.')
        }
        return NextResponse.json({ ok: true })
      }
      if (preapproval.status !== 'authorized') {
        return NextResponse.json({ ok: true, message: `Preapproval status: ${preapproval.status}` })
      }
      const subscription = await db.subscription.findFirst({
        where: { externalSubId: preapprovalId, status: { in: ['PENDING', 'PAST_DUE', 'ACTIVE'] } },
        orderBy: { createdAt: 'desc' },
      })
      if (!subscription) return NextResponse.json({ ok: true, message: 'Subscription not found' })
      return NextResponse.json({ ok: true, message: 'Preapproval authorized; waiting for approved payment' })
    }

    // MP sends { type: "payment", data: { id: "123456789" } }
    if (body.type !== 'payment' || !body.data?.id) {
      return NextResponse.json({ ok: true })
    }

    const mpPaymentId = String(body.data.id)

    // C6 fix: Query MP API to get the ACTUAL payment status (don't trust webhook)
    let mpPaymentStatus: string | null = null
    let mpPayment: any = null

    if (gateway && gateway.provider === 'MERCADO_PAGO') {
      try {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        })
        if (mpRes.ok) {
          mpPayment = await mpRes.json()
          mpPaymentStatus = mpPayment.status // approved | pending | in_process | rejected | cancelled
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
        let failedTransaction = await db.paymentTransaction.findFirst({
          where: { externalId: mpPaymentId },
        })
        if (!failedTransaction && mpPayment?.metadata?.user_id) {
          failedTransaction = await db.paymentTransaction.findFirst({
            where: {
              userId: String(mpPayment.metadata.user_id),
              provider: 'MERCADO_PAGO',
              type: 'SUBSCRIPTION',
              status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
          })
        }
        if (failedTransaction && failedTransaction.status === 'PENDING') {
          await db.paymentTransaction.update({
            where: { id: failedTransaction.id },
            data: { status: 'FAILED' },
          })
          await db.subscription.updateMany({
            where: { userId: failedTransaction.userId, externalSubId: failedTransaction.externalId, status: 'PENDING' },
            data: { status: 'CANCELED', autoRenew: false },
          })
        }
      }
      return NextResponse.json({ ok: true, message: `Payment status: ${mpPaymentStatus}` })
    }

    // Payment is approved — find the transaction
    const preapprovalId = mpPayment?.subscription_id || mpPayment?.preapproval_id
    let tx = await db.paymentTransaction.findFirst({
      where: { externalId: { in: [mpPaymentId, preapprovalId].filter(Boolean).map(String) } },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!tx && mpPayment?.metadata?.user_id) {
      tx = await db.paymentTransaction.findFirst({
        where: {
          userId: String(mpPayment.metadata.user_id),
          provider: 'MERCADO_PAGO',
          type: 'SUBSCRIPTION',
          status: 'PENDING',
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      })
    }

    if (!tx) return NextResponse.json({ ok: true, message: 'Transaction not found' })

    const processedPayment = await db.paymentTransaction.findFirst({ where: { externalId: mpPaymentId } })
    const isRenewalPayment = tx.status === 'PAID' && mpPaymentId !== tx.externalId && !processedPayment
    if (tx.status !== 'PAID' || isRenewalPayment) {
      if (tx.type === 'SUBSCRIPTION') {
        const subscription = await db.subscription.findFirst({
          where: { externalSubId: preapprovalId ? String(preapprovalId) : tx.externalId, status: { in: ['ACTIVE', 'PAST_DUE', 'PENDING'] } },
          orderBy: { createdAt: 'desc' },
        })
        if (!subscription) throw new Error('Assinatura Mercado Pago correspondente não encontrada')
        await activateClassifiedSubscription(subscription.id, { externalSubId: subscription.externalSubId })
        if (isRenewalPayment) {
          await db.paymentTransaction.create({
            data: {
              userId: tx.userId,
              type: 'SUBSCRIPTION',
              amountCents: Math.round(Number(mpPayment.transaction_amount || 0) * 100),
              provider: 'MERCADO_PAGO',
              status: 'PAID',
              description: `Renovação automática — ${new Date().toLocaleDateString('pt-BR')}`,
              externalId: mpPaymentId,
            },
          })
        } else {
          await db.paymentTransaction.update({ where: { id: tx.id }, data: { status: 'PAID' } })
        }
        await notify(tx.userId, 'SYSTEM', 'Pagamento confirmado! 🎉', 'Sua assinatura está ativa.', 'advertiser')
      } else {
        await db.paymentTransaction.update({ where: { id: tx.id }, data: { status: 'PAID' } })
      }

      // P1-8 fix: record coupon redemption so coupons can't be reused indefinitely.
      // currentRedemptions is only incremented when a NEW CouponRedemption row is
      // created (unique constraint on couponId+userId prevents double-counting on
      // duplicate webhooks).
      if (tx.couponId && !isRenewalPayment) {
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
    if (tx.type === 'ENTERPRISE_SPONSOR') await activateEnterpriseCycleOnPayment(tx.id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Mercado Pago webhook error:', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
