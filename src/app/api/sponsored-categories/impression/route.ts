import { NextRequest, NextResponse } from 'next/server'
import { recordEnterpriseAdMetric } from '@/lib/enterprise'
import { consumeAdTrackingToken } from '@/lib/ad-tracking'

// POST /api/sponsored-categories/impression
// Records an impression only when a creative actually becomes visible.
export async function POST(req: NextRequest) {
  try {
    const { adId, token } = await req.json()
    if (!adId || typeof adId !== 'string') {
      return NextResponse.json({ error: 'adId é obrigatório' }, { status: 400 })
    }
    if (!await consumeAdTrackingToken(token, adId, 'impression', 'enterprise')) {
      return NextResponse.json({ error: 'Rastreamento inválido ou já processado' }, { status: 403 })
    }
    const result = await recordEnterpriseAdMetric(adId, 'impression')
    if (!result.ok) return NextResponse.json(result, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[SponsoredCategory] impression error:', error)
    return NextResponse.json({ error: 'Não foi possível registrar a impressão' }, { status: 500 })
  }
}
