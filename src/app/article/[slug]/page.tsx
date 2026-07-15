import { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSeoSettings } from '@/lib/seo'
import { getSiteName } from '@/lib/seo-helpers'
import { getArticleUrl } from '@/lib/seo-urls'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [post, settings] = await Promise.all([
    db.post.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        title: true, subtitle: true, excerpt: true, coverImage: true, ogImage: true,
        seoTitle: true, seoDescription: true, tags: true, publishedAt: true, updatedAt: true,
        author: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    getSeoSettings(),
  ])

  const siteName = getSiteName(settings)
  if (!post) return { title: `Artigo não encontrado | ${siteName}`, robots: { index: false, follow: false } }

  // Publish the friendly article path as the single canonical URL.
  const articleUrl = getArticleUrl(settings, slug)
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
      ...(post.tags && { tags: post.tags.split(',').map(tag => tag.trim()).filter(Boolean) }),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${siteName}`,
      description,
      ...(image && { images: [image] }),
    },
  }
}

export default async function ArticleCompatibilityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await db.post.findFirst({ where: { slug, status: 'PUBLISHED' }, select: { id: true } })
  if (!post) notFound()
  permanentRedirect(`/noticias/${encodeURIComponent(slug)}`)
}
