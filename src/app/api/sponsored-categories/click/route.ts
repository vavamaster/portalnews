import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/sponsored-categories/click
// Body: { adId: string }
// Tracks a click on a sponsored category ad.
export async function POST(req: NextRequest) {
  try {
    const { adId } = await req.json()
    if (!adId) return NextResponse.json({ error: 'adId é obrigatório' }, { status: 400 })

    const ad = await db.enterpriseAd.findUnique({
      where: { id: adId },
      include: { sponsoredCategory: true },
    })
    if (!ad) return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })

    // Increment click counter (async)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    db.enterpriseAd.update({
      where: { id: ad.id },
      data: { clicks: { increment: 1 } },
    }).catch(() => {})
    db.enterpriseMetric.upsert({
      where: { sponsoredCategoryId_date: { sponsoredCategoryId: ad.sponsoredCategoryId, date: today } },
      update: { clicks: { increment: 1 } },
      create: { sponsoredCategoryId: ad.sponsoredCategoryId, date: today, clicks: 1 },
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
