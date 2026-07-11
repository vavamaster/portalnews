import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { performCheckIn, autoCheckAchievements } from '@/lib/achievements'

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login' }, { status: 401 })

    const result = await performCheckIn(user.id)
    // refresh user data
    const { db } = await import('@/lib/db')
    const updated = await db.user.findUnique({ where: { id: user.id } })
    const meRes = NextResponse.json({
      ...result,
      user: updated ? {
        id: updated.id, email: updated.email, name: updated.name, role: updated.role,
        avatar: updated.avatar, points: updated.points, credits: updated.credits,
        lastCheckInAt: updated.lastCheckInAt, checkInStreak: updated.checkInStreak,
      } : null,
    })
    return meRes
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ canCheckIn: false })
  const { db } = await import('@/lib/db')
  const u = await db.user.findUnique({ where: { id: user.id } })
  if (!u) return NextResponse.json({ canCheckIn: false })

  const today = new Date()
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const lastCheckIn = u.lastCheckInAt ? new Date(u.lastCheckInAt) : null
  const lastCheckInDay = lastCheckIn ? new Date(lastCheckIn.getFullYear(), lastCheckIn.getMonth(), lastCheckIn.getDate()) : null
  const canCheckIn = !lastCheckInDay || lastCheckInDay.getTime() !== todayDay.getTime()

  let nextMultiplier = 1
  let nextStreak = 1
  if (lastCheckInDay) {
    const yesterday = new Date(todayDay.getTime() - 24 * 60 * 60 * 1000)
    if (lastCheckInDay.getTime() === yesterday.getTime()) {
      nextStreak = (u.checkInStreak || 0) + 1
    }
  }
  if (nextStreak >= 30) nextMultiplier = 3
  else if (nextStreak >= 7) nextMultiplier = 2
  else if (nextStreak >= 3) nextMultiplier = 1.5

  return NextResponse.json({
    canCheckIn,
    streak: u.checkInStreak,
    lastCheckInAt: u.lastCheckInAt,
    nextMultiplier,
    nextStreak,
    nextPoints: Math.round(10 * nextMultiplier),
  })
}
