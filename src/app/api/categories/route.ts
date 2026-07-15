import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { safeReqJson } from '@/lib/api-helpers'
import { auditAdminAction } from '@/lib/admin-audit'
import { categoryCreateSchema, categoryUpdateSchema, validationError } from '@/lib/admin-validation'

async function categoryParentIsValid(categoryId: string | null, parentId: string | null | undefined) {
  if (!parentId) return true
  if (parentId === categoryId) return false
  let current: string | null = parentId
  const visited = new Set<string>()
  while (current) {
    if (current === categoryId || visited.has(current)) return false
    visited.add(current)
    const parent: { parentId: string | null } | null = await db.category.findUnique({ where: { id: current }, select: { parentId: true } })
    if (!parent) return false
    current = parent.parentId
  }
  return true
}

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
  const parsed = categoryCreateSchema.safeParse(body.data)
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })
  const { name, slug, description, color, icon, parentId, order } = parsed.data
  if (!(await categoryParentIsValid(null, parentId))) return NextResponse.json({ error: 'Categoria pai inválida' }, { status: 400 })
  const cat = await db.category.create({
    data: { name, slug, description: description || null, color: color || null, icon: icon || null, parentId: parentId || null, order: order || 0 },
  })
  await auditAdminAction(req, user, 'CREATE', 'CATEGORY', cat.id, { name: cat.name, slug: cat.slug })
  return NextResponse.json({ category: cat })
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const parsed = categoryUpdateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })
  const { id, ...data } = parsed.data
  if (!(await categoryParentIsValid(id, data.parentId))) return NextResponse.json({ error: 'Categoria pai inválida ou cíclica' }, { status: 400 })
  const cat = await db.category.update({ where: { id }, data })
  await auditAdminAction(req, user, 'UPDATE', 'CATEGORY', id, { fields: Object.keys(data) })
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
  const category = await db.category.findUnique({
    where: { id },
    select: {
      name: true,
      _count: { select: { posts: true, children: true, slideConfigs: true } },
      sponsoredCategory: { select: { id: true } },
    },
  })
  if (!category) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
  const dependencies = category._count.posts + category._count.children + category._count.slideConfigs + (category.sponsoredCategory ? 1 : 0)
  if (dependencies > 0) {
    return NextResponse.json({
      error: 'Categoria em uso. Remova ou transfira posts, subcategorias, slides e patrocínios antes de excluí-la.',
    }, { status: 409 })
  }
  await db.category.delete({ where: { id } })
  await auditAdminAction(req, user, 'DELETE', 'CATEGORY', id, { name: category.name })
  return NextResponse.json({ ok: true })
}
