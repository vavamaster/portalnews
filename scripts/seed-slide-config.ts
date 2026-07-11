import { db } from '../src/lib/db'

async function main() {
  console.log('🌱 Seeding slide configs...')

  // Global config
  await db.slideConfig.upsert({
    where: { scope_categoryId: { scope: 'GLOBAL', categoryId: '__null__' as any } },
    update: {},
    create: {
      scope: 'GLOBAL',
      categoryId: null,
      isEnabled: true,
      postCount: 5,
      autoPlay: true,
      delayMs: 5000,
      designType: 'overlay',
      showDots: true,
      showArrows: true,
      showExcerpt: true,
      showCategory: true,
      showAuthor: false,
      heightPreset: 'tall',
      filterType: 'featured',
    },
  }).catch(() => {
    // SQLite doesn't handle null in unique well, try create directly
  })

  // Try to find existing
  let global = await db.slideConfig.findFirst({ where: { scope: 'GLOBAL', categoryId: null } })
  if (!global) {
    global = await db.slideConfig.create({
      data: {
        scope: 'GLOBAL',
        categoryId: null,
        isEnabled: true,
        postCount: 5,
        autoPlay: true,
        delayMs: 5000,
        designType: 'overlay',
        showDots: true,
        showArrows: true,
        showExcerpt: true,
        showCategory: true,
        showAuthor: false,
        heightPreset: 'tall',
        filterType: 'featured',
      },
    })
    console.log('✅ Global slide config created')
  } else {
    console.log('ℹ️ Global slide config already exists')
  }

  // Per-category configs with varied designs
  const categories = await db.category.findMany()
  const designs = ['overlay', 'split', 'minimal', 'cards']
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]
    const existing = await db.slideConfig.findFirst({
      where: { scope: 'CATEGORY', categoryId: cat.id },
    })
    if (existing) continue

    await db.slideConfig.create({
      data: {
        scope: 'CATEGORY',
        categoryId: cat.id,
        isEnabled: true,
        postCount: 4,
        autoPlay: true,
        delayMs: 4000 + (i % 3) * 1000,
        designType: designs[i % designs.length],
        showDots: true,
        showArrows: true,
        showExcerpt: true,
        showCategory: true,
        showAuthor: false,
        heightPreset: i % 2 === 0 ? 'medium' : 'tall',
        filterType: 'latest',
      },
    })
  }
  console.log(`✅ Category slide configs created: ${categories.length}`)

  console.log('✅ Slide config seed complete!')
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
