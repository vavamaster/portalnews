import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await db.classifiedListing.findUnique({
    where: { id },
    include: {
      category: true,
      owner: { select: { id: true, name: true, avatar: true, email: true } },
      plan: true,
      reviews: { include: { reviewer: { select: { id: true, name: true, avatar: true } } } },
    },
  })
  if (!listing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json({ listing })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const existing = await db.classifiedListing.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (existing.ownerId !== user.id && !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  const body = await req.json()
  // sanitize according to plan
  const plan = await db.plan.findUnique({ where: { id: existing.planId } })
  if (plan) {
    if (!plan.allowPhone) body.phone = null
    if (!plan.allowWhatsApp) body.whatsapp = null
    if (!plan.allowEmail) { body.email = null; body.website = null }
    if (!plan.allowLogo) body.logoUrl = null
    if (!plan.allowMap) { body.latitude = null; body.longitude = null; body.address = null }
    if (!plan.allowServices) body.services = null
    if (body.photos && Array.isArray(body.photos) && body.photos.length > plan.maxPhotosPerListing) {
      body.photos = body.photos.slice(0, plan.maxPhotosPerListing)
    }
  }

  // FIX: whitelist fields — prevent mass assignment of privileged fields
  const allowedFields = [
    'title', 'description', 'price', 'isNegotiable', 'condition',
    'phone', 'whatsapp', 'email', 'website', 'logoUrl',
    'latitude', 'longitude', 'address', 'city', 'state', 'zipCode',
    'photos', 'services', 'categorySlug'
  ]
  const updateData: any = {}
  for (const f of allowedFields) {
    if (body[f] !== undefined) updateData[f] = body[f]
  }
  // Serialize arrays
  if (updateData.photos !== undefined) {
    updateData.photos = Array.isArray(updateData.photos) ? JSON.stringify(updateData.photos) : updateData.photos
  }
  if (updateData.services !== undefined) {
    updateData.services = Array.isArray(updateData.services) ? JSON.stringify(updateData.services) : updateData.services
  }

  const listing = await db.classifiedListing.update({ where: { id }, data: updateData, include: { category: true, plan: true } })
  return NextResponse.json({ listing })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const existing = await db.classifiedListing.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (existing.ownerId !== user.id && !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  await db.classifiedListing.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
