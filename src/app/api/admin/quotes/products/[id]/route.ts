import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { quoteProductSchema, validationError } from '@/lib/admin-validation'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const parsed = quoteProductSchema.partial().safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })
  const { sourceId, ...data } = parsed.data
  const product = await db.quoteProduct.update({
    where: { id },
    data: {
      ...data,
      ...(sourceId ? { source: { connect: { id: sourceId } } } : {}),
    },
    include: { source: true },
  })
  return NextResponse.json({ product })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  await db.quoteProduct.delete({ where: { id } }) // cascades to quotes
  return NextResponse.json({ ok: true })
}
