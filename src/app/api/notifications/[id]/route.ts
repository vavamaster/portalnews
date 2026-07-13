import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserOrRespond } from '@/lib/api-helpers'

// PATCH /api/notifications/[id] - mark as read
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, response } = await requireUserOrRespond(req)
  if (response) return response
  const notif = await db.notification.findUnique({ where: { id } })
  if (!notif || notif.userId !== user.id) {
    return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 })
  }
  const updated = await db.notification.update({ where: { id }, data: { isRead: true } })
  return NextResponse.json({ notification: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, response } = await requireUserOrRespond(req)
  if (response) return response
  const notif = await db.notification.findUnique({ where: { id } })
  if (!notif || notif.userId !== user.id) {
    return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 })
  }
  await db.notification.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
