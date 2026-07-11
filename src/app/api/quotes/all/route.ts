import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/quotes/all - returns ALL active quotes (for the public indicators page)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const state = url.searchParams.get('state')

  let products = await db.quoteProduct.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })

  if (state && state !== 'ALL') {
    products = products.filter(p => {
      if (!p.states) return true
      try {
        const states = JSON.parse(p.states) as string[]
        return states.includes(state)
      } catch { return true }
    })
  }

  const quotes: Array<any> = []
  for (const product of products) {
    const latest = await db.quote.findFirst({
      where: { productId: product.id },
      orderBy: { quotedAt: 'desc' },
    })
    if (latest) {
      quotes.push({
        ...latest,
        product: {
          id: product.id, slug: product.slug, name: product.name, shortName: product.shortName,
          category: product.category, unit: product.unit, icon: product.icon, color: product.color,
          decimals: product.decimals, order: product.order,
        },
      })
    }
  }

  // Group by category
  const grouped: Record<string, any[]> = {}
  for (const q of quotes) {
    const cat = q.product.category
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(q)
  }

  return NextResponse.json({ quotes, grouped, count: quotes.length })
}
