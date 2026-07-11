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

    const freshUser = await db.user.findUnique({ where: { id: user.id } })
    if (!freshUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    if (freshUser.points < tier.pointsCost) {
      return NextResponse.json({
        error: `Pontos insuficientes. Você precisa de ${tier.pointsCost}, tem ${freshUser.points}.`,
      }, { status: 400 })
    }

    const boostedUntil = new Date(Date.now() + tier.days * 24 * 60 * 60 * 1000)

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { points: { decrement: tier.pointsCost } },
      }),
      db.pointTransaction.create({
        data: {
          userId: user.id,
          amount: -tier.pointsCost,
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

    return NextResponse.json({
      ok: true,
      pointsSpent: tier.pointsCost,
      boostedUntil,
      newPointsBalance: freshUser.points - tier.pointsCost,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
