import { NextRequest, NextResponse } from 'next/server'
import { recordEnterpriseAdMetric } from '@/lib/enterprise'

// POST /api/sponsored-categories/impression
// Records an impression only when a creative actually becomes visible.
export async function POST(req: NextRequest) {
  try {
    const { adId } = await req.json()
    if (!adId || typeof adId !== 'string') {
      return NextResponse.json({ error: 'adId é obrigatório' }, { status: 400 })
    }
    const result = await recordEnterpriseAdMetric(adId, 'impression')
    if (!result.ok) return NextResponse.json(result, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[SponsoredCategory] impression error:', error)
    return NextResponse.json({ error: 'Não foi possível registrar a impressão' }, { status: 500 })
  }
}
