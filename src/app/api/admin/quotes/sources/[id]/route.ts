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
  if (body.headers && typeof body.headers === 'object') {
    body.headers = JSON.stringify(body.headers)
  }
  const source = await db.quoteSource.update({ where: { id }, data: body })
  return NextResponse.json({ source })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  // Check if source has products
  const productsCount = await db.quoteProduct.count({ where: { sourceId: id } })
  if (productsCount > 0) {
    return NextResponse.json({ error: `Fonte possui ${productsCount} produto(s). Remova-os primeiro.` }, { status: 400 })
  }
  await db.quoteSource.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
