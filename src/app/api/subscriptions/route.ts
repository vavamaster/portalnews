import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/subscriptions - get current user's subscriptions
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ subscriptions: [] })
  const subscriptions = await db.subscription.findMany({
    where: { userId: user.id },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  const quotaListings = await db.classifiedListing.count({
    where: { ownerId: user.id, status: { in: ['ACTIVE', 'PENDING'] } },
  })
  return NextResponse.json({
    subscriptions: subscriptions.map(subscription => ({ ...subscription, quotaListings })),
  })
}
