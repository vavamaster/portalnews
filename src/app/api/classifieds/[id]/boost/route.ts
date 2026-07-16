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
    if (listing.status !== 'ACTIVE' || !listing.expiresAt || listing.expiresAt <= new Date()) {
      return NextResponse.json({ error: 'Somente anúncios ativos e dentro da validade podem ser impulsionados' }, { status: 400 })
    }
    const subscription = await db.subscription.findFirst({
      where: { userId: user.id, status: 'ACTIVE', currentPeriodEnd: { gte: new Date() } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!subscription) return NextResponse.json({ error: 'Assinatura ativa não encontrada' }, { status: 403 })
    const activePlan = subscription.plan
    if (!activePlan.allowBoost) {
      return NextResponse.json({
        error: `Seu plano (${activePlan.name}) não permite boost. Faça upgrade.`,
      }, { status: 403 })
    }

    // A5 fix: Use plan-specific boost costs if available, fall back to global BOOST_TIERS
    let pointsCost: number = tier.pointsCost
    if (tierId === '3d' && activePlan.pointsPerBoost3d) {
      pointsCost = activePlan.pointsPerBoost3d
    } else if (tierId === '7d' && activePlan.pointsPerBoost7d) {
      pointsCost = activePlan.pointsPerBoost7d
    } else if (tierId === '15d' && activePlan.pointsPerBoost15d) {
      pointsCost = activePlan.pointsPerBoost15d
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
    let newPointsBalance = freshUser.points
    try {
      await db.$transaction(async tx => {
        const debitResult = await debitPoints(user.id, pointsCost, 'CLASSIFIED_BOOST', tx)
        if (!debitResult.ok) throw new Error('INSUFFICIENT_POINTS')
        newPointsBalance = debitResult.newBalance ?? (freshUser.points - pointsCost)
        await tx.classifiedListing.update({
          where: { id },
          data: { boosted: true, boostedUntil },
        })
      })
    } catch (error: any) {
      if (error?.message !== 'INSUFFICIENT_POINTS') throw error
      return NextResponse.json({
        error: `Pontos insuficientes. Você precisa de ${pointsCost}, tem ${freshUser.points}.`,
      }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      pointsSpent: pointsCost,
      boostedUntil,
      newPointsBalance,
      extended: listing.boosted && listing.boostedUntil && new Date(listing.boostedUntil) > now,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
