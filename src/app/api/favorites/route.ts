import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { checkAndAwardAchievement } from '@/lib/achievements'

// GET - user's favorites
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ favorites: [] })
  const favorites = await db.favorite.findMany({
    where: { userId: user.id },
    include: {
      listing: {
        include: {
          category: true,
          plan: true,
          owner: { select: { id: true, name: true, avatar: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ favorites })
}

// POST - favorite a listing
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login para favoritar' }, { status: 401 })
    const { listingId } = await req.json()
    if (!listingId) return NextResponse.json({ error: 'listingId obrigatório' }, { status: 400 })

    const existing = await db.favorite.findUnique({
      where: { userId_listingId: { userId: user.id, listingId } },
    })
    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } })
      return NextResponse.json({ action: 'removed' })
    }

    await db.favorite.create({ data: { userId: user.id, listingId } })
    // check achievement
    await checkAndAwardAchievement(user.id, 'FIRST_FAVORITE')

    return NextResponse.json({ action: 'added' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
