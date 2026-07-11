import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/whatsapp — get WhatsApp config and recent logs
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let config = await db.whatsAppConfig.findFirst()
  if (!config) {
    config = await db.whatsAppConfig.create({
      data: {
        phoneNumber: '',
        sessionName: 'portal-session',
        isConnected: false,
        notifyOnPublish: true,
        notifyOnReview: true,
      },
    })
  }

  const recentLogs = await db.whatsAppLog.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ config, recentLogs })
}

// POST /api/admin/whatsapp — update config
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  let config = await db.whatsAppConfig.findFirst()

  const data = {
    phoneNumber: body.phoneNumber || '',
    notifyOnPublish: body.notifyOnPublish ?? true,
    notifyOnReview: body.notifyOnReview ?? true,
    notifyPhone: body.notifyPhone || null,
  }

  if (!config) {
    config = await db.whatsAppConfig.create({ data: { ...data, sessionName: 'portal-session' } })
  } else {
    config = await db.whatsAppConfig.update({ where: { id: config.id }, data })
  }

  return NextResponse.json({ ok: true, config })
}
