import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { htmlToMarkdown } from '@/lib/html-to-markdown'
import { slugify, uniqueSlug as genUniqueSlug } from '@/lib/utils'
import { handleApiError } from '@/lib/api-helpers'

// GET /api/admin/wordpress/import?connectionId=xxx&page=1&search=xxx
// Lists posts from WordPress that can be imported
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || user.role !== 'MASTER') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const connectionId = url.searchParams.get('connectionId')
  const page = parseInt(url.searchParams.get('page') || '1')
  const search = url.searchParams.get('search') || ''
  const perPage = 20

  if (!connectionId) return NextResponse.json({ error: 'connectionId é obrigatório' }, { status: 400 })

  const conn = await db.wPConnection.findUnique({ where: { id: connectionId } })
  if (!conn) return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 })

  try {
    const headers: Record<string, string> = { 'User-Agent': 'PortalNews-Import/1.0' }
    if (conn.username && conn.appPassword) {
      const auth = Buffer.from(`${conn.username}:${conn.appPassword}`).toString('base64')
      headers.Authorization = `Basic ${auth}`
    }

    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      status: 'publish',
      _embed: 'true',
      orderby: 'date',
      order: 'desc',
    })
    if (search) params.set('search', search)

    const res = await fetch(`${conn.siteUrl}/wp-json/wp/v2/posts?${params}`, {
      headers,
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json({ error: 'WordPress requer autenticação. Edite a conexão e informe usuário + senha de aplicativo.' }, { status: 401 })
      }
      if (res.status === 403) {
        return NextResponse.json({ error: 'WordPress bloqueou o acesso (403). Firewall/WAF pode estar bloqueando o header Authorization.' }, { status: 403 })
      }
      return NextResponse.json({ error: `WordPress retornou HTTP ${res.status}` }, { status: 502 })
    }

    const posts = await res.json()
    const totalPosts = parseInt(res.headers.get('x-wp-total') || '0')
    const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1')

    // Check which posts are already imported AND still exist in the portal
    const wpPostIds = posts.map((p: any) => p.id)
    const existing = await db.wPImportLog.findMany({
      where: { wpPostId: { in: wpPostIds }, status: 'IMPORTED' },
      select: { wpPostId: true, postId: true },
    })

    // Verify each imported post still exists — if the post was deleted, we can re-import
    const validImports = new Map<number, string>()
    if (existing.length > 0) {
      const postIds = existing.map(e => e.postId).filter(Boolean) as string[]
      const stillExisting = await db.post.findMany({
        where: { id: { in: postIds } },
        select: { id: true },
      })
      const existingIds = new Set(stillExisting.map(p => p.id))
      for (const e of existing) {
        if (e.postId && existingIds.has(e.postId)) {
          validImports.set(e.wpPostId, e.postId)
        }
      }
    }

    const result = posts.map((p: any) => {
      let featuredImage = ''
      if (p._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
        featuredImage = p._embedded['wp:featuredmedia'][0].source_url
      }

      let author = 'Redação'
      if (p._embedded?.author?.[0]?.name) {
        author = p._embedded.author[0].name
      }

      let categories: string[] = []
      if (p._embedded?.['wp:term']) {
        for (const termGroup of p._embedded['wp:term']) {
          for (const term of termGroup) {
            if (term.taxonomy === 'category') {
              categories.push(term.name)
            }
          }
        }
      }

      const excerpt = (p.excerpt?.rendered || '').replace(/<[^>]+>/g, '').trim().substring(0, 200)

      return {
        id: p.id,
        title: (p.title?.rendered || '').replace(/<[^>]+>/g, ''),
        excerpt,
        date: p.date,
        modified: p.modified,
        link: p.link,
        featuredImage,
        author,
        categories,
        content: p.content?.rendered || '',
        slug: p.slug,
        isImported: validImports.has(p.id),
        portalPostId: validImports.get(p.id),
      }
    })

    return NextResponse.json({
      posts: result,
      totalPosts,
      totalPages,
      currentPage: page,
    })
  } catch (e: any) {
    return handleApiError(e, 'wp import list')
  }
}

// POST /api/admin/wordpress/import
// Body: { connectionId, wpPostId, title, content, excerpt, featuredImage, categories, author, slug, categorySlug, tags, publish }
// Imports a single WordPress post into the portal
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || user.role !== 'MASTER') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { connectionId, wpPostId, title, content, excerpt, featuredImage, categories, author, slug, categorySlug, tags, publish } = body

  if (!connectionId || !wpPostId || !title || !content) {
    return NextResponse.json({ error: 'connectionId, wpPostId, title e content são obrigatórios' }, { status: 400 })
  }

  // Check if already imported — allow re-import if the portal post was deleted
  const existing = await db.wPImportLog.findFirst({
    where: { wpPostId, status: 'IMPORTED' },
  })
  if (existing?.postId) {
    const stillExists = await db.post.findUnique({ where: { id: existing.postId } })
    if (stillExists) {
      return NextResponse.json({ error: 'Post já foi importado', postId: existing.postId }, { status: 400 })
    }
    // The post was deleted — clean up the orphan log and allow re-import
    await db.wPImportLog.delete({ where: { id: existing.id } })
  }

  // Find or create category (priority: explicit categorySlug > saved mapping > match by WP name > first category)
  let categoryId: string | null = null
  if (categorySlug) {
    const cat = await db.category.findUnique({ where: { slug: categorySlug } })
    if (cat) categoryId = cat.id
  }
  if (!categoryId && categories && categories.length > 0) {
    // Try saved mappings first
    const mappings = await db.wPCategoryMapping.findMany({
      where: { connectionId, wpCategory: { in: categories } },
    })
    if (mappings.length > 0) {
      categoryId = mappings[0].categoryId
    }
  }
  if (!categoryId) {
    // Try to match by WP category name
    if (categories && categories.length > 0) {
      const allCats = await db.category.findMany()
      const matched = allCats.find(c =>
        categories.some((wpCat: string) =>
          c.name.toLowerCase() === wpCat.toLowerCase() ||
          c.slug.toLowerCase() === wpCat.toLowerCase().replace(/\s+/g, '-')
        )
      )
      if (matched) categoryId = matched.id
    }
  }
  if (!categoryId) {
    const firstCat = await db.category.findFirst({ orderBy: { order: 'asc' } })
    if (firstCat) categoryId = firstCat.id
  }

  // Find admin user for author
  const adminUser = await db.user.findFirst({ where: { role: 'MASTER' } })

  // Generate unique slug
  const baseSlug = slug || slugify(title)
  const uniqueSlug = await genUniqueSlug(baseSlug, async (s) => !!(await db.post.findUnique({ where: { slug: s } })))

  let coverImage = featuredImage || ''

  // Convert WordPress HTML to clean Markdown (intelligent cleanup)
  // - Removes <section>, <figure>, <div> wrappers
  // - Auto-closes unclosed tags (WordPress content is often malformed)
  // - Converts <strong>, <em>, <a>, <img>, <p>, <ul>, <ol>, <blockquote>, <h1>-<h6>
  // - Decodes HTML entities
  // - Strips classes, ids, styles, data-* attributes
  const cleanContent = htmlToMarkdown(content)

  // Create the post — use override tags if provided, otherwise use WP categories
  const finalTags = tags !== undefined ? tags : (categories?.join(', ') || null)

  const post = await db.post.create({
    data: {
      slug: uniqueSlug,
      title,
      subtitle: excerpt ? excerpt.substring(0, 120) : null,
      excerpt: excerpt || '',
      content: cleanContent,
      coverImage,
      tags: finalTags,
      categoryId: categoryId || '',
      authorId: adminUser?.id || '',
      status: publish ? 'PUBLISHED' : 'DRAFT',
      publishedAt: publish ? new Date() : null,
    },
  })

  // Log the import
  await db.wPImportLog.create({
    data: {
      wpPostId,
      postId: post.id,
      title,
      status: 'IMPORTED',
    },
  })

  // Update connection lastSync
  await db.wPConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date() },
  })

  return NextResponse.json({ ok: true, post, contentFormat: 'markdown' })
}
