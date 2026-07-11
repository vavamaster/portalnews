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
  const { adId } = await params
  const body = await req.json()
  const data: any = {}
  for (const k of ['status', 'rejectionReason', 'title', 'subtitle', 'logoUrl', 'imageUrl', 'videoUrl', 'linkUrl', 'ctaText', 'order']) {
    if (k in body) data[k] = body[k]
  }
  // When approving, clear rejectionReason
  if (data.status === 'ACTIVE') data.rejectionReason = null
  const ad = await db.enterpriseAd.update({ where: { id: adId }, data })
  return NextResponse.json({ ok: true, ad })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; adId: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { adId } = await params
  await db.enterpriseAd.delete({ where: { id: adId } })
  return NextResponse.json({ ok: true })
}
