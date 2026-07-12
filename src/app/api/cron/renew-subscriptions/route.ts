import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notify } from '@/lib/achievements'

/**
 * Cron job: renovação automática de assinaturas
 *
 * Rodar diariamente. Para cada assinatura:
 * 1. Se currentPeriodEnd < hoje - 3 dias e status = ACTIVE → marcar como PAST_DUE
 * 2. Se PAST_DUE por 7+ dias após o fim do período → marcar como EXPIRED
 * 3. Se EXPIRED por 14+ dias após o fim do período → marcar como CANCELED
 * 4. Reset boosted/featured flags when their windows expire
 * 5. Expire classifieds past their expiresAt date
 * 6. Pause classifieds for users WITHOUT any active subscription (NOT just users with an expired one — they may have re-subscribed)
 * 7. Resume classifieds for users whose subscription became active again
 *
 * Auth: ?key=CRON_SECRET ou Authorization: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const queryKey = url.searchParams.get('key')
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 })
  }
  // Timing-safe-ish comparison (constant-time would require crypto.timingSafeEqual with length check)
  const providedKey = queryKey || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '')
  if (!providedKey || providedKey.length !== cronSecret.length || providedKey !== cronSecret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const now = new Date()
  const results = {
    renewed: 0, skipped: 0, pastDue: 0, expired: 0, canceled: 0,
    expiredBoosts: 0, expiredFeatured: 0, expiredListings: 0,
    pausedListings: 0, resumedListings: 0,
    notifiedUsers: 0,
    errors: [] as string[],
  }

  try {
    // === 1. Auto-renew handling: mark PAST_DUE after 3-day grace period ===
    // For gateway subscriptions (Stripe/Asaas/MP), the webhook (invoice.paid /
    // PAYMENT_RECEIVED) should have extended currentPeriodEnd before it lapsed.
    // If we're past currentPeriodEnd + 3 days and the webhook hasn't extended,
    // mark as PAST_DUE so the user gets notified and listings can be paused.
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000)
    const pastDueSubs = await db.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lt: threeDaysAgo },
      },
      include: { plan: true, user: true },
    })

    for (const sub of pastDueSubs) {
      try {
        await db.subscription.update({
          where: { id: sub.id },
          data: { status: 'PAST_DUE' },
        })
        await notify(
          sub.userId,
          'SYSTEM',
          'Assinatura em atraso',
          `Sua assinatura ${sub.plan.name} está em atraso. O pagamento não foi confirmado — seus anúncios serão pausados em alguns dias. Acesse o painel para regularizar.`,
          'advertiser',
        )
        results.pastDue++
        results.notifiedUsers++
      } catch (e: any) {
        results.errors.push(`PAST_DUE ${sub.userId}: ${e.message}`)
      }
    }

    // === 2. EXPIRE subscriptions that have been PAST_DUE for 4+ more days (7 days past end) ===
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
    const toExpire = await db.subscription.findMany({
      where: {
        status: 'PAST_DUE',
        currentPeriodEnd: { lt: sevenDaysAgo },
      },
      include: { plan: true },
    })
    for (const sub of toExpire) {
      try {
        await db.subscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRED' },
        })
        await notify(
          sub.userId,
          'SYSTEM',
          'Assinatura expirada',
          `Sua assinatura ${sub.plan.name} expirou. Seus anúncios ativos foram pausados. Renove para reativá-los.`,
          'plans',
        )
        results.expired++
        results.notifiedUsers++
      } catch (e: any) {
        results.errors.push(`EXPIRE ${sub.userId}: ${e.message}`)
      }
    }

    // === 3. CANCEL subscriptions that have been EXPIRED for 7+ more days (14 days past end) ===
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000)
    const toCancel = await db.subscription.updateMany({
      where: {
        status: 'EXPIRED',
        currentPeriodEnd: { lt: fourteenDaysAgo },
      },
      data: { status: 'CANCELED' },
    })
    results.canceled = toCancel.count

    // === 4. Reset boosted/featured flags when their windows expire ===
    const expiredBoosts = await db.classifiedListing.updateMany({
      where: { boosted: true, boostedUntil: { lt: now } },
      data: { boosted: false },
    })
    results.expiredBoosts = expiredBoosts.count

    const expiredFeatured = await db.classifiedListing.updateMany({
      where: { featured: true, featuredUntil: { lt: now } },
      data: { featured: false },
    })
    results.expiredFeatured = expiredFeatured.count

    // === 5. Expire classifieds past their expiresAt date ===
    const expiredListings = await db.classifiedListing.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    })
    results.expiredListings = expiredListings.count

    // === 6. Pause classifieds for users WITHOUT any ACTIVE subscription ===
    // CRITICAL FIX: previously this paused listings for ANY user with an EXPIRED/CANCELED sub,
    // even if they had since bought a NEW active subscription. Now we only pause for users
    // who have NO active subscription at all.
    const usersWithActiveSub = await db.subscription.findMany({
      where: { status: 'ACTIVE', currentPeriodEnd: { gte: now } },
      select: { userId: true },
    })
    const activeUserIds = new Set(usersWithActiveSub.map(s => s.userId))

    // Find users with ACTIVE listings but no ACTIVE subscription
    // Use groupBy instead of distinct+select (Prisma doesn't support distinct in select)
    const usersWithActiveListings = await db.classifiedListing.groupBy({
      by: ['ownerId'],
      where: { status: 'ACTIVE' },
    })
    const usersToPauseFor = usersWithActiveListings
      .map(g => g.ownerId)
      .filter(uid => !activeUserIds.has(uid))

    if (usersToPauseFor.length > 0) {
      const pausedListings = await db.classifiedListing.updateMany({
        where: { ownerId: { in: usersToPauseFor }, status: 'ACTIVE' },
        data: { status: 'PAUSED' },
      })
      results.pausedListings = pausedListings.count

      // Notify each affected user (deduped)
      for (const userId of [...new Set(usersToPauseFor)]) {
        try {
          await notify(
            userId,
            'SYSTEM',
            'Anúncios pausados',
            'Sua assinatura não está ativa. Seus anúncios foram pausados. Renove o plano para reativá-los.',
            'plans',
          )
          results.notifiedUsers++
        } catch {}
      }
    }

    // === 7. Resume classifieds for users whose subscription became active again ===
    // Symmetric to step 6: if a user has an ACTIVE subscription and PAUSED listings
    // (paused due to expired sub), resume them automatically.
    if (activeUserIds.size > 0) {
      const resumedListings = await db.classifiedListing.updateMany({
        where: {
          ownerId: { in: Array.from(activeUserIds) },
          status: 'PAUSED',
          // Don't resume EXPIRED (past their expiresAt) or SOLD listings
        },
        data: { status: 'ACTIVE' },
      })
      results.resumedListings = resumedListings.count

      // Notify users whose listings were resumed
      if (resumedListings.count > 0) {
        const resumedUsers = await db.classifiedListing.groupBy({
          by: ['ownerId'],
          where: {
            ownerId: { in: Array.from(activeUserIds) },
            status: 'ACTIVE',
          },
        })
        for (const { ownerId } of resumedUsers) {
          try {
            await notify(
              ownerId,
              'SYSTEM',
              'Anúncios reativados',
              'Sua assinatura está ativa novamente. Seus anúncios foram reativados automaticamente.',
              'advertiser',
            )
          } catch {}
        }
      }
    }

    return NextResponse.json({ ok: true, ...results, timestamp: now.toISOString() })
  } catch (e: any) {
    console.error('Cron renew-subscriptions error:', e)
    return NextResponse.json({ error: e.message, ...results }, { status: 500 })
  }
}
