import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
<<<<<<< HEAD
import { requireEditorOrRespond } from '@/lib/api-helpers'
=======
import { requireEditorOrRespond, handleApiError } from '@/lib/api-helpers'
>>>>>>> 005f2b6696919b4e97f780cf36cf435993d447e1

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await db.post.findUnique({
    where: { id },
    include: { author: { select: { id: true, name: true, avatar: true } }, category: true },
  })
  if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
  return NextResponse.json({ post })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, response } = await requireEditorOrRespond(req)
    if (response) return response
    const body = await req.json()
    const existing = await db.post.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })

    // Fix #3: EDITOR can only edit their own posts; ADMIN/MASTER can edit any
    if (user.role === 'EDITOR' && existing.authorId !== user.id) {
      return NextResponse.json({ error: 'Você só pode editar suas próprias notícias' }, { status: 403 })
    }

    // Fix #2: EDITOR cannot change status/featured/breaking directly (only ADMIN/MASTER)
    const isEditor = user.role === 'EDITOR'
    const update: any = {}
    const editorFields = ['title', 'subtitle', 'excerpt', 'content', 'coverImage', 'tags', 'categoryId',
      'seoTitle', 'seoDescription', 'seoKeywords', 'ogImage', 'canonicalUrl']
    const adminFields = [...editorFields, 'status', 'featured', 'breaking']
    const allowedFields = isEditor ? editorFields : adminFields
    for (const f of allowedFields) {
      if (body[f] !== undefined) update[f] = body[f]
    }
    if (body.gallery !== undefined) {
      update.gallery = body.gallery ? (typeof body.gallery === 'string' ? body.gallery : JSON.stringify(body.gallery)) : null
    }
    if (body.videos !== undefined) {
      update.videos = body.videos ? (typeof body.videos === 'string' ? body.videos : JSON.stringify(body.videos)) : null
    }
    if (body.customFields !== undefined) {
      update.customFields = body.customFields ? (typeof body.customFields === 'string' ? body.customFields : JSON.stringify(body.customFields)) : null
    }

    // X1-X4 fix: For EDITOR, enforce canEditOwnPosts, allowImages/Videos/Links, categoriesAllowed
    if (isEditor) {
      const { getEditorProfileData, canEditorPublishInCategory } = await import('@/lib/editors')
      const profile = await getEditorProfileData(user.id)

      // X2: Check canEditOwnPosts
      if (profile && !profile.canEditOwnPosts) {
        return NextResponse.json({ error: 'Você não tem permissão para editar notícias' }, { status: 403 })
      }

      // X4: Check categoriesAllowed if categoryId is being changed
      if (update.categoryId && update.categoryId !== existing.categoryId) {
        const catCheck = await canEditorPublishInCategory(user.id, update.categoryId)
        if (!catCheck.allowed) {
          return NextResponse.json({ error: catCheck.reason || 'Categoria não permitida' }, { status: 403 })
        }
      }

      // X3: Strip disallowed content types
      if (profile && !profile.allowImages) {
        update.gallery = null
        update.coverImage = null
      }
      if (profile && !profile.allowVideos) {
        update.videos = null
      }
      if (profile && !profile.allowLinks && update.customFields) {
        const fields = typeof update.customFields === 'string' ? JSON.parse(update.customFields) : update.customFields
        if (Array.isArray(fields)) {
          update.customFields = JSON.stringify(fields.map((f: any) => ({ ...f, link: undefined })))
        }
      }
    }

    // Fix P17: use update.status not body.status
    if (update.status === 'PUBLISHED' && !existing.publishedAt) {
      update.publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date()
    }
    if (update.status === 'SCHEDULED' && body.publishedAt) {
      update.scheduledAt = new Date(body.publishedAt)
    }

    const post = await db.post.update({ where: { id }, data: update, include: { category: true, author: true } })
    return NextResponse.json({ post })
  } catch (e: any) {
    return handleApiError(e, 'posts update')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, response } = await requireEditorOrRespond(req)
    if (response) return response
    // Fix #3: EDITOR can only delete their own posts
    if (user.role === 'EDITOR') {
      const existing = await db.post.findUnique({ where: { id }, select: { authorId: true } })
      if (!existing) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
      if (existing.authorId !== user.id) {
        return NextResponse.json({ error: 'Você só pode excluir suas próprias notícias' }, { status: 403 })
      }
    }
    await db.post.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return handleApiError(e, 'posts delete')
  }
}
