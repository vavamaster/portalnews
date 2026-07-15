import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { quoteSourceSchema, validationError } from '@/lib/admin-validation'
import { assertSafeExternalUrl } from '@/lib/url-security'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const parsed = quoteSourceSchema.partial().safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })
  const data: any = { ...parsed.data }
  if (data.baseUrl) await assertSafeExternalUrl(data.baseUrl)
  if (data.headers && typeof data.headers === 'object') {
    data.headers = JSON.stringify(data.headers)
  }
  const source = await db.quoteSource.update({ where: { id }, data })
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
