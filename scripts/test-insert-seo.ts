import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Insert a few header_theme_* settings to test propagation
  await prisma.seoSetting.upsert({
    where: { key: 'header_theme_topbar_bg_color' },
    update: { value: '#1e3a5f' }, // custom blue (not default #18181b)
    create: { key: 'header_theme_topbar_bg_color', value: '#1e3a5f' },
  })
  
  await prisma.seoSetting.upsert({
    where: { key: 'header_theme_nav_font_size' },
    update: { value: '16' },
    create: { key: 'header_theme_nav_font_size', value: '16' },
  })

  await prisma.seoSetting.upsert({
    where: { key: 'header_theme_breaking_speed' },
    update: { value: '30' },
    create: { key: 'header_theme_breaking_speed', value: '30' },
  })

  await prisma.seoSetting.upsert({
    where: { key: 'header_theme_nav_hover_color' },
    update: { value: '#dc2626' }, // red hover
    create: { key: 'header_theme_nav_hover_color', value: '#dc2626' },
  })

  // Verify
  const count = await prisma.seoSetting.count({
    where: { key: { startsWith: 'header_theme_' } },
  })
  console.log(`✅ Inserted 4 header_theme_* settings. Total in DB: ${count}`)

  // Read them back
  const rows = await prisma.seoSetting.findMany({
    where: { key: { startsWith: 'header_theme_' } },
  })
  rows.forEach(r => console.log(`   ${r.key} = "${r.value}"`))

  await prisma.$disconnect()
}

main().catch(console.error)
