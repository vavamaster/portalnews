import { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { getSeoSettings } from '@/lib/seo'
import { buildPortalUrl, normalizeSiteUrl } from '@/lib/seo-urls'

// Force dynamic generation at runtime (so it stays current)
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pull the base URL from SEO settings (admin-configurable in /admin > SEO).
  // Fall back to env var, then to a localhost placeholder.
  let configuredUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  if (!configuredUrl) {
    try {
      const settings = await getSeoSettings()
      configuredUrl = settings.site_url || ''
    } catch {}
  }
  const baseUrl = normalizeSiteUrl(configuredUrl)

  const entries: MetadataRoute.Sitemap = []

  // Static pages
  entries.push(
    { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: 'hourly', priority: 1.0 },
    { url: buildPortalUrl(baseUrl, 'view', 'classifieds'), lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: buildPortalUrl(baseUrl, 'view', 'editors'), lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: buildPortalUrl(baseUrl, 'view', 'about'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: buildPortalUrl(baseUrl, 'view', 'contact'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: buildPortalUrl(baseUrl, 'view', 'plans'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: buildPortalUrl(baseUrl, 'view', 'quotes'), lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
  )

  try {
    // Published posts
    const posts = await db.post.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, publishedAt: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 1000,
    })
    posts.forEach(p => {
      entries.push({
        url: buildPortalUrl(baseUrl, 'article', p.slug),
        lastModified: p.updatedAt || p.publishedAt || new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    })

    // Categories
    const categories = await db.category.findMany({ select: { slug: true, updatedAt: true } })
    categories.forEach(c => {
      entries.push({
        url: buildPortalUrl(baseUrl, 'category', c.slug),
        lastModified: c.updatedAt,
        changeFrequency: 'hourly',
        priority: 0.7,
      })
    })

    // Active classified listings
    const listings = await db.classifiedListing.findMany({
      where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
      select: { slug: true, updatedAt: true },
      take: 500,
    })
    listings.forEach(l => {
      entries.push({
        url: buildPortalUrl(baseUrl, 'classified', l.slug),
        lastModified: l.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    })

    // Classified categories
    const cCats = await db.classifiedCategory.findMany({ select: { slug: true } })
    cCats.forEach(c => {
      entries.push({
        url: buildPortalUrl(baseUrl, 'ccat', c.slug),
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.5,
      })
    })

    // Public editor bios
    const editorBios = await db.editorProfile.findMany({
      where: { bioIsActive: true, bioSlug: { not: null } },
      select: { bioSlug: true, updatedAt: true },
    })
    editorBios.forEach(e => {
      if (e.bioSlug) {
        entries.push({
          url: buildPortalUrl(baseUrl, 'editor', e.bioSlug),
          lastModified: e.updatedAt,
          changeFrequency: 'monthly',
          priority: 0.5,
        })
      }
    })
  } catch (e) {
    // DB might not be available at build time — return static entries only
    console.error('Sitemap DB error:', e)
  }

  return entries
}
