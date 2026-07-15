// SEO structured data (JSON-LD) builders — uses dynamic SEO settings, no hardcoded brand.

import { getSiteUrl } from './seo-urls'

export function getOrganizationJsonLd(settings: Record<string, string>) {
  const siteName = settings.site_name || 'Portal de Notícias'
  const siteUrl = getSiteUrl(settings)
  const siteLogo = settings.site_logo || ''
  const description = settings.site_description || ''
  const email = settings.footer_email || ''
  const phone = settings.footer_phone || ''
  const address = settings.footer_address || ''
  const facebook = settings.facebook_url || ''
  const instagram = settings.instagram_url || ''
  const twitter = settings.twitter_url || ''
  const youtube = settings.youtube_url || ''

  const sameAs = [facebook, instagram, twitter, youtube].filter(Boolean)

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: siteUrl,
    ...(siteLogo && { logo: siteLogo }),
    ...(description && { description }),
    ...(email && { email }),
    ...(phone && { telephone: phone }),
    ...(address && { address: { '@type': 'PostalAddress', streetAddress: address } }),
    ...(sameAs.length > 0 && { sameAs }),
  }
}

export function getWebSiteJsonLd(settings: Record<string, string>) {
  const siteName = settings.site_name || 'Portal de Notícias'
  const siteUrl = getSiteUrl(settings)
  const description = settings.site_description || ''

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: siteUrl,
    ...(description && { description }),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

// Article JSON-LD for news articles — used on /article/[slug] pages
// Improves Google News discovery and search appearance
export function getArticleJsonLd(settings: Record<string, string>, article: {
  title: string
  description?: string
  image?: string
  url: string
  publishedAt?: string | Date | null
  updatedAt?: string | Date | null
  authorName?: string | null
  categoryName?: string | null
  tags?: string | null
}) {
  const siteName = settings.site_name || 'Portal de Notícias'
  const siteUrl = getSiteUrl(settings)
  const siteLogo = settings.site_logo || ''
  const defaultOg = settings.og_image || ''

  const publishedTime = article.publishedAt
    ? new Date(article.publishedAt as any).toISOString()
    : undefined
  const modifiedTime = article.updatedAt
    ? new Date(article.updatedAt as any).toISOString()
    : publishedTime

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.description || '',
    image: (article.image || defaultOg) ? [article.image || defaultOg] : undefined,
    datePublished: publishedTime,
    dateModified: modifiedTime,
    url: article.url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': article.url },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
      ...(siteLogo && { logo: { '@type': 'ImageObject', url: siteLogo } }),
    },
    ...(article.authorName && {
      author: { '@type': 'Person', name: article.authorName },
    }),
    ...(article.categoryName && { articleSection: article.categoryName }),
    ...(article.tags && {
      keywords: article.tags.split(',').map(t => t.trim()).filter(Boolean),
    }),
  }
}

// BreadcrumbList JSON-LD for article pages
export function getBreadcrumbJsonLd(
  settings: Record<string, string>,
  items: { name: string; url: string }[]
) {
  const siteUrl = getSiteUrl(settings)

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`,
    })),
  }
}
