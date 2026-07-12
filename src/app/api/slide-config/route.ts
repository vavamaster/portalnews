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
// Body: { ...config, categoryId?: string|null, scope?: 'GLOBAL'|'CATEGORY' }
// config fields: isEnabled, postCount (3-10), autoPlay, delayMs (3000-15000),
//   designType (overlay|split|minimal|cards), showDots, showArrows, showExcerpt,
//   showCategory, showAuthor, heightPreset (short|medium|tall),
//   filterType (featured|latest|breaking|all; aliases: views→all, recent→latest)
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const body = await req.json()
  const { scope, categoryId, ...rawData } = body

  // === Normalize & validate inputs (parametrização consistente) ===
  const data: any = {}

  // Boolean fields
  for (const k of ['isEnabled', 'autoPlay', 'showDots', 'showArrows', 'showExcerpt', 'showCategory', 'showAuthor']) {
    if (typeof rawData[k] === 'boolean') data[k] = rawData[k]
  }

  // Int fields with bounds
  if (rawData.postCount != null) {
    const pc = parseInt(rawData.postCount, 10)
    if (!Number.isNaN(pc)) data.postCount = Math.max(3, Math.min(10, pc))
  }
  if (rawData.delayMs != null) {
    const dm = parseInt(rawData.delayMs, 10)
    if (!Number.isNaN(dm)) data.delayMs = Math.max(3000, Math.min(15000, dm))
  }

  // Enum fields
  const DESIGN_TYPES = ['overlay', 'split', 'minimal', 'cards']
  if (typeof rawData.designType === 'string' && DESIGN_TYPES.includes(rawData.designType)) {
    data.designType = rawData.designType
  }

  const HEIGHT_PRESETS = ['short', 'medium', 'tall']
  if (typeof rawData.heightPreset === 'string' && HEIGHT_PRESETS.includes(rawData.heightPreset)) {
    data.heightPreset = rawData.heightPreset
  }

  // filterType — canonical vocabulary with back-compat aliases
  const FILTER_TYPES = ['featured', 'latest', 'breaking', 'all']
  if (typeof rawData.filterType === 'string') {
    const ft = rawData.filterType.toLowerCase()
    if (ft === 'views') data.filterType = 'all'
    else if (ft === 'recent') data.filterType = 'latest'
    else if (FILTER_TYPES.includes(ft)) data.filterType = ft
    // else: ignore invalid value
  }

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
    data: {
      ...data,
      scope: scope || (categoryId ? 'CATEGORY' : 'GLOBAL'),
      categoryId: categoryId || null,
    },
  })
  return NextResponse.json({ config: created })
}
