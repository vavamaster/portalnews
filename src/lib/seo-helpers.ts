// Global SEO settings helper — provides site name, city, state, and other dynamic values
// All values are pulled from the SeoSetting table at runtime, so the portal is fully
// brand-agnostic. The admin configures everything in /admin > SEO; there are no hardcoded
// city names, states, coordinates or product names anywhere in the codebase.

import { getSeoSettings } from './seo'

export interface SeoSettings {
  site_name?: string
  site_tagline?: string
  site_url?: string
  site_description?: string
  site_keywords?: string
  site_about?: string
  site_city?: string
  site_state?: string
  google_analytics_id?: string
  site_logo?: string
  primary_color?: string
  og_image?: string
  twitter_card?: string
  fb_app_id?: string
  footer_about?: string
  footer_address?: string
  footer_phone?: string
  footer_email?: string
  footer_cnpj?: string
  facebook_url?: string
  instagram_url?: string
  twitter_url?: string
  youtube_url?: string
  whatsapp_url?: string
  weather_default_city?: string
  weather_default_lat?: string
  weather_default_lon?: string
  [key: string]: string | undefined
}

// Default values — used when SEO settings are not configured.
// IMPORTANT: these are intentionally generic. No city name, no state, no coordinates.
// The admin must fill site_name, site_city, site_state and weather_default_* after deploy.
export const DEFAULT_SEO: SeoSettings = {
  site_name: 'Portal de Notícias',
  site_tagline: 'Jornalismo & Verdade',
  site_url: 'http://localhost:3000',
  site_description: 'Portal de notícias local. Cobertura completa do que acontece na cidade e região.',
  site_city: '',
  site_state: '',
  site_about: 'Portal de notícias independente. Cobertura completa do que acontece na cidade e região.',
  footer_about: 'Portal de notícias independente com cobertura completa da cidade e região.',
  footer_address: '',
  footer_phone: '',
  footer_email: 'contato@portal.com',
  footer_cnpj: '',
  weather_default_city: '',
  weather_default_lat: '',
  weather_default_lon: '',
}

// ============= SYNC HELPERS =============

// Load all SEO settings from the DB
export async function loadSeoSettings(): Promise<Record<string, string>> {
  try {
    return await getSeoSettings()
  } catch {
    return {}
  }
}

// Get a single SEO value with fallback to DEFAULT_SEO
export function getSeoValue(settings: Record<string, string> | undefined, key: string, fallback?: string): string {
  if (settings && settings[key]) return settings[key]
  return fallback || DEFAULT_SEO[key as keyof SeoSettings] || ''
}

// Get site name (always falls back to a generic "Portal de Notícias")
export function getSiteName(settings?: Record<string, string>): string {
  return getSeoValue(settings, 'site_name', 'Portal de Notícias')
}

// Get site tagline
export function getSiteTagline(settings?: Record<string, string>): string {
  return getSeoValue(settings, 'site_tagline', 'Portal de Notícias')
}

// Get site initials (for logo badge)
export function getSiteInitials(settings?: Record<string, string>): string {
  const name = getSiteName(settings)
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

// Get city name only
export function getCity(settings?: Record<string, string>): string {
  return getSeoValue(settings, 'site_city', '')
}

// Get state (UF) only
export function getState(settings?: Record<string, string>): string {
  return getSeoValue(settings, 'site_state', '')
}

// Get city + state string (e.g., "Cidade, UF")
export function getCityState(settings?: Record<string, string>): string {
  const city = getCity(settings)
  const state = getState(settings)
  if (city && state) return `${city}, ${state}`
  if (city) return city
  if (state) return state
  return ''
}

// Get weather default location from SEO settings (city, lat, lon)
export function getWeatherLocation(settings?: Record<string, string>): {
  city: string
  lat: number | null
  lon: number | null
} {
  const city = getSeoValue(settings, 'weather_default_city', '')
  const latStr = getSeoValue(settings, 'weather_default_lat', '')
  const lonStr = getSeoValue(settings, 'weather_default_lon', '')
  const lat = latStr ? parseFloat(latStr) : null
  const lon = lonStr ? parseFloat(lonStr) : null
  return { city, lat: !isNaN(lat as number) ? lat : null, lon: !isNaN(lon as number) ? lon : null }
}

// Get contact email (footer)
export function getContactEmail(settings?: Record<string, string>): string {
  return getSeoValue(settings, 'footer_email', 'contato@portal.com')
}

// Get site URL for User-Agent / external API identification
export function getSiteUrlForUserAgent(settings?: Record<string, string>): string {
  const url = getSeoValue(settings, 'site_url', '')
  if (!url) return 'Portal-Noticias/1.0'
  try {
    const u = new URL(url)
    return `${u.hostname}/1.0`
  } catch {
    return 'Portal-Noticias/1.0'
  }
}

// ============= ASYNC HELPERS (load from DB if no settings passed) =============

// Get site name from DB
export async function getSiteNameAsync(): Promise<string> {
  const settings = await loadSeoSettings()
  return getSiteName(settings)
}

// Get full city+state from DB
export async function getCityStateAsync(): Promise<string> {
  const settings = await loadSeoSettings()
  return getCityState(settings)
}

// Get weather location from DB
export async function getWeatherLocationAsync(): Promise<{ city: string; lat: number | null; lon: number | null }> {
  const settings = await loadSeoSettings()
  return getWeatherLocation(settings)
}
