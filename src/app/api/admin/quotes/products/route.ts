import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { quoteProductSchema, validationError } from '@/lib/admin-validation'

// GET - admin: list products
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const products = await db.quoteProduct.findMany({
    include: { source: true, _count: { select: { quotes: true } } },
    orderBy: { order: 'asc' },
  })
  const sources = await db.quoteSource.findMany()
  return NextResponse.json({ products, sources })
}

// POST - admin: create product
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const parsed = quoteProductSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })
  const { slug, name, shortName, category, unit, icon, color, sourceId, externalCode, decimals, isActive, order } = parsed.data
  const product = await db.quoteProduct.create({
    data: {
      slug, name, shortName: shortName || name, category, unit: unit || 'R$',
      icon: icon || 'DollarSign', color: color || 'green',
      sourceId, externalCode: externalCode || null, decimals: decimals ?? 2, isActive: isActive !== false, order: order || 0,
    },
    include: { source: true },
  })
  return NextResponse.json({ product })
}
