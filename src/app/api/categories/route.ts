import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { safeReqJson } from '@/lib/api-helpers'

export async function GET() {
  const categories = await db.category.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { posts: { where: { status: 'PUBLISHED' } } } } },
  })
  return NextResponse.json({ categories })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const body = await safeReqJson<any>(req)
  if (!body.ok) return body.response
  const { name, slug, description, color, icon, parentId, order } = body.data
  if (!name || !slug) return NextResponse.json({ error: 'Nome e slug são obrigatórios' }, { status: 400 })
  const cat = await db.category.create({
    data: { name, slug, description, color, icon, parentId, order: order || 0 },
  })
  return NextResponse.json({ category: cat })
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const body = await req.json()
  const { id, ...data } = body
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
  const cat = await db.category.update({ where: { id }, data })
  return NextResponse.json({ category: cat })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
  await db.category.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
