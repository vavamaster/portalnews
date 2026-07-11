import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { QUOTE_CATEGORIES } from '@/lib/quotes'

// GET - admin: list sources and products with latest quotes
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const [sources, products] = await Promise.all([
    db.quoteSource.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { priority: 'asc' },
    }),
    db.quoteProduct.findMany({
      include: {
        source: true,
        quotes: { orderBy: { quotedAt: 'desc' }, take: 1 },
      },
      orderBy: { order: 'asc' },
    }),
  ])

  return NextResponse.json({
    sources,
    products: products.map(p => ({
      ...p,
      latestQuote: p.quotes[0] || null,
      quotes: undefined, // remove nested array
    })),
    categories: QUOTE_CATEGORIES,
  })
}
