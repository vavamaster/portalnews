import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const body = await req.json()
  const ad = await db.ad.update({ where: { id }, data: body })
  return NextResponse.json({ ad })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  await db.ad.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// Track impression/click
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const action = url.searchParams.get('action') // 'impression' | 'click'
  if (action === 'impression') {
    await db.ad.update({ where: { id }, data: { impressions: { increment: 1 } } })
  } else if (action === 'click') {
    await db.ad.update({ where: { id }, data: { clicks: { increment: 1 } } })
  }
  return NextResponse.json({ ok: true })
}
