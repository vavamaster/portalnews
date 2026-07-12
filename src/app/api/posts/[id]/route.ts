import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

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
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (!['MASTER', 'ADMIN', 'EDITOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }
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
    if (body.status === 'PUBLISHED' && !existing.publishedAt) {
      update.publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date()
    }
    if (body.status === 'SCHEDULED' && body.publishedAt) {
      update.scheduledAt = new Date(body.publishedAt)
    }

    const post = await db.post.update({ where: { id }, data: update, include: { category: true, author: true } })
    return NextResponse.json({ post })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (!['MASTER', 'ADMIN', 'EDITOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }
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
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
