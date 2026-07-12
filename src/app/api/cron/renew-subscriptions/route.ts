import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultGateway, createRecurringSubscription } from '@/lib/payment-gateway'
import { notify } from '@/lib/achievements'

/**
 * Cron job: renovação automática de assinaturas
 *
 * Rodar diariamente. Para cada assinatura:
 * 1. Se currentPeriodEnd < hoje e autoRenew = true → tentar cobrança recorrente
 * 2. Se currentPeriodEnd < hoje - 3 dias e status = ACTIVE → marcar como EXPIRED
 * 3. Se currentPeriodEnd < hoje - 7 dias → marcar como CANCELED
 *
 * Auth: ?key=CRON_SECRET ou Authorization: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const queryKey = url.searchParams.get('key')
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'portal-cron-2024'
  const isLocalhost = req.headers.get('host')?.startsWith('localhost')
  if (!isLocalhost) {
    if (queryKey !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
  }

  const now = new Date()
  const results = { renewed: 0, skipped: 0, pastDue: 0, expired: 0, canceled: 0, errors: [] as string[] }

  try {
    // 1. Auto-renew subscriptions that ended but have autoRenew=true
    // C7 fix: For recurring subscriptions (Stripe/Asaas/MP), the gateway charges
    // automatically each cycle. The webhook (invoice.paid / PAYMENT_RECEIVED)
    // extends the period. The cron should NOT create a new subscription.
    // The cron only marks subscriptions as PAST_DUE if the period ended
    // and no webhook has extended it yet (grace period: 3 days).
    const toRenew = await db.subscription.findMany({
      where: {
        status: 'ACTIVE',
        autoRenew: true,
        currentPeriodEnd: { lt: now },
        paymentProvider: { not: 'NONE' },
      },
      include: { plan: true, user: true },
    })

    for (const sub of toRenew) {
      try {
        // Check if the period ended more than 3 days ago (grace period)
        const daysOverdue = Math.floor((now.getTime() - new Date(sub.currentPeriodEnd).getTime()) / 86400000)

        if (daysOverdue >= 3) {
          // Mark as PAST_DUE — the webhook should have extended it by now
          await db.subscription.update({
            where: { id: sub.id },
            data: { status: 'PAST_DUE' },
          })
          await notify(sub.userId, 'SYSTEM', 'Assinatura em atraso', 'Sua assinatura está em atraso. O pagamento não foi confirmado pelo gateway.', 'advertiser')
          results.pastDue++
        } else {
          // Still within grace period — wait for webhook to confirm payment
          results.skipped++
        }
      } catch (e: any) {
        results.errors.push(`${sub.user.name}: ${e.message}`)
      }
    }

    // 2. Expire subscriptions past due for 3+ days
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000)
    const toExpire = await db.subscription.updateMany({
      where: {
        status: 'PAST_DUE',
        currentPeriodEnd: { lt: threeDaysAgo },
      },
      data: { status: 'EXPIRED' },
    })
    results.expired = toExpire.count

    // 3. Cancel subscriptions expired for 7+ days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
    const toCancel = await db.subscription.updateMany({
      where: {
        status: 'EXPIRED',
        currentPeriodEnd: { lt: sevenDaysAgo },
      },
      data: { status: 'CANCELED' },
    })
    results.canceled = toCancel.count

    // 4. M7 fix: Reset boosted/featured flags on expired classifieds
    const expiredBoosts = await db.classifiedListing.updateMany({
      where: { boosted: true, boostedUntil: { lt: now } },
      data: { boosted: false },
    })
    const expiredFeatured = await db.classifiedListing.updateMany({
      where: { featured: true, featuredUntil: { lt: now } },
      data: { featured: false },
    })
    // @ts-ignore — expiredBoosts/Featured are added to results dynamically
    results.expiredBoosts = expiredBoosts.count
    // @ts-ignore
    results.expiredFeatured = expiredFeatured.count

    return NextResponse.json({ ok: true, ...results, timestamp: now.toISOString() })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, ...results }, { status: 500 })
  }
}
