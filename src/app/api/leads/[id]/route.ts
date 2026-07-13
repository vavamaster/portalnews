import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserOrRespond } from '@/lib/api-helpers'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, response } = await requireUserOrRespond(req)
  if (response) return response
  const body = await req.json()
  const lead = await db.lead.findUnique({
    where: { id },
    include: { listing: true },
  })
  if (!lead) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Only listing owner can mark as read/replied
  if (lead.listing.ownerId !== user.id) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  const update: any = {}
  if (body.isRead !== undefined) update.isRead = body.isRead
  if (body.isReplied !== undefined) update.isReplied = body.isReplied
  const updated = await db.lead.update({ where: { id }, data: update })
  return NextResponse.json({ lead: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, response } = await requireUserOrRespond(req)
  if (response) return response
  const lead = await db.lead.findUnique({
    where: { id },
    include: { listing: true },
  })
  if (!lead) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (lead.listing.ownerId !== user.id) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  await db.lead.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
