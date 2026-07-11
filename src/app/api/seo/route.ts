import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getSeoSettings, setSeoSettings } from '@/lib/seo'
import { safeReqJson } from '@/lib/api-helpers'

export async function GET() {
  const settings = await getSeoSettings()
  return NextResponse.json({ settings })
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const body = await safeReqJson<{ settings?: any }>(req)
  if (!body.ok) return body.response
  const { settings } = body.data
  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ error: 'Settings inválidas' }, { status: 400 })
  }
  await setSeoSettings(settings)
  return NextResponse.json({ ok: true, settings: await getSeoSettings() })
}
