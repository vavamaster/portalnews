import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/classified-categories/[id] - single category
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const category = await db.classifiedCategory.findUnique({
    where: { id },
    include: {
      parent: true,
      children: true,
      _count: { select: { listings: { where: { status: 'ACTIVE' } } } },
    },
  })
  if (!category) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  return NextResponse.json({ category })
}

// PUT /api/classified-categories/[id] - update category (admin only)
// Whitelisted fields only — prevents mass-assignment of privileged fields
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const existing = await db.classifiedCategory.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
  }

  const body = await req.json()
  const { name, slug, icon, color, description, parentId, order } = body

  // Build whitelisted update data — only known fields, only if provided
  const data: any = {}
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Nome inválido' }, { status: 400 })
    }
    data.name = name.trim()
  }
  if (slug !== undefined) {
    if (typeof slug !== 'string' || slug.trim().length < 2) {
      return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })
    }
    // Check slug uniqueness (excluding current)
    const slugConflict = await db.classifiedCategory.findUnique({ where: { slug: slug.trim() } })
    if (slugConflict && slugConflict.id !== id) {
      return NextResponse.json({ error: 'Slug já em uso' }, { status: 400 })
    }
    data.slug = slug.trim()
  }
  if (icon !== undefined) data.icon = String(icon).trim() || existing.icon
  if (color !== undefined) data.color = String(color).trim() || existing.color
  if (description !== undefined) data.description = typeof description === 'string' ? description.trim() || null : null
  if (order !== undefined) data.order = Math.max(0, Math.min(9999, parseInt(order, 10) || 0))

  // parentId: prevent self-reference + cycle
  if (parentId !== undefined) {
    if (parentId === null) {
      data.parentId = null
    } else {
      if (parentId === id) {
        return NextResponse.json({ error: 'Categoria não pode ser pai de si mesma' }, { status: 400 })
      }
      // Check parent exists and isn't a descendant (cycle check)
      const parent = await db.classifiedCategory.findUnique({ where: { id: parentId } })
      if (!parent) {
        return NextResponse.json({ error: 'Categoria pai não encontrada' }, { status: 400 })
      }
      // Walk up the parent chain to ensure `id` isn't an ancestor of `parentId`
      let current: any = parent
      const visited = new Set<string>([id])
      while (current?.parentId) {
        if (visited.has(current.parentId)) {
          return NextResponse.json({ error: 'Ciclo detectado na árvore de categorias' }, { status: 400 })
        }
        visited.add(current.parentId)
        current = await db.classifiedCategory.findUnique({ where: { id: current.parentId } })
      }
      data.parentId = parentId
    }
  }

  try {
    const updated = await db.classifiedCategory.update({
      where: { id },
      data,
      include: { parent: true, children: true },
    })
    return NextResponse.json({ category: updated })
  } catch (e: any) {
    console.error('Category update error:', e)
    return NextResponse.json({ error: 'Erro ao atualizar categoria' }, { status: 500 })
  }
}

// DELETE /api/classified-categories/[id] - delete (admin only)
// Fails gracefully if category has listings (FK constraint)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const existing = await db.classifiedCategory.findUnique({
    where: { id },
    include: { _count: { select: { listings: true, children: true } } },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
  }

  // Block if has listings
  if (existing._count.listings > 0) {
    return NextResponse.json({
      error: `Não é possível excluir: ${existing._count.listings} anúncio(s) usam esta categoria. Reassocie-os a outra categoria antes de excluir.`,
    }, { status: 400 })
  }
  // Block if has children
  if (existing._count.children > 0) {
    return NextResponse.json({
      error: `Não é possível excluir: ${existing._count.children} subcategoria(s) existem. Exclua ou mova-as primeiro.`,
    }, { status: 400 })
  }

  // Optional: reassign listings to another category before delete
  const url = new URL(req.url)
  const reassignTo = url.searchParams.get('reassignTo')
  if (reassignTo) {
    const target = await db.classifiedCategory.findUnique({ where: { id: reassignTo } })
    if (!target) {
      return NextResponse.json({ error: 'Categoria de reatribuição não encontrada' }, { status: 400 })
    }
    await db.classifiedListing.updateMany({
      where: { categoryId: id },
      data: { categoryId: reassignTo },
    })
  }

  try {
    await db.classifiedCategory.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Category delete error:', e)
    return NextResponse.json({ error: 'Erro ao excluir categoria' }, { status: 500 })
  }
}
