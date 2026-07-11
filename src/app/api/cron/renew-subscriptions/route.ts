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
  const results = { renewed: 0, expired: 0, canceled: 0, errors: [] as string[] }

  try {
    // 1. Auto-renew subscriptions that ended but have autoRenew=true
    const toRenew = await db.subscription.findMany({
      where: {
        status: 'ACTIVE',
        autoRenew: true,
        currentPeriodEnd: { lt: now },
        paymentProvider: { not: 'NONE' },
      },
      include: { plan: true, user: true },
    })

    const gateway = await getDefaultGateway()

    for (const sub of toRenew) {
      try {
        if (gateway && sub.paymentProvider === gateway.provider) {
          // Try real recurring charge via gateway
          const result = await createRecurringSubscription(gateway, {
            userId: sub.userId,
            userName: sub.user.name,
            userEmail: sub.user.email,
            planName: sub.plan.name,
            amountCents: sub.plan.priceCents,
            paymentMethod: 'PIX',
            billingCycle: 'MONTHLY',
          })

          if (result.success) {
            // Extend period
            await db.subscription.update({
              where: { id: sub.id },
              data: {
                currentPeriodStart: now,
                currentPeriodEnd: new Date(now.getTime() + 30 * 86400000),
                listingsUsedThisCycle: 0,
                leadsReceivedThisCycle: 0,
              },
            })
            await db.paymentTransaction.create({
              data: {
                userId: sub.userId, type: 'SUBSCRIPTION',
                amountCents: sub.plan.priceCents, provider: gateway.provider,
                status: 'PENDING', description: `Renovação automática — ${sub.plan.name}`,
                externalId: result.externalId,
              },
            })
            results.renewed++
          } else {
            // Charge failed — mark as past_due
            await db.subscription.update({
              where: { id: sub.id },
              data: { status: 'PAST_DUE' },
            })
            await notify(sub.userId, 'SYSTEM', 'Renovação falhou', `Não foi possível cobrar sua assinatura. ${result.message}`, 'advertiser')
            results.errors.push(`${sub.user.name}: ${result.message}`)
          }
        } else {
          // No gateway or different provider — mock renew
          await db.subscription.update({
            where: { id: sub.id },
            data: {
              currentPeriodStart: now,
              currentPeriodEnd: new Date(now.getTime() + 30 * 86400000),
              listingsUsedThisCycle: 0,
              leadsReceivedThisCycle: 0,
            },
          })
          results.renewed++
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

    return NextResponse.json({ ok: true, ...results, timestamp: now.toISOString() })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, ...results }, { status: 500 })
  }
}
