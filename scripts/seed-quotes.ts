import { db } from '../src/lib/db'

async function main() {
  console.log('🌱 Seeding quotes module...')

  // ===== Sources =====
  const sources = [
    {
      name: 'AwesomeAPI',
      description: 'API gratuita de cotações de moedas (mais estável que BCB)',
      baseUrl: 'https://economia.awesomeapi.com.br',
      apiType: 'REST',
      isActive: true,
      priority: 1,
    },
    {
      name: 'BrasilAPI',
      description: 'API governamental brasileira de cotações',
      baseUrl: 'https://brasilapi.com.br',
      apiType: 'REST',
      isActive: true,
      priority: 2,
    },
    {
      name: 'CEPEA',
      description: 'Centro de Estudos Avançados em Economia Aplicada (agropecuária) - dados simulados até integração oficial',
      baseUrl: null,
      apiType: 'MANUAL',
      isActive: true,
      priority: 1,
    },
    {
      name: 'Conab',
      description: 'Companhia Nacional de Abastecimento - dados simulados até integração oficial',
      baseUrl: null,
      apiType: 'MANUAL',
      isActive: true,
      priority: 2,
    },
  ]

  const sourceMap: Record<string, string> = {}
  for (const s of sources) {
    const created = await db.quoteSource.upsert({
      where: { name: s.name },
      update: s,
      create: s,
    })
    sourceMap[s.name] = created.id
  }
  console.log('✅ Sources seeded:', Object.keys(sourceMap).length)

  // ===== Products =====
  const products = [
    // Currency
    { slug: 'dollar', name: 'Dólar Comercial', shortName: 'USD', category: 'CURRENCY', unit: 'R$', icon: 'DollarSign', color: 'green', sourceName: 'AwesomeAPI', externalCode: 'USD-BRL', decimals: 4, order: 1 },
    // Agricultural
    { slug: 'soybean', name: 'Soja', shortName: 'Soja', category: 'AGRICULTURAL', unit: 'saca 60kg', icon: 'Wheat', color: 'amber', sourceName: 'CEPEA', externalCode: 'SOJA', decimals: 2, order: 2 },
    { slug: 'corn', name: 'Milho', shortName: 'Milho', category: 'AGRICULTURAL', unit: 'saca 60kg', icon: 'Wheat', color: 'amber', sourceName: 'CEPEA', externalCode: 'MILHO', decimals: 2, order: 3 },
    { slug: 'rice', name: 'Arroz', shortName: 'Arroz', category: 'AGRICULTURAL', unit: 'saca 50kg', icon: 'Wheat', color: 'amber', sourceName: 'CEPEA', externalCode: 'ARROZ', decimals: 2, order: 4 },
    { slug: 'coffee', name: 'Café', shortName: 'Café', category: 'AGRICULTURAL', unit: 'saca 60kg', icon: 'Coffee', color: 'amber', sourceName: 'CEPEA', externalCode: 'CAFE', decimals: 2, order: 5 },
    { slug: 'cotton', name: 'Algodão', shortName: 'Algodão', category: 'AGRICULTURAL', unit: 'arroba', icon: 'Wheat', color: 'amber', sourceName: 'CEPEA', externalCode: 'ALGODAO', decimals: 2, order: 6 },
    // Livestock
    { slug: 'cattle', name: 'Boi Gordo', shortName: 'Boi', category: 'LIVESTOCK', unit: 'arroba', icon: 'Beef', color: 'rose', sourceName: 'CEPEA', externalCode: 'BOI', decimals: 2, order: 7 },
    { slug: 'calf', name: 'Bezerro', shortName: 'Bezerro', category: 'LIVESTOCK', unit: 'cabeça', icon: 'Beef', color: 'rose', sourceName: 'CEPEA', externalCode: 'BEZERRO', decimals: 2, order: 8 },
    { slug: 'milk', name: 'Leite', shortName: 'Leite', category: 'LIVESTOCK', unit: 'litro', icon: 'Milk', color: 'rose', sourceName: 'CEPEA', externalCode: 'LEITE', decimals: 3, order: 9 },
    { slug: 'chicken', name: 'Frango', shortName: 'Frango', category: 'LIVESTOCK', unit: 'kg', icon: 'Beef', color: 'rose', sourceName: 'CEPEA', externalCode: 'FRANGO', decimals: 2, order: 10 },
    { slug: 'pork', name: 'Suíno', shortName: 'Suíno', category: 'LIVESTOCK', unit: 'kg', icon: 'Beef', color: 'rose', sourceName: 'CEPEA', externalCode: 'SUINO', decimals: 2, order: 11 },
  ]

  for (const p of products) {
    const sourceId = sourceMap[p.sourceName]
    if (!sourceId) {
      console.error(`Source not found for ${p.slug}: ${p.sourceName}`)
      continue
    }
    const { sourceName, ...productData } = p
    await db.quoteProduct.upsert({
      where: { slug: p.slug },
      update: { ...productData, sourceId },
      create: { ...productData, sourceId },
    })
  }
  console.log('✅ Products seeded:', products.length)

  // ===== Initial quotes (so the UI has data immediately) =====
  const initialQuotes = [
    { slug: 'dollar', value: 5.4231, variation: 0.32 },
    { slug: 'soybean', value: 145.50, variation: -0.85 },
    { slug: 'corn', value: 78.30, variation: 1.20 },
    { slug: 'rice', value: 52.80, variation: 0.15 },
    { slug: 'coffee', value: 980.00, variation: 2.10 },
    { slug: 'cotton', value: 92.40, variation: -0.45 },
    { slug: 'cattle', value: 285.00, variation: 0.78 },
    { slug: 'calf', value: 1450.00, variation: -1.20 },
    { slug: 'milk', value: 2.850, variation: 0.50 },
    { slug: 'chicken', value: 8.40, variation: -0.30 },
    { slug: 'pork', value: 11.20, variation: 0.90 },
  ]

  const now = new Date()
  for (const q of initialQuotes) {
    const product = await db.quoteProduct.findUnique({ where: { slug: q.slug } })
    if (!product) continue
    const existing = await db.quote.findFirst({
      where: { productId: product.id, quotedAt: now },
    })
    if (existing) continue
    const valueText = formatValue(q.value, product.unit, product.decimals)
    await db.quote.create({
      data: {
        productId: product.id,
        value: q.value,
        variation: q.variation,
        valueText,
        quotedAt: now,
        sourceId: product.sourceId,
        isFallback: false,
      },
    })
  }
  console.log('✅ Initial quotes seeded:', initialQuotes.length)

  console.log('✅ Quotes seed complete!')
}

function formatValue(value: number, unit: string, decimals: number = 2): string {
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  if (unit === 'R$') return `R$ ${formatted}`
  return `${formatted} ${unit}`
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
