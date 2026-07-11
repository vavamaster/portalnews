import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET - user's saved searches
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ savedSearches: [] })
  const savedSearches = await db.savedSearch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ savedSearches })
}

// POST - save a search
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login' }, { status: 401 })
    const { name, filters } = await req.json()
    if (!name || !filters) return NextResponse.json({ error: 'Nome e filtros obrigatórios' }, { status: 400 })
    const ss = await db.savedSearch.create({
      data: {
        userId: user.id,
        name,
        filters: typeof filters === 'string' ? filters : JSON.stringify(filters),
      },
    })
    return NextResponse.json({ savedSearch: ss })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
