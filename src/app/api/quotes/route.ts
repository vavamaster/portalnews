import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shouldRefreshQuotes } from '@/lib/quotes'
import { handleApiError } from '@/lib/api-helpers'

// GET /api/quotes - public endpoint, returns latest quotes (auto-refresh if stale)
// Query: ?state=MT (filter by UF code)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const state = url.searchParams.get('state')

    // Auto-refresh if stale (last fetch > 6h) - runs in background, doesn't block response
    const needsRefresh = await shouldRefreshQuotes()
    if (needsRefresh) {
      import('@/lib/quotes').then(async ({ refreshAllQuotes }) => {
        try {
          await refreshAllQuotes()
          console.debug('✅ Quotes auto-refreshed')
        } catch (e) {
          console.error('Auto-refresh failed:', e)
        }
      })
    }

    // Get all active products (filter showInHeader for public header display)
    let products = await db.quoteProduct.findMany({
      where: { isActive: true, showInHeader: true },
      orderBy: { order: 'asc' },
    })

    // Filter by state if provided
    if (state && state !== 'ALL') {
      products = products.filter(p => {
        if (!p.states) return true // nacional = show in all states
        try {
          const states = JSON.parse(p.states) as string[]
          return states.includes(state)
        } catch {
          return true
        }
      })
    }

    // Get latest quote for each product
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
            id: product.id,
            slug: product.slug,
            name: product.name,
            shortName: product.shortName,
            category: product.category,
            unit: product.unit,
            icon: product.icon,
            color: product.color,
            decimals: product.decimals,
            order: product.order,
          },
        })
      }
    }

    return NextResponse.json({
      quotes,
      count: quotes.length,
      lastUpdated: quotes[0]?.fetchedAt || null,
      refreshing: needsRefresh,
      selectedState: state || 'ALL',
    })
  } catch (e: any) {
    return handleApiError(e, 'quotes list')
  }
}
