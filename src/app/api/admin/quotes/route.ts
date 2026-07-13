import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond } from '@/lib/api-helpers'
import { QUOTE_CATEGORIES } from '@/lib/quotes'

// GET - admin: list sources and products with latest quotes
export async function GET(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response

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
