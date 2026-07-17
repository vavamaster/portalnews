import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { consumeAdTrackingToken, recordAdMetric } from '@/lib/ad-tracking'
import { safeReqJson } from '@/lib/api-helpers'
import { adminAdUpdateSchema, validationError } from '@/lib/admin-validation'
import { auditAdminAction } from '@/lib/admin-audit'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const parsed = adminAdUpdateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })
  const data: any = { ...parsed.data }
  for (const field of ['imageUrl', 'linkUrl', 'categoryId']) {
    if (field in data) data[field] = data[field] || null
  }
  for (const field of ['startAt', 'endAt']) {
    if (field in data) data[field] = data[field] ? new Date(data[field]) : null
  }
  const ad = await db.ad.update({ where: { id }, data })
  await auditAdminAction(req, user, 'UPDATE', 'AD', id, { fields: Object.keys(data) })
  return NextResponse.json({ ad })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  await db.ad.update({ where: { id }, data: { status: 'EXPIRED' } })
  await auditAdminAction(req, user, 'ARCHIVE', 'AD', id)
  return NextResponse.json({ ok: true, archived: true })
}

// Track impression/click
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  if (action !== 'impression' && action !== 'click') {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }
  const parsed = await safeReqJson<{ token?: string }>(req)
  if (!parsed.ok) return parsed.response
  if (!await consumeAdTrackingToken(parsed.data.token, id, action)) {
    return NextResponse.json({ error: 'Rastreamento inválido ou já processado' }, { status: 409 })
  }
  const recorded = await recordAdMetric(id, action)
  if (!recorded) return NextResponse.json({ error: 'Anúncio indisponível' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
