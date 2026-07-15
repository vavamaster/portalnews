export const DEFAULT_SITE_URL = 'http://localhost:3000'

export function normalizeSiteUrl(value: unknown, fallback = DEFAULT_SITE_URL): string {
  const normalize = (candidate: unknown): string | null => {
    if (typeof candidate !== 'string' || !candidate.trim()) return null
    try {
      const url = new URL(candidate.trim())
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
      url.hash = ''
      url.search = ''
      return url.toString().replace(/\/$/, '')
    } catch {
      return null
    }
  }

  return normalize(value) || normalize(fallback) || DEFAULT_SITE_URL
}

export function isValidSiteUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function getSiteUrl(settings?: Record<string, string>, fallback = DEFAULT_SITE_URL): string {
  return normalizeSiteUrl(settings?.site_url, fallback)
}

export function buildPortalUrl(baseUrl: string, key?: string, value?: string): string {
  const base = normalizeSiteUrl(baseUrl)
  if (!key || value === undefined || value === '') return `${base}/`
  const params = new URLSearchParams({ [key]: value })
  return `${base}/?${params.toString()}`
}

export function getArticleUrl(settings: Record<string, string> | undefined, slug: string): string {
  return buildPortalUrl(getSiteUrl(settings), 'article', slug)
}
