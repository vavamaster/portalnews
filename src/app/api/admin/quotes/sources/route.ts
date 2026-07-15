import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { quoteSourceSchema, validationError } from '@/lib/admin-validation'
import { assertSafeExternalUrl } from '@/lib/url-security'

// GET - admin: list sources
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const sources = await db.quoteSource.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { priority: 'asc' },
  })
  return NextResponse.json({ sources })
}

// POST - admin: create source
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const parsed = quoteSourceSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })
  const { name, description, baseUrl, apiType, isActive, priority, headers } = parsed.data
  if (baseUrl) await assertSafeExternalUrl(baseUrl)
  const source = await db.quoteSource.create({
    data: {
      name, description: description || null, baseUrl: baseUrl || null, apiType: apiType || 'REST',
      isActive: isActive !== false, priority: priority || 1,
      headers: headers ? JSON.stringify(headers) : null,
    },
  })
  return NextResponse.json({ source })
}
