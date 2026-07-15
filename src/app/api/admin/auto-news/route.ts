import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/auto-news — list all schedules + logs
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const includeLogs = url.searchParams.get('logs') === 'true'

  const [schedules, logs, stats] = await Promise.all([
    db.autoNewsSchedule.findMany({ orderBy: { createdAt: 'desc' } }),
    includeLogs ? db.autoNewsLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }) : Promise.resolve([]),
    db.autoNewsLog.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ])

  const parsed = schedules.map(s => ({
    ...s,
    daysOfWeek: s.daysOfWeek ? JSON.parse(s.daysOfWeek) : null,
  }))

  return NextResponse.json({
    schedules: parsed,
    logs: includeLogs ? logs : [],
    stats: {
      last7days: stats.reduce((acc: any, s) => ({ ...acc, [s.status]: s._count._all }), {}),
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter(s => s.isEnabled).length,
    },
  })
}

// POST /api/admin/auto-news — create new schedule
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const { name, frequency, hour, minute, daysOfWeek, dayOfMonth, scope, categorySlug, topicHint, promptTemplate, minWords, maxWords, autoPublish, isEnabled } = body

  if (!name || !frequency) {
    return NextResponse.json({ error: 'Nome e frequência são obrigatórios' }, { status: 400 })
  }

  const schedule = await db.autoNewsSchedule.create({
    data: {
      name,
      frequency,
      hour: hour ?? 8,
      minute: minute ?? 0,
      daysOfWeek: daysOfWeek ? JSON.stringify(daysOfWeek) : null,
      dayOfMonth: dayOfMonth || null,
      scope: scope || 'LOCAL',
      categorySlug: categorySlug || null,
      topicHint: topicHint || null,
      promptTemplate: promptTemplate || null,
      minWords: minWords || 400,
      maxWords: maxWords || 800,
      autoPublish: autoPublish ?? false,
      isEnabled: isEnabled ?? true,
    },
  })

  return NextResponse.json({ schedule })
}
