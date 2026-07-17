import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createAdTrackingToken, consumeAdTrackingToken, recordHeaderAdMetric } from '@/lib/ad-tracking'

const POSITIONS = new Set(['above-brand', 'below-brand', 'below-nav', 'replace-ticker'])

// GET /api/header-ads/serve?position=below-nav
export async function GET(req: NextRequest) {
  const position = new URL(req.url).searchParams.get('position') || 'below-nav'
  if (!POSITIONS.has(position)) return NextResponse.json({ error: 'Posição inválida' }, { status: 400 })

  const now = new Date()
  const dayOfWeek = now.getDay().toString()
  const hourMin = now.getHours() * 60 + now.getMinutes()
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

  const eligible = ads.filter(ad => {
    if (ad.daysOfWeek && !ad.daysOfWeek.split(',').map(day => day.trim()).includes(dayOfWeek)) return false
    if (ad.hourRange) {
      const match = ad.hourRange.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/)
      if (!match) return false
      const start = Number(match[1]) * 60 + Number(match[2])
      const end = Number(match[3]) * 60 + Number(match[4])
      if (hourMin < start || hourMin > end) return false
    }
    return true
  })

  if (eligible.length === 0) {
    return NextResponse.json({ ad: null }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const ad = eligible[0]
  let images: unknown = ad.images
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
      trackingToken: createAdTrackingToken(ad.id, 'header'),
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/header-ads/serve - record a rendered impression or a click
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { adId, token, action } = body
  if (typeof adId !== 'string' || !['impression', 'click'].includes(action)) {
    return NextResponse.json({ error: 'Dados de tracking inválidos' }, { status: 400 })
  }
  if (!await consumeAdTrackingToken(token, adId, action, 'header')) {
    return NextResponse.json({ error: 'Token de tracking inválido ou reutilizado' }, { status: 403 })
  }
  const recorded = await recordHeaderAdMetric(adId, action)
  return NextResponse.json({ ok: recorded }, { status: recorded ? 200 : 409 })
}
