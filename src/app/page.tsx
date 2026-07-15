import type { Metadata } from 'next'
import { Suspense } from 'react'
import { db } from '@/lib/db'
import { getSeoSettings } from '@/lib/seo'
import { getSiteName } from '@/lib/seo-helpers'
import { buildPortalUrl, getArticleUrl, getSiteUrl } from '@/lib/seo-urls'
import { getArticleJsonLd, getBreadcrumbJsonLd } from '@/lib/seo-structured-data'
import { HomeContent } from '@/components/portal/HomeContent'
import { getLicenseStatus, getPublicLicenseStatus } from '@/lib/license'

type PageSearchParams = { [key: string]: string | string[] | undefined }

function singleParam(params: PageSearchParams, key: string): string | undefined {
  return typeof params[key] === 'string' ? params[key] : undefined
}

function getPublicCanonical(siteUrl: string, params: PageSearchParams): string {
  for (const key of ['category', 'tag', 'classified', 'ccat', 'editor', 'empresa']) {
    const value = singleParam(params, key)
    if (value) return buildPortalUrl(siteUrl, key, value)
  }

  const view = singleParam(params, 'view')
  const publicViews = new Set(['classifieds', 'editors', 'about', 'contact', 'plans', 'quotes', 'store'])
  if (view && publicViews.has(view)) return buildPortalUrl(siteUrl, 'view', view)
  return buildPortalUrl(siteUrl)
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<PageSearchParams> }): Promise<Metadata> {
  const [params, settings, licenseStatus] = await Promise.all([
    searchParams,
    getSeoSettings(),
    getLicenseStatus(),
  ])
  const articleSlug = singleParam(params, 'article')
  const empresaSlug = singleParam(params, 'empresa')
  const siteName = getSiteName(settings)
  const siteUrl = getSiteUrl(settings)
  const defaultOgImage = settings.og_image || '/og-default.png'

  if (!licenseStatus.valid) {
    return {
      title: `${siteName} - Temporariamente indisponível`,
      description: 'Portal temporariamente indisponível.',
      robots: { index: false, follow: false, nocache: true },
    }
  }

  if (articleSlug) {
    const post = await db.post.findFirst({
      where: { slug: articleSlug, status: 'PUBLISHED' },
      select: {
        title: true, subtitle: true, excerpt: true, coverImage: true, ogImage: true,
        seoTitle: true, seoDescription: true, publishedAt: true, updatedAt: true,
        author: { select: { name: true } },
        category: { select: { name: true } },
      },
    })

    if (post) {
      const title = post.seoTitle || post.title
      const description = post.seoDescription || post.excerpt || post.subtitle || ''
      const image = post.ogImage || post.coverImage || defaultOgImage
      const articleUrl = getArticleUrl(settings, articleSlug)

      return {
        title,
        description,
        alternates: { canonical: articleUrl },
        openGraph: {
          title: `${title} | ${siteName}`,
          description,
          url: articleUrl,
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

    return {
      title: `Artigo não encontrado | ${siteName}`,
      alternates: { canonical: getArticleUrl(settings, articleSlug) },
      robots: { index: false, follow: false },
    }
  }

  if (empresaSlug) {
    const landingPage = await db.enterpriseLandingPage.findUnique({
      where: { slug: empresaSlug },
      select: { companyName: true, seoTitle: true, seoDescription: true, heroImageUrl: true, logoUrl: true, niche: true },
    })

    if (landingPage) {
      const title = landingPage.seoTitle || `${landingPage.companyName} | ${siteName}`
      const description = landingPage.seoDescription || `${landingPage.companyName}${landingPage.niche ? ` — ${landingPage.niche}` : ''}`
      const image = landingPage.heroImageUrl || landingPage.logoUrl || defaultOgImage
      const canonical = buildPortalUrl(siteUrl, 'empresa', empresaSlug)
      return {
        title,
        description,
        alternates: { canonical },
        openGraph: {
          title,
          description,
          url: canonical,
          siteName,
          locale: 'pt_BR',
          type: 'website',
          images: [{ url: image, width: 1200, height: 630, alt: landingPage.companyName }],
        },
        twitter: { card: 'summary_large_image', title, description, images: [image] },
      }
    }
  }

  const description = settings.site_description || 'Portal de notícias local.'
  const canonicalUrl = getPublicCanonical(siteUrl, params)
  const searchQuery = singleParam(params, 'search')
  const view = singleParam(params, 'view')
  const shouldNoIndex = !!searchQuery || ['admin', 'profile', 'advertiser', 'classified-editor', 'login', 'register'].includes(view || '')

  return {
    title: {
      default: `${siteName} - ${settings.site_tagline || 'Portal de Notícias'}`,
      template: `%s | ${siteName}`,
    },
    description,
    alternates: { canonical: canonicalUrl },
    ...(shouldNoIndex && { robots: { index: false, follow: true } }),
    openGraph: {
      title: `${siteName} - ${settings.site_tagline || 'Portal de Notícias'}`,
      description,
      url: canonicalUrl,
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

export default async function Home({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const [params, licenseStatus] = await Promise.all([
    searchParams,
    getLicenseStatus(),
  ])
  const articleSlug = singleParam(params, 'article')
  const jsonLd: Array<{ id: string; value: unknown }> = []

  if (licenseStatus.valid && articleSlug) {
    const [post, settings] = await Promise.all([
      db.post.findFirst({
        where: { slug: articleSlug, status: 'PUBLISHED' },
        select: {
          title: true, subtitle: true, excerpt: true, coverImage: true, ogImage: true,
          seoDescription: true, tags: true, publishedAt: true, updatedAt: true,
          author: { select: { name: true } },
          category: { select: { name: true, slug: true } },
        },
      }),
      getSeoSettings(),
    ])

    if (post) {
      const siteUrl = getSiteUrl(settings)
      const articleUrl = getArticleUrl(settings, articleSlug)
      jsonLd.push({
        id: 'article-jsonld',
        value: getArticleJsonLd(settings, {
          title: post.title,
          description: post.seoDescription || post.excerpt || post.subtitle || '',
          image: post.ogImage || post.coverImage || settings.og_image || '',
          url: articleUrl,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          authorName: post.author?.name,
          categoryName: post.category?.name,
          tags: post.tags,
        }),
      })

      if (post.category) {
        jsonLd.push({
          id: 'article-breadcrumb-jsonld',
          value: getBreadcrumbJsonLd(settings, [
            { name: 'Home', url: buildPortalUrl(siteUrl) },
            { name: post.category.name, url: buildPortalUrl(siteUrl, 'category', post.category.slug) },
            { name: post.title, url: articleUrl },
          ]),
        })
      }
    }
  }

  return (
    <>
      {jsonLd.map(({ id, value }) => (
        <script
          key={id}
          id={id}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') }}
        />
      ))}
      <Suspense fallback={<BootFallback />}>
        <HomeContent initialLicenseStatus={getPublicLicenseStatus(licenseStatus)} />
      </Suspense>
    </>
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
