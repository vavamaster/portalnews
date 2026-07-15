import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getSeoSettings } from '@/lib/seo'
import { getSiteName } from '@/lib/seo-helpers'
import { getArticleJsonLd, getBreadcrumbJsonLd } from '@/lib/seo-structured-data'

// Generate dynamic OG metadata for article pages (server-side).
// This is what WhatsApp, Facebook, Twitter etc. read when someone shares a link.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params

  // P0-1 fix: only expose metadata for PUBLISHED posts. Unpublished posts
  // (draft/pending/scheduled) must not leak title, excerpt or cover image
  // through social-media previews when their URL is shared.
  const post = await db.post.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: {
      title: true,
      subtitle: true,
      excerpt: true,
      coverImage: true,
      ogImage: true,
      seoTitle: true,
      seoDescription: true,
      tags: true,
      publishedAt: true,
      updatedAt: true,
      author: { select: { name: true } },
      category: { select: { name: true } },
    },
  })

  // Fetch SEO settings for site name and URL
  const settings = await getSeoSettings()
  const siteName = getSiteName(settings)
  const siteUrl = settings.site_url || 'http://localhost:3000'
  const articleUrl = `${siteUrl}/article/${slug}`

  if (!post) {
    return {
      title: `Artigo não encontrado | ${siteName}`,
    }
  }

  const title = post.seoTitle || post.title
  const description = post.seoDescription || post.excerpt || post.subtitle || ''
  const image = post.ogImage || post.coverImage || settings.og_image || ''

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
      ...(image && { images: [{ url: image, width: 1200, height: 630, alt: post.title }] }),
      ...(post.publishedAt && { publishedTime: new Date(post.publishedAt).toISOString() }),
      ...(post.updatedAt && { modifiedTime: new Date(post.updatedAt).toISOString() }),
      ...(post.author?.name && { authors: [post.author.name] }),
      ...(post.category?.name && { section: post.category.name }),
      ...(post.tags && { tags: post.tags.split(',').map(t => t.trim()).filter(Boolean) }),
    },
    twitter: {
      card: (settings.twitter_card as any) || 'summary_large_image',
      title: `${title} | ${siteName}`,
      description,
      ...(image && { images: [image] }),
    },
  }
}

// This page renders the article — it serves a minimal server-side HTML with:
//  1. OG meta tags (from generateMetadata above)
//  2. Article + Breadcrumb JSON-LD for Google News / rich results
// Then redirects to the client-side app which handles the full experience.
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const [post, settings] = await Promise.all([
    // P0-1 fix: only render article JSON-LD for PUBLISHED posts; drafts and
    // other unpublished states must not be exposed publicly.
    db.post.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        title: true, subtitle: true, excerpt: true,
        coverImage: true, ogImage: true,
        seoTitle: true, seoDescription: true,
        tags: true, publishedAt: true, updatedAt: true,
        author: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    getSeoSettings(),
  ])

  const siteName = getSiteName(settings)
  const siteUrl = settings.site_url || 'http://localhost:3000'
  const articleUrl = `${siteUrl}/article/${slug}`

  const jsonLdScripts: string[] = []

  if (post) {
    // Article JSON-LD
    const articleJsonLd = getArticleJsonLd(settings, {
      title: post.title,
      description: post.seoDescription || post.excerpt || post.subtitle || '',
      image: post.ogImage || post.coverImage || settings.og_image || '',
      url: articleUrl,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      authorName: post.author?.name,
      categoryName: post.category?.name,
      tags: post.tags,
    })
    jsonLdScripts.push(JSON.stringify(articleJsonLd))

    // Breadcrumb JSON-LD: Home > Category > Article
    if (post.category?.name) {
      const breadcrumb = getBreadcrumbJsonLd(settings, [
        { name: 'Home', url: siteUrl },
        { name: post.category.name, url: `${siteUrl}/?cat=${encodeURIComponent(post.category.name)}` },
        { name: post.title, url: articleUrl },
      ])
      jsonLdScripts.push(JSON.stringify(breadcrumb))
    }
  } else {
    // P0-1 fix: post is missing or unpublished — return 404 so crawlers and
    // users do not see draft content.
    notFound()
  }

  return (
    <>
      {jsonLdScripts.map((json, i) => (
        <script
          key={i}
          type="application/ld+json"
          // P0-4b fix: escape `<` and `>` so a `</script>` sequence inside the
          // JSON payload cannot break out of the script tag and inject HTML.
          dangerouslySetInnerHTML={{ __html: json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e') }}
        />
      ))}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.href = '/?article=${encodeURIComponent(slug)}';`
        }}
      />
    </>
  )
}
