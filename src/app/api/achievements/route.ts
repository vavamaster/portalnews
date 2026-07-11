import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { ACHIEVEMENTS, autoCheckAchievements } from '@/lib/achievements'

// GET - all achievements + user's earned ones
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ achievements: [], earned: [] })

  const [allAchievements, userAchievements] = await Promise.all([
    db.achievement.findMany({ orderBy: { category: 'asc' } }),
    db.userAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    }),
  ])

  const earnedSlugs = userAchievements.map(ua => ua.achievement.slug)
  const earned = userAchievements.map(ua => ({
    ...ua.achievement,
    earnedAt: ua.earnedAt,
  }))

  return NextResponse.json({
    achievements: allAchievements.map(a => ({ ...a, earned: earnedSlugs.includes(a.slug) })),
    earned,
    totalEarned: earned.length,
    totalPossible: allAchievements.length,
    totalPointsEarned: earned.reduce((sum, a) => sum + a.pointsReward, 0),
  })
}

// POST - manually trigger achievement check (e.g. after profile update)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { awarded } = await autoCheckAchievements(user.id)
  return NextResponse.json({ newlyAwarded: awarded })
}
