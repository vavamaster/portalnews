import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/social — list all social configs
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const configs = await db.socialConfig.findMany({ orderBy: { provider: 'asc' } })
  const recentPosts = await db.socialPost.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ configs, recentPosts })
}

// POST /api/admin/social — create or update config
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { provider, displayName, credentials, isEnabled, autoPublish } = body

  if (!provider) return NextResponse.json({ error: 'provider é obrigatório' }, { status: 400 })

  const config = await db.socialConfig.upsert({
    where: { provider },
    update: {
      displayName: displayName || provider,
      credentials: JSON.stringify(credentials || {}),
      isEnabled: isEnabled ?? true,
      autoPublish: autoPublish ?? true,
    },
    create: {
      provider,
      displayName: displayName || provider,
      credentials: JSON.stringify(credentials || {}),
      isEnabled: isEnabled ?? true,
      autoPublish: autoPublish ?? true,
    },
  })

  return NextResponse.json({ ok: true, config })
}
