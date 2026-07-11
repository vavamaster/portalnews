import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// POST /api/admin/sponsored-categories/[id]/ads
// Admin creates an ad on behalf of a company user.
// Body: { ownerId, title, subtitle, logoUrl, imageUrl, videoUrl, linkUrl, ctaText, status, order, startAt, endAt }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id } = await params
  const sc = await db.sponsoredCategory.findUnique({ where: { id } })
  if (!sc) return NextResponse.json({ error: 'Sponsor não encontrado' }, { status: 404 })

  const body = await req.json()
  if (!body.ownerId || !body.title) {
    return NextResponse.json({ error: 'ownerId e title são obrigatórios' }, { status: 400 })
  }

  // Enforce maxRotatingAds
  const activeAds = await db.enterpriseAd.count({
    where: { sponsoredCategoryId: sc.id, ownerId: body.ownerId, status: { in: ['ACTIVE', 'PENDING'] } },
  })
  if (activeAds >= sc.maxRotatingAds) {
    return NextResponse.json({
      error: `Limite de ${sc.maxRotatingAds} anúncio(s) ativo(s) por empresa nesta categoria`,
    }, { status: 400 })
  }

  const ad = await db.enterpriseAd.create({
    data: {
      sponsoredCategoryId: sc.id,
      ownerId: body.ownerId,
      title: body.title,
      subtitle: body.subtitle || null,
      logoUrl: body.logoUrl || null,
      imageUrl: body.imageUrl || null,
      videoUrl: body.videoUrl || null,
      linkUrl: body.linkUrl || null,
      ctaText: body.ctaText || null,
      status: body.status || 'PENDING',
      order: body.order || 0,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
    },
  })
  return NextResponse.json({ ok: true, ad })
}
