import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { checkAndAwardAchievement } from '@/lib/achievements'

// GET - user's favorites (only ACTIVE listings, with status badge for others)
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
  // Don't filter out non-ACTIVE listings — show them with a badge so the user knows
  // they're unavailable. The detail view will show appropriate messaging.
  return NextResponse.json({ favorites })
}

// POST - toggle favorite on a listing
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login para favoritar' }, { status: 401 })
    const { listingId } = await req.json()
    if (!listingId || typeof listingId !== 'string') {
      return NextResponse.json({ error: 'listingId obrigatório' }, { status: 400 })
    }

    const existing = await db.favorite.findUnique({
      where: { userId_listingId: { userId: user.id, listingId } },
    })
    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } })
      return NextResponse.json({ action: 'removed' })
    }

    // Validate listing exists and is favoritable (ACTIVE only — favoriting a
    // PAUSED/EXPIRED listing that the user can't see makes no sense)
    const listing = await db.classifiedListing.findUnique({
      where: { id: listingId },
      select: { id: true, status: true, ownerId: true, expiresAt: true },
    })
    if (!listing) {
      return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
    }
    if (listing.status !== 'ACTIVE' || !listing.expiresAt || listing.expiresAt <= new Date()) {
      return NextResponse.json({ error: 'Anúncio não está disponível para favoritar' }, { status: 400 })
    }

    await db.favorite.create({ data: { userId: user.id, listingId } })
    // check achievement
    try {
      await checkAndAwardAchievement(user.id, 'FIRST_FAVORITE')
    } catch (e) {
      console.error('Achievement check failed:', e)
    }

    return NextResponse.json({ action: 'added' })
  } catch (e: any) {
    console.error('Favorite toggle error:', e)
    return NextResponse.json({ error: 'Erro ao favoritar' }, { status: 500 })
  }
}
