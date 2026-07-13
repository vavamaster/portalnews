/**
 * Wallet helpers — race-safe points + credits operations.
 *
 * Consolidates 3 different deduction patterns:
 * - classifieds/route.ts POST (extra listing): callback tx with user.update
 * - classifieds/[id]/boost/route.ts: array tx with user.update
 * - store/free-ad/route.ts: array tx with user.update
 *
 * All three now use the same `debitPoints()` / `debitCredits()` helpers
 * with conditional updateMany for race safety.
 */

import { db } from './db'

/**
 * Race-safe points debit. Only succeeds if the user still has enough points
 * at the time of the update (prevents concurrent requests overdrawing).
 *
 * @returns { ok: true, newBalance } on success, { ok: false, error } on insufficient balance
 */
export async function debitPoints(
  userId: string,
  amount: number,
  reason: string,
  tx?: any // optional transaction client
): Promise<{ ok: boolean; newBalance?: number; error?: string }> {
  if (amount <= 0) return { ok: false, error: 'Amount must be positive' }

  const client = tx || db
  // Conditional update: only succeeds if points >= amount
  const result = await client.user.updateMany({
    where: { id: userId, points: { gte: amount } },
    data: { points: { decrement: amount } },
  })

  if (result.count === 0) {
    return { ok: false, error: 'Pontos insuficientes' }
  }

  // Record transaction (best-effort, outside conditional)
  await client.pointTransaction.create({
    data: { userId, amount: -amount, reason },
  }).catch((e: any) => {
    console.error('[Wallet] pointTransaction create failed:', e)
  })

  // Fetch new balance
  const user = await client.user.findUnique({ where: { id: userId }, select: { points: true } })
  return { ok: true, newBalance: user?.points ?? 0 }
}

/**
 * Race-safe credits debit. Same pattern as debitPoints.
 */
export async function debitCredits(
  userId: string,
  amount: number,
  reason: string,
  tx?: any
): Promise<{ ok: boolean; newBalance?: number; error?: string }> {
  if (amount <= 0) return { ok: false, error: 'Amount must be positive' }

  const client = tx || db
  const result = await client.user.updateMany({
    where: { id: userId, credits: { gte: amount } },
    data: { credits: { decrement: amount } },
  })

  if (result.count === 0) {
    return { ok: false, error: 'Créditos insuficientes' }
  }

  await client.creditTransaction.create({
    data: { userId, amount: -amount, reason },
  }).catch((e: any) => {
    console.error('[Wallet] creditTransaction create failed:', e)
  })

  const user = await client.user.findUnique({ where: { id: userId }, select: { credits: true } })
  return { ok: true, newBalance: user?.credits ?? 0 }
}

/**
 * Credit points to a user (e.g. achievement rewards, daily check-in).
 * Always succeeds (no conditional needed for credits).
 */
export async function creditPoints(
  userId: string,
  amount: number,
  reason: string
): Promise<{ newBalance: number }> {
  if (amount <= 0) return { newBalance: 0 }

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { points: { increment: amount } },
    }),
    db.pointTransaction.create({
      data: { userId, amount, reason },
    }),
  ])

  const user = await db.user.findUnique({ where: { id: userId }, select: { points: true } })
  return { newBalance: user?.points ?? 0 }
}

/**
 * Credit credits to a user.
 */
export async function creditCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<{ newBalance: number }> {
  if (amount <= 0) return { newBalance: 0 }

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    }),
    db.creditTransaction.create({
      data: { userId, amount, reason },
    }),
  ])

  const user = await db.user.findUnique({ where: { id: userId }, select: { credits: true } })
  return { newBalance: user?.credits ?? 0 }
}
