import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const category = url.searchParams.get('category')
  const slug = url.searchParams.get('slug')
  const search = url.searchParams.get('search')
  const tag = url.searchParams.get('tag')
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10)
  const featured = url.searchParams.get('featured')
  const breaking = url.searchParams.get('breaking')
  const sortBy = url.searchParams.get('sortBy') || 'recent'

  if (slug) {
    // Get single post by slug
    const post = await db.post.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true, name: true, avatar: true,
            editorProfile: { select: { bioSlug: true, bioTitle: true, showEditorName: true, level: true } },
          },
        },
        category: true,
      },
    })
    if (!post || post.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
    }
    // increment views
    await db.post.update({
      where: { id: post.id },
      data: { views: { increment: 1 } },
    })
    return NextResponse.json({ post: { ...post, views: post.views + 1 } })
  }

  const adminMode = url.searchParams.get('admin') === 'true'
  const where: any = adminMode ? {} : { status: 'PUBLISHED' }
  if (category) {
    const cat = await db.category.findUnique({ where: { slug: category } })
    if (cat) where.categoryId = cat.id
  }
  if (search) {
    // Use lowercase for case-insensitive search on SQLite (which is case-sensitive by default)
    const q = search.toLowerCase()
    where.OR = [
      { title: { contains: q } },
      { excerpt: { contains: q } },
      { content: { contains: q } },
      { tags: { contains: q } },
      // Also try the original case (for proper nouns like city names)
      { title: { contains: search } },
      { excerpt: { contains: search } },
      { content: { contains: search } },
      { tags: { contains: search } },
    ]
  }
  if (tag) {
    // Case-insensitive tag matching (use AND with OR via nested conditions)
    const tagLower = tag.toLowerCase()
    if (where.OR) {
      // Already have search OR — combine with tag using AND
      const searchOr = where.OR
      delete where.OR
      where.AND = [
        { OR: searchOr },
        { OR: [{ tags: { contains: tagLower } }, { tags: { contains: tag } }] },
      ]
    } else {
      where.OR = [
        { tags: { contains: tagLower } },
        { tags: { contains: tag } },
      ]
    }
  }
  if (featured === 'true') where.featured = true
  if (breaking === 'true') where.breaking = true

  let orderBy: any = { publishedAt: 'desc' }
  if (sortBy === 'views') orderBy = { views: 'desc' }

  const [posts, total] = await Promise.all([
    db.post.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: true,
      },
      orderBy,
      take: limit,
      skip: offset,
    }),
    db.post.count({ where }),
  ])

  return NextResponse.json({ posts, total, limit, offset })
}

export async function POST(req: NextRequest) {
  try {
    const { getCurrentUser } = await import('@/lib/session')
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (!['MASTER', 'ADMIN', 'EDITOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }
    const body = await req.json()
    const {
      title, subtitle, excerpt, content, coverImage,
      gallery, videos, customFields, tags, categoryId,
      status, featured, breaking,
      seoTitle, seoDescription, seoKeywords, ogImage, canonicalUrl,
      publishedAt,
    } = body

    if (!title || !content || !categoryId) {
      return NextResponse.json({ error: 'Título, conteúdo e categoria são obrigatórios' }, { status: 400 })
    }

    // === Editor profile enforcement ===
    const { canEditorPublishInCategory, checkRateLimit, shouldAutoApprove, computeAutoActionAt, getEditorProfileData, getOrCreateEditorProfile } = await import('@/lib/editors')
    let editorProfile = await getEditorProfileData(user.id)

    // X6/P1 fix: EDITOR without profile must NOT bypass restrictions (fail-closed)
    if (user.role === 'EDITOR' && !editorProfile) {
      // Auto-create default profile so editor can work, but with default restrictions
      await getOrCreateEditorProfile(user.id)
      editorProfile = await getEditorProfileData(user.id)
      if (!editorProfile) {
        return NextResponse.json({ error: 'Perfil de editor não encontrado. Contate o administrador.' }, { status: 403 })
      }
    }

    // Check if editor can publish in this category (admins skip)
    if (user.role === 'EDITOR' && editorProfile) {
      const catCheck = await canEditorPublishInCategory(user.id, categoryId)
      if (!catCheck.allowed) {
        return NextResponse.json({ error: catCheck.reason || 'Categoria não permitida' }, { status: 403 })
      }

      // Check rate limit
      const rateCheck = await checkRateLimit(user.id)
      if (!rateCheck.allowed) {
        return NextResponse.json({ error: rateCheck.reason || 'Limite de posts atingido' }, { status: 429 })
      }

      // Enforce feature permissions - strip disallowed content
      let finalGallery = gallery
      let finalVideos = videos
      let finalCustomFields = customFields
      // P3 fix: also strip coverImage if allowImages is false
      let finalCoverImage = coverImage

      if (!editorProfile.allowImages) {
        finalGallery = null
        finalCoverImage = null // P3: coverImage is also an image
      }
      if (!editorProfile.allowVideos) {
        finalVideos = null
      }
      if (!editorProfile.allowLinks) {
        // Strip links from customFields
        if (finalCustomFields && Array.isArray(finalCustomFields)) {
          finalCustomFields = finalCustomFields.map((f: any) => ({ ...f, link: undefined }))
        }
      }

      // Editors cannot set featured/breaking themselves (only admin)
      // Force status based on editor's approval requirements
      let finalStatus = status || 'DRAFT'
      let autoActionAt: Date | null = null
      let isAutoApproved = false

      if (finalStatus === 'PUBLISHED' || finalStatus === 'SCHEDULED') {
        // Check if should auto-approve (smart trust)
        const autoApproval = await shouldAutoApprove(user.id)
        if (autoApproval.auto) {
          // Auto-approve
          finalStatus = 'PUBLISHED'
          isAutoApproved = true
        } else {
          // Needs admin review
          finalStatus = 'PENDING'
          // Schedule auto-action if configured
          const autoAction = await computeAutoActionAt(user.id)
          autoActionAt = autoAction.autoActionAt
        }
      }

      const slug = (body.slug || title)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      // make slug unique
      let uniqueSlug = slug
      let i = 1
      while (await db.post.findUnique({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${slug}-${i++}`
      }

      const post = await db.post.create({
        data: {
          slug: uniqueSlug,
          title, subtitle, excerpt, content, coverImage: finalCoverImage,
          gallery: finalGallery ? (typeof finalGallery === 'string' ? finalGallery : JSON.stringify(finalGallery)) : null,
          videos: finalVideos ? (typeof finalVideos === 'string' ? finalVideos : JSON.stringify(finalVideos)) : null,
          customFields: finalCustomFields ? (typeof finalCustomFields === 'string' ? finalCustomFields : JSON.stringify(finalCustomFields)) : null,
          tags, categoryId,
          authorId: user.id,
          status: finalStatus,
          featured: false, // editors cannot set featured
          breaking: false, // editors cannot set breaking
          seoTitle, seoDescription, seoKeywords, ogImage, canonicalUrl,
          publishedAt: finalStatus === 'PUBLISHED' ? (publishedAt ? new Date(publishedAt) : new Date()) : null,
          scheduledAt: finalStatus === 'SCHEDULED' && publishedAt ? new Date(publishedAt) : null,
          autoActionAt,
        },
        include: { category: true, author: true },
      })

      // Log review action
      await db.postReviewLog.create({
        data: {
          postId: post.id,
          action: isAutoApproved ? 'AUTO_APPROVED' : 'SUBMITTED',
          notes: isAutoApproved ? 'Auto-aprovado por smart trust' : 'Aguardando revisão administrativa',
        },
      })

      // P5/X5 fix: If auto-approved, update editor's trust level and stats
      // (was missing — trust never increased with auto-approval, breaking the progression cycle)
      if (isAutoApproved && editorProfile) {
        const newTrustLevel = Math.min(100, editorProfile.trustLevel + 2)
        const newConsecutiveApprovals = editorProfile.consecutiveApprovals + 1
        // Compute new level based on trust
        const newLevel = newTrustLevel >= 80 ? 'EXPERT' : newTrustLevel >= 50 ? 'TRUSTED' : newTrustLevel >= 20 ? 'REGULAR' : 'NEW'
        await db.editorProfile.update({
          where: { userId: user.id },
          data: {
            consecutiveApprovals: { increment: 1 },
            totalApproved: { increment: 1 },
            totalAutoApproved: { increment: 1 },
            trustLevel: newTrustLevel,
            level: newLevel as any,
          },
        })
        // Notify editor of auto-approval
        await db.notification.create({
          data: {
            userId: user.id,
            type: 'SYSTEM',
            title: '✓ Notícia auto-aprovada!',
            message: `"${title}" foi publicada automaticamente. Seu nível de confiança subiu para ${newTrustLevel}.`,
            link: 'advertiser',
          },
        }).catch(() => {})
      }

      // Notify admins if pending review
      if (finalStatus === 'PENDING') {
        const admins = await db.user.findMany({ where: { role: { in: ['MASTER', 'ADMIN'] } } })
        await db.notification.createMany({
          data: admins.map(a => ({
            userId: a.id,
            type: 'SYSTEM',
            title: 'Nova notícia para revisão',
            message: `"${title}" aguarda aprovação${autoActionAt ? ` (auto-ação em ${new Date(autoActionAt).toLocaleString('pt-BR')})` : ''}`,
            link: 'admin',
          })),
        })
      }

      return NextResponse.json({
        post,
        reviewStatus: finalStatus,
        autoApproved: isAutoApproved,
        autoActionAt,
      })
    }

    // === ADMIN/MASTER flow - direct publish, no review needed ===
    const slug = (body.slug || title)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // make slug unique
    let uniqueSlug = slug
    let i = 1
    while (await db.post.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${i++}`
    }

    const post = await db.post.create({
      data: {
        slug: uniqueSlug,
        title, subtitle, excerpt, content, coverImage,
        gallery: gallery ? (typeof gallery === 'string' ? gallery : JSON.stringify(gallery)) : null,
        videos: videos ? (typeof videos === 'string' ? videos : JSON.stringify(videos)) : null,
        customFields: customFields ? (typeof customFields === 'string' ? customFields : JSON.stringify(customFields)) : null,
        tags, categoryId,
        authorId: user.id,
        status: status || 'DRAFT',
        featured: !!featured,
        breaking: !!breaking,
        seoTitle, seoDescription, seoKeywords, ogImage, canonicalUrl,
        publishedAt: status === 'PUBLISHED' ? (publishedAt ? new Date(publishedAt) : new Date()) : null,
        scheduledAt: status === 'SCHEDULED' && publishedAt ? new Date(publishedAt) : null,
      },
      include: { category: true, author: true },
    })

    // Log review action
    await db.postReviewLog.create({
      data: {
        postId: post.id,
        action: status === 'PUBLISHED' ? 'APPROVED' : 'SUBMITTED',
        reviewerId: user.id,
        notes: 'Aprovado diretamente (admin/master)',
      },
    })

    return NextResponse.json({ post })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
