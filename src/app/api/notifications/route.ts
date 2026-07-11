import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET - user's notifications
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ notifications: [], unreadCount: 0 })
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.notification.count({ where: { userId: user.id, isRead: false } }),
  ])
  return NextResponse.json({ notifications, unreadCount })
}

// PATCH - mark all as read
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await db.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  })
  return NextResponse.json({ ok: true })
}
