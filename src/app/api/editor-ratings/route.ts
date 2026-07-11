import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/editor-ratings?editorId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const editorId = url.searchParams.get('editorId')
  if (!editorId) return NextResponse.json({ ratings: [] })

  const ratings = await db.editorRating.findMany({
    where: { editorId },
    include: { rater: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ ratings })
}

// POST - rate an editor (1-5 stars)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login para avaliar' }, { status: 401 })
    const body = await req.json()
    const { editorId, rating, comment, postId } = body
    if (!editorId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Avaliação inválida (1-5)' }, { status: 400 })
    }
    if (editorId === user.id) {
      return NextResponse.json({ error: 'Você não pode avaliar a si mesmo' }, { status: 400 })
    }

    const editor = await db.user.findUnique({ where: { id: editorId } })
    if (!editor) return NextResponse.json({ error: 'Editor não encontrado' }, { status: 404 })

    const existing = await db.editorRating.findUnique({
      where: { editorId_raterId: { editorId, raterId: user.id } },
    })
    if (existing) {
      // Update existing rating
      const updated = await db.editorRating.update({
        where: { id: existing.id },
        data: { rating, comment: comment || null, postId: postId || null },
        include: { rater: { select: { id: true, name: true, avatar: true } } },
      })
      return NextResponse.json({ rating: updated, action: 'updated' })
    }

    const newRating = await db.editorRating.create({
      data: { editorId, raterId: user.id, rating, comment: comment || null, postId: postId || null },
      include: { rater: { select: { id: true, name: true, avatar: true } } },
    })

    // Notify editor
    await db.notification.create({
      data: {
        userId: editorId,
        type: 'REVIEW',
        title: `Nova avaliação de ${user.name}`,
        message: `${user.name} te avaliou com ${rating} estrela(s).${comment ? ` Comentário: "${comment}"` : ''}`,
        link: 'profile',
      },
    })

    // Award points to rater (5 pts)
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { points: { increment: 5 } } }),
      db.pointTransaction.create({ data: { userId: user.id, amount: 5, reason: 'EDITOR_RATING' } }),
    ])

    return NextResponse.json({ rating: newRating, action: 'created', pointsAwarded: 5 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
