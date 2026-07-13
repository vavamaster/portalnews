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

    // === Race-safe points debit via consolidated wallet helper ===
    const { debitPoints } = await import('@/lib/wallet')
    const debitResult = await debitPoints(user.id, pointsCost, 'CLASSIFIED_BOOST')
    if (!debitResult.ok) {
      return NextResponse.json({
        error: `Pontos insuficientes. Você precisa de ${pointsCost}, tem ${freshUser.points}.`,
      }, { status: 400 })
    }

    // Update listing (separate from points — both already committed)
    await db.classifiedListing.update({
      where: { id },
      data: {
        boosted: true,
        boostedUntil,
      },
    })

    return NextResponse.json({
      ok: true,
      pointsSpent: pointsCost,
      boostedUntil,
      newPointsBalance: debitResult.newBalance ?? (freshUser.points - pointsCost),
      extended: listing.boosted && listing.boostedUntil && new Date(listing.boostedUntil) > now,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
