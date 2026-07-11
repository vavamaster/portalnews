// Reset SEO settings to generic defaults — remove any hardcoded brand data
import { db } from '../src/lib/db'
import { setSeoSettings } from '../src/lib/seo'

async function main() {
  console.log('=== Resetting SEO settings to generic defaults ===')

  // Generic defaults — no city name, no coordinates pre-filled
  const defaults: Record<string, string> = {
    site_name: 'Portal de Notícias',
    site_tagline: 'Jornalismo & Verdade',
    site_url: 'http://localhost:3000',
    site_description: 'Portal de notícias local. Cobertura completa do que acontece na cidade e região.',
    site_keywords: 'notícias,portal,jornalismo,cidade,região',
    site_about: 'Portal de notícias independente. Cobertura completa do que acontece na cidade e região.',
    site_city: '',
    site_state: '',
    weather_default_city: '',
    weather_default_lat: '',
    weather_default_lon: '',
    footer_about: 'Portal de notícias independente com cobertura completa da cidade e região.',
    footer_address: '',
    footer_phone: '',
    footer_email: 'contato@portal.com',
    footer_cnpj: '',
  }

  await setSeoSettings(defaults)
  for (const [k, v] of Object.entries(defaults)) {
    console.log(`  ✓ ${k} = ${JSON.stringify(v)}`)
  }

  // Also rename legacy admin/editor emails to generic ones
  const renames: Array<[string, string, string]> = [
    ['admin@portal.com', 'admin@portal.com', 'Admin Master'],
    ['editor@portal.com', 'editor@portal.com', 'Editor Demo'],
  ]
  for (const [oldEmail, newEmail, newName] of renames) {
    const u = await db.user.findUnique({ where: { email: oldEmail } })
    if (u) {
      const existing = await db.user.findUnique({ where: { email: newEmail } })
      if (!existing) {
        await db.user.update({ where: { id: u.id }, data: { email: newEmail, name: newName } })
        console.log(`  ✓ Renamed: ${oldEmail} → ${newEmail}`)
      } else {
        await db.user.delete({ where: { id: u.id } })
        console.log(`  ✓ Removed duplicate: ${oldEmail} (kept ${newEmail})`)
      }
    }
  }

  console.log('\n=== Done ===')
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
