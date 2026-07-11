import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const categories = await db.classifiedCategory.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { listings: { where: { status: 'ACTIVE' } } } } },
  })
  return NextResponse.json({ categories })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const body = await req.json()
  const { name, slug, icon, color, description, parentId, order } = body
  if (!name || !slug || !icon || !color) {
    return NextResponse.json({ error: 'Nome, slug, ícone e cor são obrigatórios' }, { status: 400 })
  }
  const cat = await db.classifiedCategory.create({
    data: { name, slug, icon, color, description, parentId, order: order || 0 },
  })
  return NextResponse.json({ category: cat })
}
