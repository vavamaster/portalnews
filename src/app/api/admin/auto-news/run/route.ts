import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { generateAutoNews } from '@/lib/auto-news'

export const maxDuration = 180 // 3 minutes

// POST /api/admin/auto-news/run — manually trigger a schedule
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { scheduleId } = await req.json()
  if (!scheduleId) {
    return NextResponse.json({ error: 'scheduleId obrigatório' }, { status: 400 })
  }

  const { db } = await import('@/lib/db')
  const schedule = await db.autoNewsSchedule.findUnique({ where: { id: scheduleId } })
  if (!schedule) {
    return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  }

  const result = await generateAutoNews(schedule)

  // Update tracking
  await db.autoNewsSchedule.update({
    where: { id: scheduleId },
    data: {
      lastRunAt: new Date(),
      lastRunStatus: result.success ? 'SUCCESS' : 'FAILED',
      lastPostId: result.post?.id || null,
      lastError: result.error || null,
      runCount: { increment: 1 },
    },
  })

  await db.autoNewsLog.create({
    data: {
      scheduleId,
      scheduleName: schedule.name,
      status: result.success ? 'SUCCESS' : 'FAILED',
      scope: schedule.scope,
      categorySlug: schedule.categorySlug,
      postTitle: result.post?.title || null,
      postId: result.post?.id || null,
      error: result.error || null,
      duration: result.duration,
    },
  })

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: `Matéria "${result.post?.title}" gerada com sucesso!`,
      post: result.post,
      duration: result.duration,
    })
  } else {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
}
