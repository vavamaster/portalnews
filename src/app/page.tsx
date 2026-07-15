import type { Metadata } from 'next'
import { Suspense } from 'react'
import { db } from '@/lib/db'
import { getSeoSettings } from '@/lib/seo'
import { getSiteName } from '@/lib/seo-helpers'
import { HomeContent } from '@/components/portal/HomeContent'

// Server-side metadata generation — reads URL search params and generates
// article-specific OG tags so WhatsApp/Facebook/Twitter show the cover image.
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }): Promise<Metadata> {
  const params = await searchParams
  const articleSlug = typeof params.article === 'string' ? params.article : undefined
  const empresaSlug = typeof params.empresa === 'string' ? params.empresa : undefined

  const settings = await getSeoSettings()
  const siteName = getSiteName(settings)
  const siteUrl = settings.site_url || 'http://localhost:3000'
  const defaultOgImage = settings.og_image || '/og-default.png'

  // === ARTICLE PAGE ===
  if (articleSlug) {
    // P0-1 fix: only generate OG metadata for PUBLISHED posts. Drafts/pending/
    // scheduled posts must not leak title, excerpt or cover image via social
    // media preview when their URL is shared.
    const post = await db.post.findFirst({
      where: { slug: articleSlug, status: 'PUBLISHED' },
      select: {
        title: true, subtitle: true, excerpt: true,
        coverImage: true, ogImage: true,
        seoTitle: true, seoDescription: true,
        publishedAt: true, updatedAt: true,
        author: { select: { name: true } },
        category: { select: { name: true } },
      },
    })

    if (post) {
      const title = post.seoTitle || post.title
      const description = post.seoDescription || post.excerpt || post.subtitle || ''
      const image = post.ogImage || post.coverImage || defaultOgImage

      return {
        title,
        description,
        alternates: { canonical: `${siteUrl}/?article=${encodeURIComponent(articleSlug)}` },
        openGraph: {
          title: `${title} | ${siteName}`,
          description,
          url: `${siteUrl}/?article=${encodeURIComponent(articleSlug)}`,
          siteName,
          locale: 'pt_BR',
          type: 'article',
          images: [{ url: image, width: 1200, height: 630, alt: post.title }],
          ...(post.publishedAt && { publishedTime: new Date(post.publishedAt).toISOString() }),
          ...(post.updatedAt && { modifiedTime: new Date(post.updatedAt).toISOString() }),
          ...(post.author?.name && { authors: [post.author.name] }),
          ...(post.category?.name && { section: post.category.name }),
        },
        twitter: {
          card: 'summary_large_image',
          title: `${title} | ${siteName}`,
          description,
          images: [image],
        },
      }
    }
  }

  // === ENTERPRISE LANDING PAGE ===
  if (empresaSlug) {
    const lp = await db.enterpriseLandingPage.findUnique({
      where: { slug: empresaSlug },
      select: { companyName: true, seoTitle: true, seoDescription: true, heroImageUrl: true, logoUrl: true, niche: true },
    })

    if (lp) {
      const title = lp.seoTitle || `${lp.companyName} | ${siteName}`
      const description = lp.seoDescription || `${lp.companyName}${lp.niche ? ` — ${lp.niche}` : ''}`
      const image = lp.heroImageUrl || lp.logoUrl || defaultOgImage

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: `${siteUrl}/?empresa=${encodeURIComponent(empresaSlug)}`,
          siteName,
          locale: 'pt_BR',
          type: 'website',
          images: [{ url: image, width: 1200, height: 630, alt: lp.companyName }],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [image],
        },
      }
    }
  }

  // === DEFAULT (home, category, etc.) ===
  const description = settings.site_description || 'Portal de notícias local.'
  return {
    title: {
      default: `${siteName} - ${settings.site_tagline || 'Portal de Notícias'}`,
      template: `%s | ${siteName}`,
    },
    description,
    openGraph: {
      title: `${siteName} - ${settings.site_tagline || 'Portal de Notícias'}`,
      description,
      url: siteUrl,
      siteName,
      locale: 'pt_BR',
      type: 'website',
      images: [{ url: defaultOgImage, width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${siteName} - ${settings.site_tagline || 'Portal de Notícias'}`,
      description,
      images: [defaultOgImage],
    },
  }
}

export default function Home() {
  return (
    <Suspense fallback={<BootFallback />}>
      <HomeContent />
    </Suspense>
  )
}

function BootFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="h-12 w-12 rounded-full border-4 border-zinc-200 border-t-primary animate-spin mx-auto"></div>
        <div className="text-zinc-400 text-sm mt-3">Carregando...</div>
      </div>
    </div>
  )
}
