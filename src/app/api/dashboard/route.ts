import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN', 'EDITOR'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const isMasterOrAdmin = ['MASTER', 'ADMIN'].includes(user.role)

  const [
    postsCount, publishedCount, draftsCount, pendingCount, usersCount, adsCount, totalViews,
    activeSubscriptions, canceledSubscriptions, totalSubscriptions,
    paidTx, paidTxSum,
    tx30d, tx30dSum,
    txByType, txByProvider, txByStatus,
    recentTxList,
    subscriptionsByPlan,
    classifiedsCount, classifiedsActive,
    pendingVerifications,
    pendingClassifieds,
    pendingPosts,
    pendingAds,
  ] = await Promise.all([
    db.post.count(),
    db.post.count({ where: { status: 'PUBLISHED' } }),
    db.post.count({ where: { status: 'DRAFT' } }),
    db.post.count({ where: { status: 'PENDING' } }),
    db.user.count(),
    db.ad.count(),
    db.post.aggregate({ _sum: { views: true } }),
    db.subscription.count({ where: { status: 'ACTIVE' } }),
    db.subscription.count({ where: { status: 'CANCELED' } }),
    db.subscription.count(),
    db.paymentTransaction.findMany({ where: { status: 'PAID' } }),
    db.paymentTransaction.aggregate({ where: { status: 'PAID' }, _sum: { amountCents: true } }),
    db.paymentTransaction.findMany({ where: { status: 'PAID', createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    db.paymentTransaction.aggregate({ where: { status: 'PAID', createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, _sum: { amountCents: true } }),
    db.paymentTransaction.groupBy({ by: ['type'], _count: { _all: true }, _sum: { amountCents: true } }),
    db.paymentTransaction.groupBy({ by: ['provider'], _count: { _all: true }, _sum: { amountCents: true } }),
    db.paymentTransaction.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amountCents: true } }),
    db.paymentTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    }),
    db.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: { select: { id: true, slug: true, name: true, priceCents: true } } },
    }),
    db.classifiedListing.count(),
    db.classifiedListing.count({ where: { status: 'ACTIVE' } }),
    db.user.count({ where: { verificationStatus: 'PENDING' } }),
    db.classifiedListing.count({ where: { status: 'PENDING' } }),
    db.post.count({ where: { status: 'PENDING' } }),
    db.ad.count({ where: { status: 'PENDING' } }),
  ])

  const recentPosts = await db.post.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true } }, category: true },
  })

  const topPosts = await db.post.findMany({
    take: 5,
    orderBy: { views: 'desc' },
    include: { category: true },
  })

  // Posts by category
  const categories = await db.category.findMany({
    include: { _count: { select: { posts: true } } },
    orderBy: { order: 'asc' },
  })
  const byCategory = categories.map(c => ({ name: c.name, count: c._count.posts, color: c.color }))

  // Posts last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentPostsList = await db.post.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true, status: true },
  })
  const days: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    const count = recentPostsList.filter(p => p.createdAt.toISOString().slice(0, 10) === dateStr).length
    days.push({ date: dateStr, count })
  }

  // Revenue by day (last 14 days, PAID only)
  const revenueByDay: { date: string; cents: number; count: number }[] = []
  const fourteenDaysAgo = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)
  const recentTx = await db.paymentTransaction.findMany({
    where: { status: 'PAID', createdAt: { gte: fourteenDaysAgo } },
    select: { createdAt: true, amountCents: true, discountCents: true },
  })
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    const dayTx = recentTx.filter(t => t.createdAt.toISOString().slice(0, 10) === dateStr)
    const cents = dayTx.reduce((s, t) => s + Math.max(0, t.amountCents - (t.discountCents || 0)), 0)
    revenueByDay.push({ date: dateStr, cents, count: dayTx.length })
  }

  // Active subscriptions grouped by plan + MRR calculation
  const plans = await db.plan.findMany()
  const planAggregation = plans.map(plan => {
    const subs = subscriptionsByPlan.filter(s => s.planId === plan.id)
    return {
      planId: plan.id,
      planSlug: plan.slug,
      planName: plan.name,
      priceCents: plan.priceCents,
      activeCount: subs.length,
      monthlyRevenueCents: subs.length * plan.priceCents,
    }
  })

  // MRR = sum of (active subscriptions * plan monthly price)
  const mrrCents = planAggregation.reduce((s, p) => s + p.monthlyRevenueCents, 0)
  // ARPU = MRR / active subs
  const arpuCents = activeSubscriptions > 0 ? Math.round(mrrCents / activeSubscriptions) : 0

  // Pending verifications list (for admin quick view)
  const pendingVerificationsList = pendingVerifications > 0 ? await db.user.findMany({
    where: { verificationStatus: 'PENDING' },
    select: { id: true, name: true, email: true, verificationType: true, verificationDoc: true, createdAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  }) : []

  // Paid transactions by type with formatted labels
  const txByTypeFormatted = txByType.map(t => ({
    type: t.type,
    typeLabel: t.type === 'SUBSCRIPTION' ? 'Assinatura' : t.type === 'BOOST' ? 'Boost' : t.type === 'FEATURED' ? 'Destaque' : t.type,
    count: t._count._all,
    totalCents: t._sum.amountCents || 0,
  }))

  const txByProviderFormatted = txByProvider.map(t => ({
    provider: t.provider,
    providerLabel: t.provider === 'ASAAS' ? 'Asaas' : t.provider === 'MERCADO_PAGO' ? 'Mercado Pago' : t.provider === 'STRIPE' ? 'Stripe' : t.provider,
    count: t._count._all,
    totalCents: t._sum.amountCents || 0,
  }))

  const txByStatusFormatted = txByStatus.map(t => ({
    status: t.status,
    statusLabel: t.status === 'PAID' ? 'Pago' : t.status === 'PENDING' ? 'Pendente' : t.status === 'FAILED' ? 'Falhou' : t.status === 'REFUNDED' ? 'Reembolsado' : t.status,
    count: t._count._all,
    totalCents: t._sum.amountCents || 0,
  }))

  return NextResponse.json({
    stats: {
      postsCount, publishedCount, draftsCount, pendingCount, usersCount, adsCount,
      totalViews: totalViews._sum.views || 0,
      classifiedsCount, classifiedsActive,
      pendingVerifications, pendingClassifieds, pendingPosts, pendingAds,
    },
    recentPosts,
    topPosts,
    byCategory,
    postsByDay: days,
    // Financial (only for MASTER/ADMIN)
    financial: isMasterOrAdmin ? {
      mrrCents,
      arpuCents,
      activeSubscriptions,
      canceledSubscriptions,
      totalSubscriptions,
      totalRevenueCents: paidTxSum._sum.amountCents || 0,
      revenue30dCents: tx30dSum._sum.amountCents || 0,
      paidTxCount: paidTx.length,
      paidTx30dCount: tx30d.length,
      planAggregation,
      txByType: txByTypeFormatted,
      txByProvider: txByProviderFormatted,
      txByStatus: txByStatusFormatted,
      recentTransactions: recentTxList,
      revenueByDay,
    } : null,
    // Moderation queue
    moderation: {
      pendingVerifications: pendingVerificationsList,
      pendingClassifieds,
      pendingPosts,
      pendingAds,
    },
  })
}
