import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

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
  const body = await req.json()
  const { name, description, baseUrl, apiType, isActive, priority, headers } = body
  if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const source = await db.quoteSource.create({
    data: {
      name, description, baseUrl, apiType: apiType || 'REST',
      isActive: isActive !== false, priority: priority || 1,
      headers: headers ? JSON.stringify(headers) : null,
    },
  })
  return NextResponse.json({ source })
}
