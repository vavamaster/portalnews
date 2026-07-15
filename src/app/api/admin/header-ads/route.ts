import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { safeReqJson, requireAdminOrRespond } from '@/lib/api-helpers'
import { headerAdSchema, headerAdUpdateSchema, validationError } from '@/lib/admin-validation'
import { auditAdminAction } from '@/lib/admin-audit'
import type { Prisma } from '@prisma/client'

function toDatabaseData(data: Record<string, unknown>) {
  return {
    ...data,
    ...(data.images !== undefined
      ? { images: typeof data.images === 'string' ? data.images : JSON.stringify(data.images) }
      : {}),
    ...(data.startAt !== undefined ? { startAt: data.startAt ? new Date(data.startAt as string) : null } : {}),
    ...(data.endAt !== undefined ? { endAt: data.endAt ? new Date(data.endAt as string) : null } : {}),
  }
}

// GET /api/admin/header-ads - list all ads
export async function GET(req: NextRequest) {
  const { response } = await requireAdminOrRespond(req)
  if (response) return response
  const ads = await db.headerAd.findMany({ orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] })
  return NextResponse.json({ ads })
}

// POST /api/admin/header-ads - create a new ad
export async function POST(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response
  const body = await safeReqJson<unknown>(req)
  if (!body.ok) return body.response
  const parsed = headerAdSchema.safeParse(body.data)
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })

  const ad = await db.headerAd.create({ data: toDatabaseData(parsed.data) as Prisma.HeaderAdCreateInput })
  await auditAdminAction(req, user!, 'CREATE', 'HEADER_AD', ad.id, { name: ad.name, position: ad.position })
  return NextResponse.json({ ok: true, ad })
}

// PUT /api/admin/header-ads?id=xxx - update an ad
export async function PUT(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id Ã© obrigatÃ³rio' }, { status: 400 })

  const body = await safeReqJson<unknown>(req)
  if (!body.ok) return body.response
  const parsed = headerAdUpdateSchema.safeParse(body.data)
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nenhuma alteraÃ§Ã£o informada' }, { status: 400 })
  }

  const ad = await db.headerAd.update({ where: { id }, data: toDatabaseData(parsed.data) as Prisma.HeaderAdUpdateInput })
  await auditAdminAction(req, user!, 'UPDATE', 'HEADER_AD', ad.id, { fields: Object.keys(parsed.data) })
  return NextResponse.json({ ok: true, ad })
}

// DELETE /api/admin/header-ads?id=xxx - archive while preserving metrics
export async function DELETE(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id Ã© obrigatÃ³rio' }, { status: 400 })

  const ad = await db.headerAd.update({ where: { id }, data: { isActive: false } })
  await auditAdminAction(req, user!, 'ARCHIVE', 'HEADER_AD', ad.id, { name: ad.name })
  return NextResponse.json({ ok: true })
}
