import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { processReview, REJECTION_REASONS } from '@/lib/editors'
import { handleApiError } from '@/lib/api-helpers'

// POST /api/posts/review/[id] - approve or reject a post
// Body: { action: 'APPROVED' | 'REJECTED', reason?: string, notes?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (!['MASTER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    const body = await req.json()
    const { action, reason, notes } = body

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida (use APPROVED ou REJECTED)' }, { status: 400 })
    }

    if (action === 'REJECTED' && reason && !REJECTION_REASONS.find(r => r.value === reason)) {
      return NextResponse.json({ error: 'Motivo inválido' }, { status: 400 })
    }

    const post = await db.post.findUnique({ where: { id } })
    if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
    if (post.status !== 'PENDING') {
      return NextResponse.json({ error: `Post já foi revisado (status: ${post.status})` }, { status: 400 })
    }

    const updated = await processReview(id, user.id, action, reason, notes)

    return NextResponse.json({
      post: updated,
      message: action === 'APPROVED' ? 'Notícia aprovada e publicada!' : 'Notícia rejeitada. Editor será notificado.',
    })
  } catch (e: any) {
    return handleApiError(e, 'posts review')
  }
}
