import { NextRequest, NextResponse } from 'next/server'
import { recordEnterpriseAdMetric } from '@/lib/enterprise'

// POST /api/sponsored-categories/click
// Body: { adId: string }
// Tracks a click on a sponsored category ad.
export async function POST(req: NextRequest) {
  try {
    const { adId } = await req.json()
    if (!adId) return NextResponse.json({ error: 'adId é obrigatório' }, { status: 400 })

    const result = await recordEnterpriseAdMetric(String(adId), 'click')
    if (!result.ok) return NextResponse.json(result, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[SponsoredCategory] click error:', e)
    return NextResponse.json({ error: 'Não foi possível registrar o clique' }, { status: 500 })
  }
}
