import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// PATCH /api/admin/sponsored-categories/[id]/ads/[adId]
// Approve / reject / pause / edit an ad.
// Body: { status?, rejectionReason?, title?, subtitle?, logoUrl?, imageUrl?, videoUrl?, linkUrl?, ctaText?, order? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; adId: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id, adId } = await params
  const body = await req.json()
  const data: any = {}
  for (const k of ['status', 'rejectionReason', 'title', 'subtitle', 'logoUrl', 'imageUrl', 'videoUrl', 'linkUrl', 'ctaText', 'order']) {
    if (k in body) data[k] = body[k]
  }
  // When approving, clear rejectionReason
  if (data.status === 'ACTIVE') data.rejectionReason = null

  // C-04 fix: verify the ad belongs to this sponsored category
  const existing = await db.enterpriseAd.findFirst({ where: { id: adId, sponsoredCategoryId: id } })
  if (!existing) return NextResponse.json({ error: 'Anúncio não encontrado neste sponsor' }, { status: 404 })

  const ad = await db.enterpriseAd.update({ where: { id: adId }, data })
  return NextResponse.json({ ok: true, ad })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; adId: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id, adId } = await params

  // C-04 fix: verify the ad belongs to this sponsored category
  const existing = await db.enterpriseAd.findFirst({ where: { id: adId, sponsoredCategoryId: id } })
  if (!existing) return NextResponse.json({ error: 'Anúncio não encontrado neste sponsor' }, { status: 404 })

  await db.enterpriseAd.delete({ where: { id: adId } })
  return NextResponse.json({ ok: true })
}
