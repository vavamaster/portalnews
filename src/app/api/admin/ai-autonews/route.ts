import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/ai-autonews — list schedules
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const schedules = await db.aINewsSchedule.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ schedules })
}

// POST /api/admin/ai-autonews — create or update schedule
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { name, frequency, hour, minute, daysOfWeek, scope, categorySlug, topicHint, promptTemplate, autoPublish, isEnabled } = body

  if (!name || !frequency) {
    return NextResponse.json({ error: 'name e frequency são obrigatórios' }, { status: 400 })
  }

  const schedule = await db.aINewsSchedule.create({
    data: {
      name,
      frequency,
      hour: hour !== undefined ? hour : 8,
      minute: minute || 0,
      daysOfWeek: daysOfWeek ? JSON.stringify(daysOfWeek) : null,
      scope: scope || 'LOCAL',
      categorySlug: categorySlug || null,
      topicHint: topicHint || null,
      promptTemplate: promptTemplate || null,
      autoPublish: autoPublish || false,
      isEnabled: isEnabled ?? true,
    },
  })

  return NextResponse.json({ ok: true, schedule })
}
