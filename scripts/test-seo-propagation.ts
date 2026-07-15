/**
 * Test script: verify SEO settings propagation from DB → API → Header
 * 
 * Run: bunx tsx scripts/test-seo-propagation.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== SEO Settings Propagation Test ===\n')

  // 1. Check what's in the DB
  const allSettings = await prisma.seoSetting.findMany()
  console.log(`1. DB: ${allSettings.length} settings found`)

  const headerThemeKeys = allSettings.filter(s => s.key.startsWith('header_theme_'))
  console.log(`   header_theme_* keys: ${headerThemeKeys.length}`)
  
  if (headerThemeKeys.length > 0) {
    console.log('   Sample header_theme_* values:')
    headerThemeKeys.slice(0, 5).forEach(s => {
      console.log(`   - ${s.key} = "${s.value}"`)
    })
    if (headerThemeKeys.length > 5) {
      console.log(`   ... and ${headerThemeKeys.length - 5} more`)
    }
  } else {
    console.log('   ⚠️  NO header_theme_* settings in DB!')
    console.log('   → Admin never saved Header Theme settings, or save failed.')
  }

  // 2. Check specific keys that the Header consumes
  console.log('\n2. Critical settings for header layout:')
  const criticalKeys = [
    'header_template', 'site_name', 'site_logo', 'logo_style', 'logo_size',
    'primary_color', 'header_bg_color', 'header_text_color', 'nav_bg_color',
    'header_theme_topbar_bg_color', 'header_theme_topbar_text_color',
    'header_theme_nav_font_family', 'header_theme_nav_font_weight', 'header_theme_nav_font_size',
    'header_theme_nav_text_color', 'header_theme_nav_hover_color', 'header_theme_nav_active_color',
    'header_theme_breaking_speed', 'header_theme_breaking_bg_color',
    'header_theme_ad_fallback_enabled', 'header_theme_ad_fallback_text',
    'header_theme_classified_button_size', 'header_theme_store_button_size',
    'header_theme_quotes_widget_size',
  ]
  
  for (const key of criticalKeys) {
    const row = allSettings.find(s => s.key === key)
    if (row) {
      console.log(`   ✅ ${key} = "${row.value}"`)
    } else {
      console.log(`   ❌ ${key} — NOT SET (will use default)`)
    }
  }

  // 3. Simulate loadHeaderTheme
  console.log('\n3. Simulating loadHeaderTheme():')
  const settingsMap: Record<string, string> = {}
  allSettings.forEach(s => settingsMap[s.key] = s.value)

  const get = (key: string, fallback: any) => {
    const v = settingsMap[`header_theme_${key}`]
    if (v === undefined || v === '') return fallback
    if (typeof fallback === 'boolean') return v === 'true'
    if (typeof fallback === 'number') {
      const n = parseFloat(v)
      return isNaN(n) ? fallback : n
    }
    return v
  }

  const theme = {
    topbar_bg_color: get('topbar_bg_color', '#18181b'),
    topbar_text_color: get('topbar_text_color', '#d4d4d8'),
    topbar_show: get('topbar_show', true),
    nav_font_family: get('nav_font_family', 'inherit'),
    nav_font_weight: get('nav_font_weight', 600),
    nav_font_size: get('nav_font_size', 14),
    nav_text_color: get('nav_text_color', '#374151'),
    nav_hover_color: get('nav_hover_color', '#18181b'),
    nav_active_color: get('nav_active_color', '#2563eb'),
    breaking_speed: get('breaking_speed', 60),
    breaking_bg_color: get('breaking_bg_color', ''),
    ad_fallback_enabled: get('ad_fallback_enabled', true),
    ad_fallback_text: get('ad_fallback_text', 'Anuncie Aqui'),
    classified_button_size: get('classified_button_size', 'default'),
    store_button_size: get('store_button_size', 'default'),
    quotes_widget_size: get('quotes_widget_size', 'medium'),
  }
  
  console.log('   Computed theme:')
  Object.entries(theme).forEach(([k, v]) => {
    const isDefault = !settingsMap[`header_theme_${k}`]
    console.log(`   ${isDefault ? '⚪' : '🔵'} ${k} = ${v} ${isDefault ? '(default)' : '(custom)'}`)
  })

  // 4. Check home_layout_config
  console.log('\n4. Home layout config:')
  const homeConfig = allSettings.find(s => s.key === 'home_layout_config')
  if (homeConfig) {
    try {
      const parsed = JSON.parse(homeConfig.value)
      console.log(`   ✅ home_layout_config found with keys: ${Object.keys(parsed).join(', ')}`)
    } catch {
      console.log(`   ⚠️  home_layout_config exists but invalid JSON`)
    }
  } else {
    console.log(`   ⚪ home_layout_config not set (will use defaults)`)
  }

  // 5. Check SlideConfig
  console.log('\n5. Slide config:')
  const slideConfig = await prisma.slideConfig.findFirst({
    where: { scope: 'GLOBAL', categoryId: null },
  })
  if (slideConfig) {
    console.log(`   ✅ SlideConfig found: design=${slideConfig.designType}, filter=${slideConfig.filterType}, enabled=${slideConfig.isEnabled}`)
  } else {
    console.log(`   ⚪ No global SlideConfig (will use defaults)`)
  }

  // 6. Summary
  console.log('\n=== Summary ===')
  const customCount = headerThemeKeys.length
  const defaultCount = Object.keys(theme).length - customCount
  console.log(`Header theme: ${customCount} custom settings, ${Math.max(0, defaultCount)} using defaults`)
  
  if (customCount === 0) {
    console.log('\n⚠️  PROBLEM: No header_theme_* settings in DB.')
    console.log('   The admin never saved Header Theme settings.')
    console.log('   → Go to Admin → SEO → Header Theme tab → change something → Save')
    console.log('   → Then re-run this test to verify they persisted.')
  } else {
    console.log(`\n✅ ${customCount} header_theme_* settings found in DB.`)
    console.log('   If header doesn\'t reflect changes, the issue is in client-side')
    console.log('   propagation (HomeContent → Header), not in DB storage.')
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Test failed:', e)
  process.exit(1)
})
