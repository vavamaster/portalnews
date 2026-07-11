import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getPointsConfig } from '@/lib/seo'

// GET /api/credits - get balance and transactions
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const type = url.searchParams.get('type') // 'credits' | 'points'

  if (type === 'points') {
    const txs = await db.pointTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ balance: user.points, transactions: txs })
  }

  const txs = await db.creditTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ balance: user.credits, transactions: txs, pointsBalance: user.points, config: await getPointsConfig() })
}

// POST /api/credits - convert points to credits
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { pointsToConvert } = await req.json()
  if (!pointsToConvert || pointsToConvert <= 0) {
    return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })
  }

  const freshUser = await db.user.findUnique({ where: { id: user.id } })
  if (!freshUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  if (freshUser.points < pointsToConvert) {
    return NextResponse.json({ error: 'Pontos insuficientes' }, { status: 400 })
  }

  const config = await getPointsConfig()
  const creditsToAward = Math.floor(pointsToConvert / config.creditsConversionRate)

  if (creditsToAward <= 0) {
    return NextResponse.json({ error: `Mínimo de ${config.creditsConversionRate} pontos para converter` }, { status: 400 })
  }

  const actualPointsUsed = creditsToAward * config.creditsConversionRate

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        points: { decrement: actualPointsUsed },
        credits: { increment: creditsToAward },
      },
    }),
    db.pointTransaction.create({
      data: {
        userId: user.id,
        amount: -actualPointsUsed,
        reason: 'CONVERTED_TO_CREDITS',
      },
    }),
    db.creditTransaction.create({
      data: {
        userId: user.id,
        amount: creditsToAward,
        reason: 'CONVERTED_FROM_POINTS',
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    creditsAwarded: creditsToAward,
    pointsUsed: actualPointsUsed,
    newCreditsBalance: freshUser.credits + creditsToAward,
    newPointsBalance: freshUser.points - actualPointsUsed,
  })
}
