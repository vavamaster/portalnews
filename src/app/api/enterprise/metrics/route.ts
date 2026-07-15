import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/enterprise/metrics?sponsoredCategoryId=xxx&days=30
// Returns daily metrics for the user's ads in a sponsor.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const link = await db.enterpriseUserLink.findUnique({ where: { userId: user.id } })
  if (!link || !link.isActive) {
    return NextResponse.json({ error: 'Você não tem acesso Enterprise' }, { status: 403 })
  }

  const url = new URL(req.url)
  const sponsoredCategoryId = url.searchParams.get('sponsoredCategoryId')
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days') || '30', 10) || 30))
  if (!sponsoredCategoryId) return NextResponse.json({ error: 'sponsoredCategoryId é obrigatório' }, { status: 400 })

  // Verify ownership
  const ad = await db.enterpriseAd.findFirst({
    where: { sponsoredCategoryId, ownerId: user.id },
  })
  if (!ad) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // EnterpriseMetric is category-wide and may contain competitors' traffic in
  // rotating mode. Return only counters from ads owned by the authenticated user.
  const ads = await db.enterpriseAd.findMany({
    where: { sponsoredCategoryId, ownerId: user.id },
    select: { id: true, title: true, impressions: true, clicks: true, status: true },
  })

  const totalImpressions = ads.reduce((sum, item) => sum + item.impressions, 0)
  const totalClicks = ads.reduce((sum, item) => sum + item.clicks, 0)
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  return NextResponse.json({
    metrics: [],
    ads,
    period: { days, granularity: 'lifetime-only' },
    totals: {
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: parseFloat(ctr.toFixed(2)),
    },
  })
}
