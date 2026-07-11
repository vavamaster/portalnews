import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// PATCH /api/admin/ai-autonews/[id] — update schedule
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const data: any = {}
  for (const k of ['name', 'frequency', 'hour', 'minute', 'scope', 'categorySlug', 'topicHint', 'promptTemplate', 'autoPublish', 'isEnabled']) {
    if (k in body) data[k] = body[k]
  }
  if (body.daysOfWeek !== undefined) data.daysOfWeek = body.daysOfWeek ? JSON.stringify(body.daysOfWeek) : null

  const schedule = await db.aINewsSchedule.update({ where: { id }, data })
  return NextResponse.json({ ok: true, schedule })
}

// DELETE /api/admin/ai-autonews/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params
  await db.aINewsSchedule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
