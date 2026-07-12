import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { safeReqJson } from '@/lib/api-helpers'
import { htmlToMarkdown } from '@/lib/html-to-markdown'

// POST /api/admin/wordpress/import/all
// Body: { connectionId, categoryId?, publish?, maxPosts?, autoCreateCategories? }
// Auto-imports ALL posts from WordPress, paginating through all pages.
// Returns progress summary. Client can call repeatedly to continue if timeout.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await safeReqJson<any>(req)
  if (!body.ok) return body.response
  const { connectionId, categoryId, publish, maxPosts, autoCreateCategories } = body.data

  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId é obrigatório' }, { status: 400 })
  }

  const conn = await db.wPConnection.findUnique({ where: { id: connectionId } })
  if (!conn) return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 })

  const headers: Record<string, string> = { 'User-Agent': 'PortalNews-Import/1.0' }
  if (conn.username && conn.appPassword) {
    const auth = Buffer.from(`${conn.username}:${conn.appPassword}`).toString('base64')
    headers.Authorization = `Basic ${auth}`
  }

  const adminUser = await db.user.findFirst({ where: { role: 'MASTER' } })
  const limit = maxPosts || 100 // safety limit
  const perPage = 20
  let page = 1
  let imported = 0
  let skipped = 0
  let failed = 0
  let processed = 0
  const errors: string[] = []

  // Build category mapping cache
  const mappings = await db.wPCategoryMapping.findMany({ where: { connectionId } })
  const mappingMap = new Map(mappings.map(m => [m.wpCategory, m.categoryId]))
  let portalCats = await db.category.findMany()
  const portalCatMap = new Map(portalCats.map(c => [c.id, c]))

  // Helper: resolve or create category
  async function resolveCategory(wpCategories: string[], explicitCategoryId?: string): Promise<string | null> {
    // 1. Explicit
    if (explicitCategoryId) {
      const cat = await db.category.findUnique({ where: { id: explicitCategoryId } })
      if (cat) return cat.id
    }
    // 2. Saved mapping
    if (wpCategories && wpCategories.length > 0) {
      for (const wpCat of wpCategories) {
        const mapped = mappingMap.get(wpCat)
        if (mapped) return mapped
      }
    }
    // 3. Auto-match by name
    if (wpCategories && wpCategories.length > 0) {
      for (const wpCat of wpCategories) {
        const matched = portalCats.find(c =>
          c.name.toLowerCase() === wpCat.toLowerCase() ||
          c.slug.toLowerCase() === wpCat.toLowerCase().replace(/\s+/g, '-')
        )
        if (matched) return matched.id
      }
    }
    // 4. Auto-create new category if enabled
    if (autoCreateCategories && wpCategories && wpCategories.length > 0) {
      const wpCat = wpCategories[0]
      const slug = wpCat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      try {
        const newCat = await db.category.create({
          data: { name: wpCat, slug, color: 'blue', order: portalCats.length + 1 },
        })
        portalCats.push(newCat)
        portalCatMap.set(newCat.id, newCat)
        // Save mapping for future imports
        await db.wPCategoryMapping.create({
          data: { connectionId, wpCategory: wpCat, categoryId: newCat.id },
        }).catch(() => {})
        mappingMap.set(wpCat, newCat.id)
        return newCat.id
      } catch {
        // slug conflict — try with suffix
        try {
          const newCat = await db.category.create({
            data: { name: wpCat, slug: `${slug}-${Date.now()}`, color: 'blue', order: portalCats.length + 1 },
          })
          portalCats.push(newCat)
          return newCat.id
        } catch (e: any) {
          errors.push(`Failed to create category "${wpCat}": ${e.message}`)
        }
      }
    }
    // 5. Fallback: first category
    const firstCat = portalCats[0]
    return firstCat?.id || null
  }

  // Paginate through WordPress posts
  while (processed < limit) {
    try {
      const params = new URLSearchParams({
        per_page: String(perPage),
        page: String(page),
        status: 'publish',
        _embed: 'true',
        orderby: 'date',
        order: 'desc',
      })

      const res = await fetch(`${conn.siteUrl}/wp-json/wp/v2/posts?${params}`, {
        headers,
        signal: AbortSignal.timeout(20000),
      })

      if (!res.ok) {
        errors.push(`WordPress retornou HTTP ${res.status} na página ${page}`)
        break
      }

      const posts = await res.json()
      if (!Array.isArray(posts) || posts.length === 0) break // no more posts

      for (const p of posts) {
        if (processed >= limit) break

        const wpPostId = p.id
        const title = (p.title?.rendered || '').replace(/<[^>]+>/g, '')
        const content = p.content?.rendered || ''
        const excerpt = (p.excerpt?.rendered || '').replace(/<[^>]+>/g, '').trim().substring(0, 200)

        if (!title || !content) { failed++; processed++; continue }

        // Extract featured image
        let featuredImage = ''
        if (p._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
          featuredImage = p._embedded['wp:featuredmedia'][0].source_url
        }

        // Extract categories
        const wpCats: string[] = []
        if (p._embedded?.['wp:term']) {
          for (const termGroup of p._embedded['wp:term']) {
            for (const term of termGroup) {
              if (term.taxonomy === 'category') wpCats.push(term.name)
            }
          }
        }

        // Check if already imported
        const existing = await db.wPImportLog.findFirst({ where: { wpPostId, status: 'IMPORTED' } })
        if (existing?.postId) {
          const stillExists = await db.post.findUnique({ where: { id: existing.postId } })
          if (stillExists) { skipped++; processed++; continue }
          await db.wPImportLog.delete({ where: { id: existing.id } }).catch(() => {})
        }

        // Resolve category
        const finalCategoryId = await resolveCategory(wpCats, categoryId)

        // Generate unique slug
        let uniqueSlug = (p.slug || title).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 80)
        let suffix = 1
        while (await db.post.findUnique({ where: { slug: uniqueSlug } })) {
          uniqueSlug = `${uniqueSlug}-${suffix++}`
        }

        // Convert HTML to Markdown (handles embeds, shortcodes, etc.)
        const cleanContent = htmlToMarkdown(content)

        // Create post
        try {
          const post = await db.post.create({
            data: {
              slug: uniqueSlug,
              title,
              subtitle: excerpt ? excerpt.substring(0, 120) : null,
              excerpt,
              content: cleanContent,
              coverImage: featuredImage,
              tags: wpCats.join(', ') || null,
              categoryId: finalCategoryId || '',
              authorId: adminUser?.id || '',
              status: publish ? 'PUBLISHED' : 'DRAFT',
              publishedAt: publish ? new Date() : null,
            },
          })

          await db.wPImportLog.create({
            data: { wpPostId, postId: post.id, title, status: 'IMPORTED' },
          })
          imported++
        } catch (e: any) {
          failed++
          errors.push(`Failed to import "${title.substring(0, 50)}": ${e.message}`)
        }
        processed++
      }

      // Check if there are more pages
      const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1')
      if (page >= totalPages) break
      page++
    } catch (e: any) {
      errors.push(`Error on page ${page}: ${e.message}`)
      break
    }
  }

  // Update connection lastSync
  await db.wPConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date() },
  })

  return NextResponse.json({
    ok: true,
    summary: { processed, imported, skipped, failed, pagesScanned: page },
    errors: errors.slice(0, 10), // first 10 errors
  })
}
