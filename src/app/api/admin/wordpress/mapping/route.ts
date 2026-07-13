import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { safeReqJson, requireAdminOrRespond } from '@/lib/api-helpers'

// GET /api/admin/wordpress/mapping?connectionId=xxx
// Returns all category mappings for a connection
export async function GET(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response

  const url = new URL(req.url)
  const connectionId = url.searchParams.get('connectionId')
  if (!connectionId) return NextResponse.json({ error: 'connectionId é obrigatório' }, { status: 400 })

  const mappings = await db.wPCategoryMapping.findMany({
    where: { connectionId },
    orderBy: { wpCategory: 'asc' },
  })

  // Include category details
  const categoryIds = [...new Set(mappings.map(m => m.categoryId))]
  const categories = categoryIds.length > 0
    ? await db.category.findMany({ where: { id: { in: categoryIds } } })
    : []
  const catMap = new Map(categories.map(c => [c.id, c]))

  return NextResponse.json({
    mappings: mappings.map(m => ({
      ...m,
      category: catMap.get(m.categoryId),
    })),
  })
}

// POST /api/admin/wordpress/mapping
// Body: { connectionId, wpCategory, categoryId }
// Upserts a single mapping
export async function POST(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response

  const body = await safeReqJson<{ connectionId?: string; wpCategory?: string; categoryId?: string }>(req)
  if (!body.ok) return body.response
  const { connectionId, wpCategory, categoryId } = body.data
  if (!connectionId || !wpCategory || !categoryId) {
    return NextResponse.json({ error: 'connectionId, wpCategory e categoryId são obrigatórios' }, { status: 400 })
  }

  // Verify category exists
  const cat = await db.category.findUnique({ where: { id: categoryId } })
  if (!cat) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })

  const mapping = await db.wPCategoryMapping.upsert({
    where: {
      connectionId_wpCategory: { connectionId, wpCategory },
    },
    update: { categoryId },
    create: { connectionId, wpCategory, categoryId },
  })

  return NextResponse.json({ ok: true, mapping })
}

// DELETE /api/admin/wordpress/mapping?id=xxx
export async function DELETE(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  await db.wPCategoryMapping.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
