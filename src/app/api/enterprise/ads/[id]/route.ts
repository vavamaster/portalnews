import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// PATCH /api/enterprise/ads/[id]
// Enterprise user edits their own ad. Cannot change status (only admin can approve).
// Body: { title?, subtitle?, logoUrl?, imageUrl?, videoUrl?, linkUrl?, ctaText? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const link = await db.enterpriseUserLink.findUnique({ where: { userId: user.id } })
  if (!link || !link.isActive) {
    return NextResponse.json({ error: 'Você não tem acesso Enterprise' }, { status: 403 })
  }

  const { id } = await params
  const ad = await db.enterpriseAd.findUnique({ where: { id } })
  if (!ad || ad.ownerId !== user.id) {
    return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
  }

  const body = await req.json()
  const data: any = {}
  for (const k of ['title', 'subtitle', 'logoUrl', 'imageUrl', 'videoUrl', 'linkUrl', 'ctaText']) {
    if (k in body) data[k] = body[k]
  }
  // If the user edits a previously-approved ad, send it back to PENDING for re-review
  if (ad.status === 'ACTIVE' && Object.keys(data).length > 0) {
    data.status = 'PENDING'
  }

  const updated = await db.enterpriseAd.update({ where: { id }, data })
  return NextResponse.json({ ok: true, ad: updated })
}

// DELETE /api/enterprise/ads/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const link = await db.enterpriseUserLink.findUnique({ where: { userId: user.id } })
  if (!link || !link.isActive) {
    return NextResponse.json({ error: 'Você não tem acesso Enterprise' }, { status: 403 })
  }

  const { id } = await params
  const ad = await db.enterpriseAd.findUnique({ where: { id } })
  if (!ad || ad.ownerId !== user.id) {
    return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
  }

  await db.enterpriseAd.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
