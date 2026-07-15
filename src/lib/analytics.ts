/**
 * GeoIP helper — resolve IP to country/region/city/ISP.
 *
 * Strategy:
 * 1. Check Vercel/Cloudflare headers (cf-ipcountry, x-vercel-ip-country, etc.)
 *    — these are set by the CDN/edge, no external API call needed
 * 2. Check GeoIpCache in DB (cached for 30 days)
 * 3. Fallback: call ipapi.co (free, 30k req/month, no API key needed)
 *    — only for IPs not in cache + no CDN headers
 *
 * LGPD compliance:
 * - Never log the raw IP — only SHA-256 hash
 * - Geo data is coarse (city-level), not precise
 * - Cache TTL 30 days, then re-resolve
 */

import { db } from './db'
import { createHash } from 'crypto'

export interface GeoData {
  ipHash: string
  country: string | null
  countryCode: string | null
  region: string | null
  regionCode: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  isp: string | null
}

/** Hash an IP address with SHA-256 (LGPD — never store raw IP). */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

/**
 * Extract client IP from request headers.
 * Priority: x-forwarded-for (first IP) > x-real-ip > cf-connecting-ip > x-vercel-forwarded-for
 */
export function getClientIp(req: Request): string {
  const headers = req.headers
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    // x-forwarded-for can be "client, proxy1, proxy2" — take the first
    return xff.split(',')[0].trim()
  }
  return (
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    headers.get('x-vercel-forwarded-for') ||
    '127.0.0.1'
  )
}

/**
 * Extract geo data from CDN headers (Vercel/Cloudflare).
 * These are set automatically by the edge — no API call needed.
 */
function extractFromHeaders(req: Request): Partial<GeoData> {
  const h = req.headers
  const countryCode = h.get('x-vercel-ip-country') || h.get('cf-ipcountry')
  if (!countryCode) return {}

  return {
    countryCode,
    country: h.get('x-vercel-ip-country-name') || countryNameFromCode(countryCode) || null,
    region: h.get('x-vercel-ip-country-region') || null,
    regionCode: h.get('x-vercel-ip-country-region-code') || null,
    city: h.get('x-vercel-ip-city') || null,
    latitude: h.get('x-vercel-ip-latitude') ? parseFloat(h.get('x-vercel-ip-latitude')!) : null,
    longitude: h.get('x-vercel-ip-longitude') ? parseFloat(h.get('x-vercel-ip-longitude')!) : null,
  }
}

/** Map ISO country code to display name (covers top countries). */
function countryNameFromCode(code: string): string | null {
  const names: Record<string, string> = {
    BR: 'Brazil', US: 'United States', AR: 'Argentina', PT: 'Portugal',
    GB: 'United Kingdom', DE: 'Germany', FR: 'France', ES: 'Spain',
    IT: 'Italy', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland',
    CA: 'Canada', MX: 'Mexico', CL: 'Chile', CO: 'Colombia', PE: 'Peru',
    UY: 'Uruguay', PY: 'Paraguay', BO: 'Bolivia', EC: 'Ecuador',
    VE: 'Venezuela', AU: 'Australia', JP: 'Japan', CN: 'China',
    IN: 'India', RU: 'Russia', ZA: 'South Africa', AE: 'United Arab Emirates',
  }
  return names[code.toUpperCase()] || null
}

/**
 * Resolve geo data for an IP.
 * Tries: CDN headers → DB cache → ipapi.co fallback.
 */
export async function resolveGeoData(req: Request, ip: string): Promise<GeoData> {
  const ipHash = hashIp(ip)

  // Skip geo resolution for localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return {
      ipHash,
      country: 'Local',
      countryCode: 'LO',
      region: null,
      regionCode: null,
      city: null,
      latitude: null,
      longitude: null,
      isp: null,
    }
  }

  // 1. Try CDN headers (fastest, no API call)
  const fromHeaders = extractFromHeaders(req)
  if (fromHeaders.countryCode) {
    return {
      ipHash,
      country: fromHeaders.country || null,
      countryCode: fromHeaders.countryCode,
      region: fromHeaders.region || null,
      regionCode: fromHeaders.regionCode || null,
      city: fromHeaders.city || null,
      latitude: fromHeaders.latitude || null,
      longitude: fromHeaders.longitude || null,
      isp: null, // CDN headers don't include ISP
    }
  }

  // 2. Check DB cache
  try {
    const cached = await db.geoIpCache.findUnique({ where: { ipHash } })
    if (cached) {
      // Refresh if older than 30 days
      const ageMs = Date.now() - new Date(cached.fetchedAt).getTime()
      if (ageMs < 30 * 24 * 60 * 60 * 1000) {
        return {
          ipHash: cached.ipHash,
          country: cached.country,
          countryCode: cached.countryCode,
          region: cached.region,
          regionCode: cached.regionCode,
          city: cached.city,
          latitude: cached.latitude,
          longitude: cached.longitude,
          isp: cached.isp,
        }
      }
    }
  } catch {}

  // 3. Fallback: call ipapi.co (free, 30k/month)
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'PortalNews-Analytics/1.0' },
    })
    if (res.ok) {
      const data = await res.json()
      if (data && !data.error) {
        const geo: GeoData = {
          ipHash,
          country: data.country_name || null,
          countryCode: data.country_code || null,
          region: data.region || null,
          regionCode: data.region_code || null,
          city: data.city || null,
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          isp: data.org || data.asn || null,
        }
        // Cache in DB
        try {
          await db.geoIpCache.upsert({
            where: { ipHash },
            create: {
              ipHash,
              country: geo.country,
              countryCode: geo.countryCode,
              region: geo.region,
              regionCode: geo.regionCode,
              city: geo.city,
              latitude: geo.latitude,
              longitude: geo.longitude,
              isp: geo.isp,
            },
            update: {
              country: geo.country,
              countryCode: geo.countryCode,
              region: geo.region,
              regionCode: geo.regionCode,
              city: geo.city,
              latitude: geo.latitude,
              longitude: geo.longitude,
              isp: geo.isp,
              fetchedAt: new Date(),
            },
          })
        } catch {}
        return geo
      }
    }
  } catch (e) {
    // Network error or timeout — silently fail
    console.debug('[GeoIP] ipapi.co failed for', ipHash.substring(0, 8), ':', (e as Error).message)
  }

  // 4. Final fallback — unknown geo
  return {
    ipHash,
    country: null,
    countryCode: null,
    region: null,
    regionCode: null,
    city: null,
    latitude: null,
    longitude: null,
    isp: null,
  }
}

// ============================================================
// User-Agent parsing (lightweight, no external dep)
// ============================================================

export interface DeviceData {
  device: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'BOT'
  os: string | null
  browser: string | null
}

/** Parse User-Agent into device type + OS + browser. */
export function parseUserAgent(ua: string | null): DeviceData {
  if (!ua) return { device: 'DESKTOP', os: null, browser: null }

  const lower = ua.toLowerCase()

  // Bot detection
  if (/bot|crawler|spider|crawling|facebookexternalhit|twitterbot|googlebot|bingbot|yandex|slurp|duckduckbot|baiduspider|semrush/.test(lower)) {
    return { device: 'BOT', os: null, browser: null }
  }

  // Device type
  let device: DeviceData['device'] = 'DESKTOP'
  if (/ipad|tablet|playbook|silk/.test(lower)) {
    device = 'TABLET'
  } else if (/mobile|iphone|ipod|android.*mobile|blackberry|opera mini|windows phone/.test(lower)) {
    device = 'MOBILE'
  }

  // OS detection
  let os: string | null = null
  if (/windows nt 10/.test(lower)) os = 'Windows'
  else if (/windows nt 6\.3/.test(lower)) os = 'Windows 8.1'
  else if (/windows nt 6\.2/.test(lower)) os = 'Windows 8'
  else if (/windows nt 6\.1/.test(lower)) os = 'Windows 7'
  else if (/windows/.test(lower)) os = 'Windows'
  else if (/mac os x|macintosh/.test(lower)) os = 'macOS'
  else if (/android/.test(lower)) {
    const m = lower.match(/android (\d+)/)
    os = m ? `Android ${m[1]}` : 'Android'
  }
  else if (/iphone|ipad|ipod/.test(lower)) {
    const m = lower.match(/os (\d+)/)
    os = m ? `iOS ${m[1]}` : 'iOS'
  }
  else if (/linux/.test(lower)) os = 'Linux'
  else if (/cros/.test(lower)) os = 'ChromeOS'

  // Browser detection (check in order of specificity)
  let browser: string | null = null
  if (/edg\//.test(lower)) browser = 'Edge'
  else if (/opr\/|opera/.test(lower)) browser = 'Opera'
  else if (/chrome|crios/.test(lower) && !/edg\//.test(lower)) browser = 'Chrome'
  else if (/firefox|fxios/.test(lower)) browser = 'Firefox'
  else if (/safari/.test(lower) && !/chrome/.test(lower)) browser = 'Safari'
  else if (/facebookexternalhit/.test(lower)) browser = 'Facebook'
  else if (/twitterbot/.test(lower)) browser = 'Twitter'
  else if (/whatsapp/.test(lower)) browser = 'WhatsApp'

  return { device, os, browser }
}

/** Parse referrer URL into domain + type. */
export function parseReferrer(referrer: string | null, currentHost: string | null): {
  referrerDomain: string | null
  referrerType: 'SEARCH' | 'SOCIAL' | 'DIRECT' | 'REFERRAL' | 'INTERNAL' | null
} {
  if (!referrer) return { referrerDomain: null, referrerType: 'DIRECT' }

  try {
    const url = new URL(referrer)
    const domain = url.hostname.replace(/^www\./, '')

    // Internal referrer
    if (currentHost && domain === currentHost.replace(/^www\./, '')) {
      return { referrerDomain: domain, referrerType: 'INTERNAL' }
    }

    // Search engines
    const searchEngines = ['google.com', 'google.com.br', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com', 'yandex.com']
    if (searchEngines.includes(domain)) {
      return { referrerDomain: domain, referrerType: 'SEARCH' }
    }

    // Social networks
    const socials = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'tiktok.com', 'youtube.com', 'whatsapp.com', 'telegram.org', 'pinterest.com', 'reddit.com']
    if (socials.includes(domain)) {
      return { referrerDomain: domain, referrerType: 'SOCIAL' }
    }

    return { referrerDomain: domain, referrerType: 'REFERRAL' }
  } catch {
    return { referrerDomain: null, referrerType: 'DIRECT' }
  }
}

/** Classify path into a type for grouping in analytics. */
export function classifyPath(path: string): { pathType: string; refSlug: string | null } {
  if (path === '/' || path === '') return { pathType: 'HOME', refSlug: null }
  if (path.startsWith('/noticias/') || path.startsWith('/article/')) {
    const slug = path.replace(/^\/(?:noticias|article)\//, '').split('?')[0]
    return { pathType: 'ARTICLE', refSlug: slug || null }
  }
  if (path.startsWith('/classified/')) {
    const slug = path.replace('/classified/', '').split('?')[0]
    return { pathType: 'CLASSIFIED_DETAIL', refSlug: slug || null }
  }
  if (path.startsWith('/classifieds')) return { pathType: 'CLASSIFIEDS', refSlug: null }
  if (path.startsWith('/category/')) {
    const slug = path.replace('/category/', '').split('?')[0]
    return { pathType: 'CATEGORY', refSlug: slug || null }
  }
  if (path.startsWith('/search')) return { pathType: 'SEARCH', refSlug: null }
  if (path.startsWith('/tag/')) {
    const slug = path.replace('/tag/', '').split('?')[0]
    return { pathType: 'TAG', refSlug: slug || null }
  }
  return { pathType: 'OTHER', refSlug: null }
}
