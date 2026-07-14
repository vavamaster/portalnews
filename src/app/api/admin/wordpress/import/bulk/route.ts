import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { safeReqJson } from '@/lib/api-helpers'
import { htmlToMarkdown } from '@/lib/html-to-markdown'
import { slugify, uniqueSlug as genUniqueSlug } from '@/lib/utils'

// POST /api/admin/wordpress/import/bulk
// Body: {
//   connectionId, items: [
//     { wpPostId, title, content, excerpt, featuredImage, categories, author, slug, categoryId, tags, publish }
//   ]
// }
// Imports multiple WordPress posts in one request
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await safeReqJson<{ connectionId?: string; items?: any[] }>(req)
  if (!body.ok) return body.response
  const { connectionId, items } = body.data

  if (!connectionId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'connectionId e items[] são obrigatórios' }, { status: 400 })
  }

  if (items.length > 50) {
    return NextResponse.json({ error: 'Máximo de 50 posts por importação em massa' }, { status: 400 })
  }

  // Fetch admin user for author
  const adminUser = await db.user.findFirst({ where: { role: 'MASTER' } })

  // Fetch all portal categories once
  const allCats = await db.category.findMany()

  const results: any[] = []
  let imported = 0
  let skipped = 0
  let failed = 0

  for (const item of items) {
    try {
      const { wpPostId, title, content, excerpt, featuredImage, categories, author, slug, categoryId, tags, publish } = item

      if (!wpPostId || !title || !content) {
        failed++
        results.push({ wpPostId, status: 'failed', error: 'Campos obrigatórios ausentes' })
        continue
      }

      // Check if already imported AND still exists
      const existing = await db.wPImportLog.findFirst({
        where: { wpPostId, status: 'IMPORTED' },
      })
      if (existing?.postId) {
        const stillExists = await db.post.findUnique({ where: { id: existing.postId } })
        if (stillExists) {
          skipped++
          results.push({ wpPostId, status: 'skipped', reason: 'already_imported', postId: existing.postId })
          continue
        }
        await db.wPImportLog.delete({ where: { id: existing.id } })
      }

      // Resolve category: explicit categoryId > saved mapping > match by WP name > first cat
      let finalCategoryId: string | null = categoryId || null
      if (!finalCategoryId && categories && categories.length > 0) {
        const mappings = await db.wPCategoryMapping.findMany({
          where: { connectionId, wpCategory: { in: categories } },
        })
        if (mappings.length > 0) finalCategoryId = mappings[0].categoryId
      }
      if (!finalCategoryId && categories && categories.length > 0) {
        const matched = allCats.find(c =>
          categories.some((wpCat: string) =>
            c.name.toLowerCase() === wpCat.toLowerCase() ||
            c.slug.toLowerCase() === wpCat.toLowerCase().replace(/\s+/g, '-')
          )
        )
        if (matched) finalCategoryId = matched.id
      }
      if (!finalCategoryId) {
        const firstCat = await db.category.findFirst({ orderBy: { order: 'asc' } })
        if (firstCat) finalCategoryId = firstCat.id
      }

      // Generate unique slug
      const baseSlug = slug || slugify(title)
      const uniqueSlug = await genUniqueSlug(baseSlug, async (s) => !!(await db.post.findUnique({ where: { slug: s } })))

      // Convert HTML to Markdown
      const cleanContent = htmlToMarkdown(content)

      // Final tags
      const finalTags = tags !== undefined ? tags : (categories?.join(', ') || null)

      // Create post
      const post = await db.post.create({
        data: {
          slug: uniqueSlug,
          title,
          subtitle: excerpt ? excerpt.substring(0, 120) : null,
          excerpt: excerpt || '',
          content: cleanContent,
          coverImage: featuredImage || '',
          tags: finalTags,
          categoryId: finalCategoryId || '',
          authorId: adminUser?.id || '',
          status: publish ? 'PUBLISHED' : 'DRAFT',
          publishedAt: publish ? new Date() : null,
        },
      })

      // Log import
      await db.wPImportLog.create({
        data: { wpPostId, postId: post.id, title, status: 'IMPORTED' },
      })

      imported++
      results.push({ wpPostId, status: 'imported', postId: post.id, slug: uniqueSlug })
    } catch (e: any) {
      failed++
      console.error(`[WP import bulk] post ${item.wpPostId} failed:`, e)
      results.push({ wpPostId: item.wpPostId, status: 'failed', error: 'Falha ao importar' })
    }
  }

  // Update connection lastSync
  await db.wPConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date() },
  })

  return NextResponse.json({
    ok: true,
    summary: { total: items.length, imported, skipped, failed },
    results,
  })
}
