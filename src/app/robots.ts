import { MetadataRoute } from 'next'
import { getSeoSettings } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Pull the base URL from SEO settings (admin-configurable in /admin > SEO).
  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  if (!baseUrl) {
    try {
      const settings = await getSeoSettings()
      baseUrl = settings.site_url || 'http://localhost:3000'
    } catch {
      baseUrl = 'http://localhost:3000'
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/admin/',
          '/api/auth/',
          '/api/credits',
          '/api/favorites',
          '/api/leads',
          '/api/notifications',
          '/api/profile',
          '/api/reading',
          '/api/store/',
          '/api/subscriptions',
          '/api/upload',
          '/api/users/',
          '/api/verification',
          '/api/editor-profile',
          '/api/editor-profile/mine',
          '/?view=admin',
          '/?view=profile',
          '/?view=advertiser',
          '/?view=classified-editor',
          '/?editor-config=',
        ],
      },
      // Block AI crawlers that don't pay for content
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'Google-Extended',
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
