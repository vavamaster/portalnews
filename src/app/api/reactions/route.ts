import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getPointsConfig } from '@/lib/seo'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const postId = url.searchParams.get('postId')
  const user = await getCurrentUser(req)

  if (postId) {
    // count reactions per type for this post
    const reactions = await db.reaction.groupBy({
      by: ['type'],
      where: { postId },
      _count: true,
    })
    const counts: Record<string, number> = {}
    for (const r of reactions) counts[r.type] = r._count
    let mine: string | null = null
    if (user) {
      const myReaction = await db.reaction.findUnique({
        where: { userId_postId: { userId: user.id, postId } },
      })
      mine = myReaction?.type ?? null
    }
    return NextResponse.json({ counts, mine })
  }
  return NextResponse.json({ error: 'postId obrigatório' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login para reagir' }, { status: 401 })
    const { postId, type } = await req.json()
    if (!postId || !type) return NextResponse.json({ error: 'postId e type obrigatórios' }, { status: 400 })
    const validTypes = ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const config = await getPointsConfig()
    const post = await db.post.findUnique({ where: { id: postId }, include: { author: true } })
    if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })

    const existing = await db.reaction.findUnique({
      where: { userId_postId: { userId: user.id, postId } },
    })

    if (existing) {
      if (existing.type === type) {
        // remove reaction - no points removal (already given)
        await db.reaction.delete({ where: { id: existing.id } })
        return NextResponse.json({ action: 'removed', type: null })
      }
      // change type - no extra points
      await db.reaction.update({
        where: { id: existing.id },
        data: { type },
      })
      return NextResponse.json({ action: 'updated', type })
    }

    // new reaction - award points if not exceeding per-post cap
    // Count how many reactions the user has given across all posts today... actually cap per post is for reader receiving? No, cap means user can only earn up to X from reactions per post. Since one user one reaction per post - it's a single one.
    // The cap is about limiting: user can only earn maxReactionsPerPost points from a single post. Since each user can only react once per post, they earn at most pointsPerReaction.
    // Cap interpreted: max reactions PER USER PER POST = 1 (so 5 points max). cap at config.maxReactionsPerPost applies to TOTAL reactions a single user can earn from one post.

    const pointsToAward = Math.min(config.pointsPerReaction, config.maxReactionsPerPost)

    await db.$transaction([
      db.reaction.create({
        data: { userId: user.id, postId, type, points: pointsToAward },
      }),
      db.user.update({
        where: { id: user.id },
        data: { points: { increment: pointsToAward } },
      }),
      db.pointTransaction.create({
        data: {
          userId: user.id,
          amount: pointsToAward,
          reason: 'REACTION',
          postId,
        },
      }),
      // Also reward the post author with same points
      ...(post.authorId !== user.id ? [
        db.user.update({
          where: { id: post.authorId },
          data: { points: { increment: pointsToAward } },
        }),
        db.pointTransaction.create({
          data: {
            userId: post.authorId,
            amount: pointsToAward,
            reason: 'REACTION_RECEIVED',
            postId,
          },
        }),
      ] : []),
    ])

    // Check achievements for both users
    try {
      const { autoCheckAchievements } = await import('@/lib/achievements')
      await autoCheckAchievements(user.id)
      if (post.authorId !== user.id) {
        await autoCheckAchievements(post.authorId)
      }
    } catch (e) { console.error('Achievement check failed:', e) }

    return NextResponse.json({ action: 'created', type, pointsAwarded: pointsToAward })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
