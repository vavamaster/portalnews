import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getPointsConfig } from '@/lib/seo'

// POST /api/reading - track reading progress & award points (capped per post)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ ok: true, awarded: 0 }) // silent skip for guests

    const { postId, readPct, duration } = await req.json()
    if (!postId) return NextResponse.json({ error: 'postId obrigatório' }, { status: 400 })

    const post = await db.post.findUnique({ where: { id: postId } })
    if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })

    const config = await getPointsConfig()
    const pct = Math.max(0, Math.min(100, readPct || 0))

    const existing = await db.readingHistory.findUnique({
      where: { userId_postId: { userId: user.id, postId } },
    })

    if (existing) {
      // update tracking - award additional points only if crossing thresholds
      // Strategy: award per 25% read milestones, capped at config.maxReadsPerPost total
      const previousMilestones = Math.floor(existing.readPct / 25)
      const currentMilestones = Math.floor(pct / 25)
      const newMilestones = Math.max(0, currentMilestones - previousMilestones)

      // remaining points allowed = maxReadsPerPost - already awarded
      const remainingAllowed = Math.max(0, config.maxReadsPerPost - existing.points)
      const pointsToAward = Math.min(newMilestones * config.pointsPerRead, remainingAllowed)

      await db.readingHistory.update({
        where: { id: existing.id },
        data: {
          readPct: Math.max(existing.readPct, pct),
          duration: (existing.duration || 0) + (duration || 0),
          points: existing.points + pointsToAward,
        },
      })

      if (pointsToAward > 0) {
        await db.$transaction([
          db.user.update({
            where: { id: user.id },
            data: { points: { increment: pointsToAward } },
          }),
          db.pointTransaction.create({
            data: {
              userId: user.id,
              amount: pointsToAward,
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
      return NextResponse.json({ awarded: pointsToAward, totalEarned: existing.points + pointsToAward, cap: config.maxReadsPerPost })
    }

    // first time reading - award initial points based on pct
    const milestones = Math.floor(pct / 25)
    const pointsToAward = Math.min(milestones * config.pointsPerRead, config.maxReadsPerPost)

    await db.readingHistory.create({
      data: {
        userId: user.id,
        postId,
        readPct: pct,
        duration: duration || 0,
        points: pointsToAward,
      },
    })

    if (pointsToAward > 0) {
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: { points: { increment: pointsToAward } },
        }),
        db.pointTransaction.create({
          data: {
            userId: user.id,
            amount: pointsToAward,
            reason: 'READING',
            postId,
          },
        }),
      ])
    }

    return NextResponse.json({ awarded: pointsToAward, totalEarned: pointsToAward, cap: config.maxReadsPerPost })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
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
