import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/header-ads/serve?position=below-nav
// Returns the active ad for the given position (considers scheduling, days, hours)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const position = url.searchParams.get('position') || 'below-nav'

  const now = new Date()
  const dayOfWeek = now.getDay().toString() // 0=Sunday
  const hourMin = now.getHours() * 60 + now.getMinutes()

  // Fetch all active ads for this position
  const ads = await db.headerAd.findMany({
    where: {
      isActive: true,
      position,
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })

  // Filter by days of week and hour range
  const eligible = ads.filter(ad => {
    if (ad.daysOfWeek) {
      const days = ad.daysOfWeek.split(',').map(d => d.trim())
      if (!days.includes(dayOfWeek)) return false
    }
    if (ad.hourRange) {
      const match = ad.hourRange.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
      if (match) {
        const [, h1, m1, h2, m2] = match
        const start = parseInt(h1) * 60 + parseInt(m1)
        const end = parseInt(h2) * 60 + parseInt(m2)
        if (hourMin < start || hourMin > end) return false
      }
    }
    return true
  })

  if (eligible.length === 0) {
    return NextResponse.json({ ad: null })
  }

  const ad = eligible[0]

  // Increment impressions (fire-and-forget)
  db.headerAd.update({
    where: { id: ad.id },
    data: { impressions: { increment: 1 } },
  }).catch(() => {})

  // Parse images field
  let images: any = ad.images
  try {
    images = JSON.parse(ad.images)
  } catch {
    images = ad.type === 'slider' ? [{ url: ad.images, link: ad.linkUrl }] : ad.images
  }

  return NextResponse.json({
    ad: {
      id: ad.id,
      name: ad.name,
      type: ad.type,
      images,
      linkUrl: ad.linkUrl,
      animation: ad.animation,
      slideInterval: ad.slideInterval,
      position: ad.position,
      openNewTab: ad.openNewTab,
      widthHint: ad.widthHint,
      heightHint: ad.heightHint,
    },
  })
}

// POST /api/header-ads/serve — track click
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { adId } = body
  if (!adId) return NextResponse.json({ error: 'adId required' }, { status: 400 })

  db.headerAd.update({
    where: { id: adId },
    data: { clicks: { increment: 1 } },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
