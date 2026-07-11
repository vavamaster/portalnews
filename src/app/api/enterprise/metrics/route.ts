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
  const days = parseInt(url.searchParams.get('days') || '30', 10)
  if (!sponsoredCategoryId) return NextResponse.json({ error: 'sponsoredCategoryId é obrigatório' }, { status: 400 })

  // Verify ownership
  const ad = await db.enterpriseAd.findFirst({
    where: { sponsoredCategoryId, ownerId: user.id },
  })
  if (!ad) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  const metrics = await db.enterpriseMetric.findMany({
    where: { sponsoredCategoryId, date: { gte: since } },
    orderBy: { date: 'asc' },
  })

  // Aggregate per-ad stats
  const ads = await db.enterpriseAd.findMany({
    where: { sponsoredCategoryId, ownerId: user.id },
    select: { id: true, title: true, impressions: true, clicks: true, status: true },
  })

  const totalImpressions = metrics.reduce((s, m) => s + m.impressions, 0)
  const totalClicks = metrics.reduce((s, m) => s + m.clicks, 0)
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  return NextResponse.json({
    metrics,
    ads,
    totals: {
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: parseFloat(ctr.toFixed(2)),
    },
  })
}
