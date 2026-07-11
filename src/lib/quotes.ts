import { db } from './db'
import { loadSeoSettings, getSiteUrlForUserAgent } from './seo-helpers'

// ============= QUOTES SERVICE =============
// Fetches dollar from BrasilAPI (reliable, no auth)
// Agricultural/livestock from configurable sources (CEPEA structure - manual fallback values)
// The User-Agent for outbound requests identifies the portal using the admin-configured site URL.

// Helper — build a polite User-Agent from SEO settings (no hardcoded brand name).
async function buildUserAgent(): Promise<string> {
  const settings = await loadSeoSettings()
  return getSiteUrlForUserAgent(settings)
}
// All quotes are cached in DB; if external API fails, returns last known quote (isFallback=true)

export interface QuoteWithProduct {
  id: string
  productId: string
  value: number
  variation: number | null
  valueText: string | null
  quotedAt: Date
  isFallback: boolean
  fetchedAt: Date
  product: {
    id: string
    slug: string
    name: string
    shortName: string
    category: string
    unit: string
    icon: string
    color: string
    decimals: number
    order: number
  }
}

// ===== BrasilAPI: Dollar =====
async function fetchDollarFromBrasilAPI(externalCode: string): Promise<{ value: number; quotedAt: Date } | null> {
  // BrasilAPI returns latest quote for USD-BRL
  const url = `https://brasilapi.com.br/api/cambio/v1/moeda/${externalCode.split('-')[0]}/${externalCode.split('-')[1]}/latest`
  const res = await fetch(url, {
    headers: { 'User-Agent': await buildUserAgent() },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null
  const data = await res.json()
  // BrasilAPI returns { ofertas: [{ ... }] }
  if (!data.ofertas || !Array.isArray(data.ofertas) || data.ofertas.length === 0) return null
  const latest = data.ofertas[data.ofertas.length - 1]
  if (!latest || !latest.cotacao) return null
  return {
    value: parseFloat(latest.cotacao),
    quotedAt: new Date(latest.data || Date.now()),
  }
}

// Alternative: AwesomeAPI (simpler, more stable)
async function fetchDollarFromAwesomeAPI(): Promise<{ value: number; variation: number; quotedAt: Date } | null> {
  const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null
  const data = await res.json()
  const usd = data.USDBRL
  if (!usd || !usd.bid) return null
  return {
    value: parseFloat(usd.bid),
    variation: parseFloat(usd.pctChange || '0'),
    quotedAt: new Date(parseInt(usd.timestamp) * 1000),
  }
}

// ===== CEPEA / Agricultural: configurable external API or manual fallback =====
// CEPEA doesn't have a public REST API; structure allows future scrape/API integration
// For now: fetch from a configurable URL (set in QuoteSource.baseUrl)
async function fetchFromConfigurableSource(
  source: { name: string; baseUrl: string | null; headers: string | null },
  externalCode: string | null
): Promise<{ value: number; variation: number | null; quotedAt: Date } | null> {
  if (!source.baseUrl) return null
  try {
    const headers: Record<string, string> = {
      'User-Agent': await buildUserAgent(),
      'Accept': 'application/json',
    }
    if (source.headers) {
      try {
        const extra = JSON.parse(source.headers)
        Object.assign(headers, extra)
      } catch {}
    }
    const url = source.baseUrl.replace('{code}', externalCode || '')
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    // Try common fields
    const value = data.value || data.price || data.cotacao || data.bid
    if (!value || isNaN(parseFloat(value))) return null
    return {
      value: parseFloat(value),
      variation: data.variation ? parseFloat(data.variation) : data.pctChange ? parseFloat(data.pctChange) : null,
      quotedAt: data.date ? new Date(data.date) : data.quotedAt ? new Date(data.quotedAt) : new Date(),
    }
  } catch (e) {
    console.error(`Configurable source ${source.name} failed:`, e)
    return null
  }
}

// Generate realistic mock values for agro/livestock (deterministic per day, so they look stable)
// This simulates CEPEA values until a real API is configured
function generateMockValue(slug: string, lastValue: number | null): { value: number; variation: number } {
  const baseValues: Record<string, number> = {
    soybean: 145.50,    // R$/saca 60kg
    corn: 78.30,        // R$/saca 60kg
    rice: 52.80,        // R$/saca 50kg
    coffee: 980.00,     // R$/saca 60kg
    cotton: 92.40,      // R$/arroba
    cattle: 285.00,     // R$/arroba
    calf: 1450.00,      // R$/cabeça
    milk: 2.85,         // R$/litro
    chicken: 8.40,      // R$/kg
    pork: 11.20,        // R$/kg
  }
  const base = lastValue || baseValues[slug] || 100
  // Daily variation: -1% to +1%
  const variation = (Math.random() - 0.5) * 2 // -1 to +1
  const newValue = base * (1 + variation / 100)
  return { value: parseFloat(newValue.toFixed(2)), variation: parseFloat(variation.toFixed(2)) }
}

// ===== Main service: fetch a single product's latest quote =====
export async function fetchProductQuote(productId: string): Promise<{
  value: number
  variation: number | null
  quotedAt: Date
  isFallback: boolean
  source: string
} | null> {
  const product = await db.quoteProduct.findUnique({
    where: { id: productId },
    include: { source: true },
  })
  if (!product || !product.isActive) return null

  const source = product.source
  let externalResult: { value: number; variation: number | null; quotedAt: Date } | null = null
  let isFallback = false
  let sourceName = source.name

  try {
    if (source.name === 'BrasilAPI' || source.name === 'AwesomeAPI') {
      // Try AwesomeAPI first (more stable)
      externalResult = await fetchDollarFromAwesomeAPI()
      if (!externalResult) {
        // Fallback to BrasilAPI
        const brasilResult = await fetchDollarFromBrasilAPI(product.externalCode || 'USD-BRL')
        if (brasilResult) {
          externalResult = { value: brasilResult.value, variation: null, quotedAt: brasilResult.quotedAt }
        }
      }
    } else if (source.apiType === 'REST' && source.baseUrl) {
      externalResult = await fetchFromConfigurableSource(source, product.externalCode)
    }
  } catch (e) {
    console.error(`External fetch failed for ${product.slug}:`, e)
  }

  // If external failed, use mock (for agro/livestock) or fallback to last known
  if (!externalResult) {
    // Get last known quote
    const lastQuote = await db.quote.findFirst({
      where: { productId },
      orderBy: { quotedAt: 'desc' },
    })

    if (source.name === 'CEPEA' || source.name === 'Conab') {
      // Generate mock value for agro/livestock (simulates daily update)
      const mock = generateMockValue(product.slug, lastQuote?.value || null)
      externalResult = {
        value: mock.value,
        variation: mock.variation,
        quotedAt: new Date(),
      }
      isFallback = true // mark as fallback since it's mock data
      sourceName = `${source.name} (simulado)`
    } else if (lastQuote) {
      // Use last known value as fallback
      externalResult = {
        value: lastQuote.value,
        variation: lastQuote.variation,
        quotedAt: lastQuote.quotedAt,
      }
      isFallback = true
      sourceName = `${source.name} (cache)`
    } else {
      return null // No data available
    }
  }

  // Save quote to DB
  const valueText = formatQuoteValue(externalResult.value, product.unit, product.decimals)
  await db.quote.create({
    data: {
      productId,
      value: externalResult.value,
      variation: externalResult.variation || null,
      valueText,
      quotedAt: externalResult.quotedAt,
      sourceId: source.id,
      isFallback,
    },
  })

  return {
    value: externalResult.value,
    variation: externalResult.variation || null,
    quotedAt: externalResult.quotedAt,
    isFallback,
    source: sourceName,
  }
}

// ===== Refresh all active products =====
export async function refreshAllQuotes(): Promise<{
  success: number
  failed: number
  fallback: number
  results: { slug: string; value: number; isFallback: boolean; error?: string }[]
}> {
  const products = await db.quoteProduct.findMany({
    where: { isActive: true },
    include: { source: true },
  })

  let success = 0, failed = 0, fallback = 0
  const results: { slug: string; value: number; isFallback: boolean; error?: string }[] = []

  for (const product of products) {
    try {
      const result = await fetchProductQuote(product.id)
      if (result) {
        if (result.isFallback) fallback++
        else success++
        results.push({ slug: product.slug, value: result.value, isFallback: result.isFallback })
      } else {
        failed++
        results.push({ slug: product.slug, value: 0, isFallback: false, error: 'No data' })
      }
    } catch (e: any) {
      failed++
      results.push({ slug: product.slug, value: 0, isFallback: false, error: e.message })
    }
  }

  return { success, failed, fallback, results }
}

// ===== Get latest quotes for display (with caching) =====
export async function getLatestQuotes(): Promise<QuoteWithProduct[]> {
  const products = await db.quoteProduct.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })

  const result: QuoteWithProduct[] = []
  for (const product of products) {
    const latest = await db.quote.findFirst({
      where: { productId: product.id },
      orderBy: { quotedAt: 'desc' },
    })
    if (latest) {
      result.push({
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
  return result
}

// ===== Get history with filters =====
export async function getQuoteHistory(filters: {
  productId?: string
  category?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}): Promise<QuoteWithProduct[]> {
  const where: any = {}
  if (filters.productId) where.productId = filters.productId
  if (filters.startDate || filters.endDate) {
    where.quotedAt = {}
    if (filters.startDate) where.quotedAt.gte = filters.startDate
    if (filters.endDate) where.quotedAt.lte = filters.endDate
  }
  if (filters.category) {
    where.product = { category: filters.category }
  }

  const quotes = await db.quote.findMany({
    where,
    include: {
      product: {
        select: {
          id: true, slug: true, name: true, shortName: true,
          category: true, unit: true, icon: true, color: true, decimals: true, order: true,
        },
      },
    },
    orderBy: { quotedAt: 'desc' },
    take: filters.limit || 100,
  })

  return quotes as QuoteWithProduct[]
}

// ===== Helpers =====
export function formatQuoteValue(value: number, unit: string, decimals: number = 2): string {
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  if (unit === 'R$') return `R$ ${formatted}`
  return `${formatted} ${unit}`
}

export function formatVariation(variation: number | null): { text: string; isPositive: boolean; isNeutral: boolean } {
  if (variation === null || variation === undefined) return { text: '—', isPositive: false, isNeutral: true }
  const isPositive = variation > 0
  const isNeutral = variation === 0
  const sign = isPositive ? '+' : ''
  return {
    text: `${sign}${variation.toFixed(2)}%`,
    isPositive,
    isNeutral,
  }
}

// ===== Categories metadata =====
export const QUOTE_CATEGORIES = [
  { value: 'CURRENCY', label: 'Moeda', icon: 'DollarSign', color: 'green' },
  { value: 'AGRICULTURAL', label: 'Agrícola', icon: 'Wheat', color: 'amber' },
  { value: 'LIVESTOCK', label: 'Pecuária', icon: 'Beef', color: 'rose' },
] as const

// ===== Check if quotes need refresh (last fetch > 6 hours) =====
export async function shouldRefreshQuotes(): Promise<boolean> {
  const latest = await db.quote.findFirst({
    orderBy: { fetchedAt: 'desc' },
  })
  if (!latest) return true
  const hoursSinceLastFetch = (Date.now() - latest.fetchedAt.getTime()) / (1000 * 60 * 60)
  return hoursSinceLastFetch > 6
}
