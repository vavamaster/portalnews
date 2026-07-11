// Set up sensible functional defaults for the portal — these make the portal
// immediately usable out of the box (header, footer, weather, AI prompts etc.)
// while still being brand-agnostic. The admin can refine any of these via /admin > SEO.
import { db } from '../src/lib/db'
import { setSeoSettings } from '../src/lib/seo'

async function main() {
  console.log('=== Setting up functional defaults for the portal ===')

  const defaults: Record<string, string> = {
    // === Brand ===
    site_name: 'Portal de Notícias',
    site_tagline: 'Jornalismo & Verdade',
    site_url: 'http://localhost:3000',
    site_description: 'Portal de notícias local. Cobertura completa do que acontece na cidade e região. Política, esportes, economia, cultura, polícia e mais.',
    site_keywords: 'notícias,portal,jornalismo,cidade,região',
    site_about: 'Portal de notícias independente com cobertura completa da cidade e região.',
    // City/State intentionally empty — admin fills with the real city
    site_city: '',
    site_state: '',

    // === Appearance ===
    site_logo: '',
    primary_color: '#2563eb',
    og_image: '',
    twitter_card: 'summary_large_image',
    fb_app_id: '',

    // === Footer ===
    footer_about: 'Portal de notícias independente com cobertura completa da cidade e região.',
    footer_address: '',
    footer_phone: '',
    footer_email: 'contato@portal.com',
    footer_cnpj: '',

    // === Social ===
    facebook_url: '',
    instagram_url: '',
    twitter_url: '',
    youtube_url: '',
    whatsapp_url: '',

    // === Weather (intentionally empty — admin fills) ===
    weather_default_city: '',
    weather_default_lat: '',
    weather_default_lon: '',

    // === Points & Credits ===
    points_per_read: '10',
    max_reads_per_post: '50',
    points_per_reaction: '5',
    max_reactions_per_post: '30',
    credits_conversion_rate: '10',
    free_ad_cost_credits: '20',
    impressions_per_credit: '50',

    // === Check-in ===
    checkin_base_points: '10',
    checkin_streak_3_multiplier: '1.5',
    checkin_streak_7_multiplier: '2',
    checkin_streak_30_multiplier: '3',

    // === Referral & Bonuses ===
    referral_bonus_points: '50',
    review_bonus_points: '5',
    profile_complete_bonus_points: '30',

    // === Editor ===
    editor_default_auto_approve_threshold: '10',
    editor_default_auto_reject_hours: '48',
    editor_default_post_limit_daily: '5',

    // === Classifieds ===
    classifieds_max_distance_km: '50',
  }

  await setSeoSettings(defaults)
  for (const [k, v] of Object.entries(defaults)) {
    console.log(`  ✓ ${k} = ${JSON.stringify(v)}`)
  }

  console.log('\n=== Done. The portal is now functional with sensible defaults. ===')
  console.log('=== The admin can refine any value via /admin > SEO ===')
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
