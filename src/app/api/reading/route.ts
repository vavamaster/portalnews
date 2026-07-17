import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getPointsConfig } from '@/lib/seo'
import { consumeRequestLimit } from '@/lib/request-rate-limit'

// POST /api/reading - track reading progress & award points (capped per post)
// P1-7 fix: race-safe — uses conditional updateMany so two concurrent requests
// cannot both pass the milestone check and double-award points.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ ok: true, awarded: 0 }) // silent skip for guests

    const rateLimit = await consumeRequestLimit(req, {
      scope: 'reading-user', subject: user.id, includeIp: false, limit: 300, windowSeconds: 60 * 60,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Limite de atualizações de leitura atingido' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    const { postId, readPct, duration } = await req.json()
    if (!postId) return NextResponse.json({ error: 'postId obrigatório' }, { status: 400 })

    const post = await db.post.findUnique({ where: { id: postId } })
    if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })

    const config = await getPointsConfig()
    const pct = Math.max(0, Math.min(100, readPct || 0))

    // === Resolve the existing reading-history row ===
    // The unique constraint on (userId, postId) protects against double-creates;
    // we catch P2002 and re-read so a lost race degrades to an update path.
    let existing = await db.readingHistory.findUnique({
      where: { userId_postId: { userId: user.id, postId } },
    })

    if (!existing) {
      try {
        existing = await db.readingHistory.create({
          data: {
            userId: user.id,
            postId,
            readPct: pct,
            duration: duration || 0,
            points: 0,
          },
        })
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e
        // Another concurrent request created it first — re-read.
        existing = await db.readingHistory.findUnique({
          where: { userId_postId: { userId: user.id, postId } },
        })
        if (!existing) {
          return NextResponse.json({ error: 'Internal error' }, { status: 500 })
        }
      }
    }

    // === Compute desired award based on (possibly stale) snapshot ===
    const previousMilestones = Math.floor(existing.readPct / 25)
    const currentMilestones = Math.floor(pct / 25)
    const newMilestones = Math.max(0, currentMilestones - previousMilestones)
    const remainingAllowed = Math.max(0, config.maxReadsPerPost - existing.points)
    const desiredAward = Math.min(newMilestones * config.pointsPerRead, remainingAllowed)

    let awarded = 0

    if (desiredAward > 0) {
      // === Conditional update: only succeeds if readPct hasn't already been advanced to pct
      // (prevents double-award when two identical concurrent requests both saw readPct < pct)
      // AND if awarding wouldn't exceed the per-post cap.
      const updateResult = await db.readingHistory.updateMany({
        where: {
          id: existing.id,
          readPct: { lt: pct },
          points: { lte: config.maxReadsPerPost - desiredAward },
        },
        data: {
          readPct: { set: pct },
          duration: { increment: duration || 0 },
          points: { increment: desiredAward },
        },
      })

      if (updateResult.count > 0) {
        awarded = desiredAward
        await db.$transaction([
          db.user.update({
            where: { id: user.id },
            data: { points: { increment: desiredAward } },
          }),
          db.pointTransaction.create({
            data: {
              userId: user.id,
              amount: desiredAward,
              reason: 'READING',
              postId,
            },
          }),
        ])
        // check achievements (outside transaction to avoid issues)
        try {
          const { autoCheckAchievements } = await import('@/lib/achievements')
          await autoCheckAchievements(user.id)
        } catch (e) { console.error('Achievement check failed:', e) }
      }
      // else: a concurrent request already advanced readPct — no award.
    } else {
      // No new milestones — just advance tracking fields (conditionally, to avoid
      // overwriting a higher readPct set by a concurrent request).
      await db.readingHistory.updateMany({
        where: { id: existing.id, readPct: { lt: pct } },
        data: {
          readPct: { set: pct },
          duration: { increment: duration || 0 },
        },
      })
    }

    return NextResponse.json({
      awarded,
      totalEarned: existing.points + awarded,
      cap: config.maxReadsPerPost,
    })
  } catch (error) {
    console.error('[reading] unexpected error:', error)
    return NextResponse.json({ error: 'Não foi possível atualizar a leitura' }, { status: 500 })
  }
}

// GET /api/reading - get reading history for current user
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ history: [] })
  const history = await db.readingHistory.findMany({
    where: { userId: user.id },
    include: { post: { select: { id: true, title: true, slug: true, coverImage: true, category: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 30,
  })
  return NextResponse.json({ history })
}
