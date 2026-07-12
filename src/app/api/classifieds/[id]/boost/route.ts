import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { BOOST_TIERS } from '@/lib/plans'

// POST /api/classifieds/[id]/boost - boost a listing using points
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const { tierId } = body
    const tier = BOOST_TIERS.find(t => t.id === tierId)
    if (!tier) {
      return NextResponse.json({ error: 'Tier inválido' }, { status: 400 })
    }

    const listing = await db.classifiedListing.findUnique({
      where: { id },
      include: { plan: true },
    })
    if (!listing) return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
    if (listing.ownerId !== user.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    if (!listing.plan.allowBoost) {
      return NextResponse.json({
        error: `Seu plano (${listing.plan.name}) não permite boost. Faça upgrade.`,
      }, { status: 403 })
    }
    // Business rule: cannot boost a non-ACTIVE listing (would waste points on invisible ad)
    if (listing.status !== 'ACTIVE') {
      return NextResponse.json({
        error: `Não é possível impulsionar um anúncio ${listing.status === 'PAUSED' ? 'pausado' : listing.status === 'EXPIRED' ? 'expirado' : listing.status === 'SOLD' ? 'vendido' : 'inativo'}. Ative o anúncio primeiro.`,
      }, { status: 400 })
    }

    // A5 fix: Use plan-specific boost costs if available, fall back to global BOOST_TIERS
    let pointsCost: number = tier.pointsCost
    if (tierId === '3d' && listing.plan.pointsPerBoost3d) {
      pointsCost = listing.plan.pointsPerBoost3d
    } else if (tierId === '7d' && listing.plan.pointsPerBoost7d) {
      pointsCost = listing.plan.pointsPerBoost7d
    } else if (tierId === '15d' && listing.plan.pointsPerBoost15d) {
      pointsCost = listing.plan.pointsPerBoost15d
    }

    const freshUser = await db.user.findUnique({ where: { id: user.id } })
    if (!freshUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    if (freshUser.points < pointsCost) {
      return NextResponse.json({
        error: `Pontos insuficientes. Você precisa de ${pointsCost}, tem ${freshUser.points}.`,
      }, { status: 400 })
    }

    // M1+M2 fix: If listing is already boosted, add days to the existing boostedUntil
    // instead of overwriting it. This prevents losing remaining days.
    const now = new Date()
    let baseDate = now
    if (listing.boosted && listing.boostedUntil && new Date(listing.boostedUntil) > now) {
      // Already boosted with remaining time — extend from current end date
      baseDate = new Date(listing.boostedUntil)
    }
    const boostedUntil = new Date(baseDate.getTime() + tier.days * 24 * 60 * 60 * 1000)

    await db.$transaction([
      // Race-safe points decrement: only succeeds if user still has enough points
      db.user.updateMany({
        where: { id: user.id, points: { gte: pointsCost } },
        data: { points: { decrement: pointsCost } },
      }),
      db.pointTransaction.create({
        data: {
          userId: user.id,
          amount: -pointsCost,
          reason: 'CLASSIFIED_BOOST',
        },
      }),
      db.classifiedListing.update({
        where: { id },
        data: {
          boosted: true,
          boostedUntil,
        },
      }),
    ])
    // Verify the points decrement actually happened (updateMany returns count)
    // We need to re-check via a separate query since $transaction array form doesn't return counts
    const updatedUser = await db.user.findUnique({ where: { id: user.id } })
    if (!updatedUser) {
      return NextResponse.json({ error: 'Usuário não encontrado após boost' }, { status: 500 })
    }
    // If balance is lower than expected (decrement succeeded), proceed normally.
    // If updateMany matched 0 rows (insufficient points), the listing.update still ran — undo it.
    if (updatedUser.points > freshUser.points - pointsCost) {
      // Decrement didn't happen — revert listing update
      await db.classifiedListing.update({
        where: { id },
        data: {
          boosted: listing.boosted,
          boostedUntil: listing.boostedUntil,
        },
      })
      return NextResponse.json({
        error: `Pontos insuficientes. Você precisa de ${pointsCost}, tem ${freshUser.points}.`,
      }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      pointsSpent: pointsCost,
      boostedUntil,
      newPointsBalance: freshUser.points - pointsCost,
      extended: listing.boosted && listing.boostedUntil && new Date(listing.boostedUntil) > now,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
