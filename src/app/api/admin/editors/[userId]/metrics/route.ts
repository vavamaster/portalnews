import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/editors/[userId]/metrics — performance metrics for one editor
export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const currentUser = await getCurrentUser(req)
  if (!currentUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(currentUser.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, avatar: true, bio: true, role: true,
      verificationStatus: true, createdAt: true,
    },
  })
  if (!targetUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const profile = await db.editorProfile.findUnique({ where: { userId } })

  // Time boundaries
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // First, get all post IDs for this author
  const authorPostIds = await db.post.findMany({
    where: { authorId: userId },
    select: { id: true },
    take: 1000,
  })
  const authorPostIdList = authorPostIds.map(p => p.id)

  // If the user has no posts, skip PostReviewLog queries entirely
  const canQueryReviews = authorPostIdList.length > 0

  const [
    allPosts, posts7d, posts30d,
    publishedCount, draftCount, pendingCount, rejectedCount,
    totalViewsAgg, totalViews7dAgg,
    categoriesDistribution,
    postsByDayRaw,
    topPosts,
    reviewLogsRaw,
    reviewActionCounts,
  ] = await Promise.all([
    db.post.count({ where: { authorId: userId } }),
    db.post.count({ where: { authorId: userId, createdAt: { gte: sevenDaysAgo } } }),
    db.post.count({ where: { authorId: userId, createdAt: { gte: thirtyDaysAgo } } }),
    db.post.count({ where: { authorId: userId, status: 'PUBLISHED' } }),
    db.post.count({ where: { authorId: userId, status: 'DRAFT' } }),
    db.post.count({ where: { authorId: userId, status: 'PENDING' } }),
    db.post.count({ where: { authorId: userId, status: 'REJECTED' } }),
    db.post.aggregate({ where: { authorId: userId }, _sum: { views: true } }),
    db.post.aggregate({ where: { authorId: userId, createdAt: { gte: sevenDaysAgo } }, _sum: { views: true } }),
    db.post.groupBy({
      by: ['categoryId'],
      where: { authorId: userId },
      _count: { _all: true },
    }),
    db.post.findMany({
      where: { authorId: userId, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    db.post.findMany({
      where: { authorId: userId, status: 'PUBLISHED' },
      orderBy: { views: 'desc' },
      take: 5,
      select: { id: true, slug: true, title: true, views: true, publishedAt: true, coverImage: true, category: { select: { name: true, color: true } } },
    }),
    // Get review log entries (filter by postId list since no relation exists)
    canQueryReviews
      ? db.postReviewLog.findMany({
          where: { postId: { in: authorPostIdList } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, action: true, reason: true, notes: true, createdAt: true, postId: true, reviewerId: true,
          },
        })
      : Promise.resolve([]),
    canQueryReviews
      ? db.postReviewLog.groupBy({
          by: ['action'],
          where: { postId: { in: authorPostIdList } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ])

  // Manually load post titles for the review logs (since PostReviewLog has no Post relation)
  const reviewPostIds = [...new Set(reviewLogsRaw.map(r => r.postId))]
  const reviewPosts = reviewPostIds.length > 0 ? await db.post.findMany({
    where: { id: { in: reviewPostIds } },
    select: { id: true, title: true, slug: true },
  }) : []
  const reviewPostMap = new Map(reviewPosts.map(p => [p.id, p]))

  // Manually load reviewer names
  const reviewerIds = [...new Set(reviewLogsRaw.map(r => r.reviewerId).filter(Boolean) as string[])]
  const reviewers = reviewerIds.length > 0 ? await db.user.findMany({
    where: { id: { in: reviewerIds } },
    select: { id: true, name: true, avatar: true },
  }) : []
  const reviewerMap = new Map(reviewers.map(u => [u.id, u]))

  const recentReviews = reviewLogsRaw.map(r => ({
    id: r.id,
    action: r.action,
    reason: r.reason,
    notes: r.notes,
    createdAt: r.createdAt,
    post: reviewPostMap.get(r.postId) ? { id: r.postId, title: reviewPostMap.get(r.postId)!.title, slug: reviewPostMap.get(r.postId)!.slug } : null,
    reviewer: r.reviewerId ? (reviewerMap.get(r.reviewerId) ? { id: r.reviewerId, name: reviewerMap.get(r.reviewerId)!.name, avatar: reviewerMap.get(r.reviewerId)!.avatar } : null) : null,
  }))

  // Categories with names
  const categoryIds = categoriesDistribution.map(c => c.categoryId)
  const categories = categoryIds.length > 0 ? await db.category.findMany({ where: { id: { in: categoryIds } } }) : []
  const categoriesWithNames = categoriesDistribution.map((c: any) => {
    const cat = categories.find(x => x.id === c.categoryId)
    return {
      id: c.categoryId,
      name: cat?.name || '—',
      color: cat?.color || 'zinc',
      count: c._count._all as number,
    }
  }).sort((a, b) => b.count - a.count)

  // Posts by day (7d)
  const postsByDay: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    const count = postsByDayRaw.filter(p => p.createdAt.toISOString().slice(0, 10) === dateStr).length
    postsByDay.push({ date: dateStr, count })
  }

  // Approval rate
  const reviewCounts = reviewActionCounts as Array<{ action: string; _count: { _all: number } }>
  const approvedCount = reviewCounts.find(a => a.action === 'APPROVED')?._count._all ?? 0
  const rejectedCount2 = reviewCounts.find(a => a.action === 'REJECTED')?._count._all ?? 0
  const totalReviewed = approvedCount + rejectedCount2
  const approvalPct = totalReviewed > 0 ? Math.round((approvedCount / totalReviewed) * 100) : 0

  // Editor ratings
  const ratings = await db.editorRating.findMany({
    where: { editorId: userId },
    select: { rating: true, comment: true, createdAt: true, rater: { select: { name: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0

  return NextResponse.json({
    user: targetUser,
    profile,
    summary: {
      totalPosts: allPosts,
      posts7d,
      posts30d,
      publishedCount,
      draftCount,
      pendingCount,
      rejectedCount,
      totalViews: totalViewsAgg._sum.views || 0,
      totalViews7d: totalViews7dAgg._sum.views || 0,
      avgViewsPerPost: allPosts > 0 ? Math.round((totalViewsAgg._sum.views || 0) / allPosts) : 0,
      approvalPct,
      approvedCount,
      rejectedByReview: rejectedCount2,
      avgRating,
      ratingsCount: ratings.length,
    },
    categoriesDistribution: categoriesWithNames,
    postsByDay,
    topPosts,
    recentReviews,
    ratings,
    trustHistory: profile ? {
      current: profile.trustLevel,
      level: profile.level,
      consecutiveApprovals: profile.consecutiveApprovals,
      totalApproved: profile.totalApproved,
      totalRejected: profile.totalRejected,
      totalAutoApproved: profile.totalAutoApproved,
      totalAutoRejected: profile.totalAutoRejected,
      autoApproveThreshold: profile.autoApproveThreshold,
    } : null,
  })
}
