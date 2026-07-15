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

  const config = await getPointsConfig()
  const creditsToAward = Math.floor(pointsToConvert / config.creditsConversionRate)

  if (creditsToAward <= 0) {
    return NextResponse.json({ error: `Mínimo de ${config.creditsConversionRate} pontos para converter` }, { status: 400 })
  }

  const actualPointsUsed = creditsToAward * config.creditsConversionRate

  // P1-7 fix: Race-safe conditional decrement — only succeeds if user STILL has enough points.
  // Two concurrent requests cannot both pass this check because the WHERE clause is evaluated
  // atomically at UPDATE time.
  const result = await db.user.updateMany({
    where: { id: user.id, points: { gte: actualPointsUsed } },
    data: {
      points: { decrement: actualPointsUsed },
      credits: { increment: creditsToAward },
    },
  })

  if (result.count === 0) {
    // Either user doesn't exist or points dropped below threshold between read and write
    return NextResponse.json({ error: 'Pontos insuficientes' }, { status: 400 })
  }

  // Credits decremented successfully — create transaction records
  await db.$transaction([
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

  // Re-fetch updated balances for the response (authoritative post-decrement values)
  const updatedUser = await db.user.findUnique({
    where: { id: user.id },
    select: { points: true, credits: true },
  })

  return NextResponse.json({
    ok: true,
    creditsAwarded: creditsToAward,
    pointsUsed: actualPointsUsed,
    newCreditsBalance: updatedUser?.credits ?? 0,
    newPointsBalance: updatedUser?.points ?? 0,
  })
}
