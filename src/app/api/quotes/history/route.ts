import { NextRequest, NextResponse } from 'next/server'
import { getQuoteHistory } from '@/lib/quotes'
import { handleApiError } from '@/lib/api-helpers'

// GET /api/quotes/history - public endpoint with filters
// Query: ?productId=...&category=...&startDate=...&endDate=...&limit=...
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const filters = {
      productId: url.searchParams.get('productId') || undefined,
      category: url.searchParams.get('category') || undefined,
      startDate: url.searchParams.get('startDate') ? new Date(url.searchParams.get('startDate')!) : undefined,
      endDate: url.searchParams.get('endDate') ? new Date(url.searchParams.get('endDate')!) : undefined,
      limit: parseInt(url.searchParams.get('limit') || '100', 10),
    }
    const quotes = await getQuoteHistory(filters)
    return NextResponse.json({ quotes, count: quotes.length })
  } catch (e: any) {
    return handleApiError(e, 'quotes history')
  }
}
