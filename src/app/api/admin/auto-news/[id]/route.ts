import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// PUT /api/admin/auto-news/[id] — update schedule
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const update: any = {}
  const fields = ['name', 'frequency', 'hour', 'minute', 'dayOfMonth', 'scope', 'categorySlug', 'topicHint', 'promptTemplate', 'minWords', 'maxWords', 'autoPublish', 'isEnabled']
  for (const f of fields) {
    if (body[f] !== undefined) update[f] = body[f]
  }
  if (body.daysOfWeek !== undefined) {
    update.daysOfWeek = body.daysOfWeek ? JSON.stringify(body.daysOfWeek) : null
  }

  const schedule = await db.autoNewsSchedule.update({ where: { id }, data: update })
  return NextResponse.json({ schedule })
}

// DELETE /api/admin/auto-news/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  await db.autoNewsSchedule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
