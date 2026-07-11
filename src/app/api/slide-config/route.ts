import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/slide-config?categoryId=... (public)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const categoryId = url.searchParams.get('categoryId')

  if (categoryId) {
    // Try category-specific config, fallback to global
    let config = await db.slideConfig.findFirst({
      where: { scope: 'CATEGORY', categoryId },
    })
    if (!config) {
      config = await db.slideConfig.findFirst({
        where: { scope: 'GLOBAL', categoryId: null },
      })
    }
    return NextResponse.json({ config })
  }

  // Return all configs (admin)
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    // Public: return only global
    const config = await db.slideConfig.findFirst({
      where: { scope: 'GLOBAL', categoryId: null },
    })
    return NextResponse.json({ config })
  }

  const [globalConfig, categoryConfigs] = await Promise.all([
    db.slideConfig.findFirst({ where: { scope: 'GLOBAL', categoryId: null } }),
    db.slideConfig.findMany({
      where: { scope: 'CATEGORY' },
      include: { category: true },
    }),
  ])
  const categories = await db.category.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json({ globalConfig, categoryConfigs, categories })
}

// PUT /api/slide-config (admin)
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const body = await req.json()
  const { scope, categoryId, ...data } = body

  const where = categoryId
    ? { scope: 'CATEGORY' as const, categoryId }
    : { scope: 'GLOBAL' as const, categoryId: null }

  // Upsert
  const existing = await db.slideConfig.findFirst({ where })
  if (existing) {
    const updated = await db.slideConfig.update({ where: { id: existing.id }, data })
    return NextResponse.json({ config: updated })
  }

  const created = await db.slideConfig.create({
    data: { ...data, scope: scope || (categoryId ? 'CATEGORY' : 'GLOBAL'), categoryId: categoryId || null },
  })
  return NextResponse.json({ config: created })
}
