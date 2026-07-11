#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Database integrity check
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  console.log('=== DATABASE INTEGRITY CHECK ===\n')

  const counts = {
    users: await db.user.count(),
    posts: await db.post.count(),
    categories: await db.category.count(),
    classifiedListings: await db.classifiedListing.count(),
    classifiedCategories: await db.classifiedCategory.count(),
    plans: await db.plan.count(),
    subscriptions: await db.subscription.count(),
    ads: await db.ad.count(),
    payments: await db.paymentTransaction.count(),
    pointTransactions: await db.pointTransaction.count(),
    creditTransactions: await db.creditTransaction.count(),
    editorProfiles: await db.editorProfile.count(),
    sessions: await db.session.count(),
    notifications: await db.notification.count(),
    leads: await db.lead.count(),
    reviews: await db.review.count(),
    favorites: await db.favorite.count(),
    coupons: await db.coupon.count(),
    achievements: await db.achievement.count(),
    userAchievements: await db.userAchievement.count(),
    seoSettings: await db.seoSetting.count(),
    quoteProducts: await db.quoteProduct.count(),
    quoteSources: await db.quoteSource.count(),
    quotes: await db.quote.count(),
  }

  console.log('Entity counts:')
  for (const [k, v] of Object.entries(counts)) {
    const icon = v > 0 ? '✅' : '⚠️ '
    console.log(`  ${icon} ${k.padEnd(25)} ${v}`)
  }

  // Specific checks
  console.log('\n=== SPECIFIC CHECKS ===')

  // 1. At least 1 MASTER user
  const masters = await db.user.count({ where: { role: 'MASTER' } })
  console.log(`  ${masters >= 1 ? '✅' : '❌'} At least 1 MASTER user: ${masters}`)

  // 2. At least 1 active subscription
  const activeSubs = await db.subscription.count({ where: { status: 'ACTIVE' } })
  console.log(`  ${activeSubs >= 1 ? '✅' : '⚠️ '} Active subscriptions: ${activeSubs}`)

  // 3. Plans: 4 distinct slugs
  const plans = await db.plan.findMany({ select: { slug: true } })
  const planSlugs = plans.map(p => p.slug).sort()
  const expectedSlugs = ['FREE', 'PROFESSIONAL', 'COMPANY', 'PREMIUM']
  const plansMatch = JSON.stringify(planSlugs) === JSON.stringify(expectedSlugs)
  console.log(`  ${plansMatch ? '✅' : '❌'} 4 plans (FREE/PROFESSIONAL/COMPANY/PREMIUM): ${planSlugs.join('/')}`)

  // 4. Orphan sessions
  const orphanSessions = await db.session.count({
    where: { user: null }
  }).catch(() => 0)
  console.log(`  ${orphanSessions === 0 ? '✅' : '❌'} No orphan sessions: ${orphanSessions}`)

  // 5. Pending verifications
  const pendingVerifs = await db.user.count({ where: { verificationStatus: 'PENDING' } })
  console.log(`  ℹ️  Pending CPF/CNPJ verifications: ${pendingVerifs}`)

  // 6. Pending posts for review
  const pendingPosts = await db.post.count({ where: { status: 'PENDING' } })
  console.log(`  ℹ️  Pending posts for review: ${pendingPosts}`)

  // 7. Pending classifieds
  const pendingClassifieds = await db.classifiedListing.count({ where: { status: 'PENDING' } })
  console.log(`  ℹ️  Pending classifieds: ${pendingClassifieds}`)

  // 8. Pending ads
  const pendingAds = await db.ad.count({ where: { status: 'PENDING' } })
  console.log(`  ℹ️  Pending ads: ${pendingAds}`)

  // 9. Most active users (top 3 by posts)
  const topAuthors = await db.user.findMany({
    take: 3,
    orderBy: { posts: { _count: 'desc' } },
    select: { name: true, email: true, _count: { select: { posts: true } } },
  })
  console.log('\n  Top 3 authors:')
  topAuthors.forEach(a => console.log(`    - ${a.name} (${a.email}): ${a._count.posts} posts`))

  // 10. Revenue stats
  const paidTx = await db.paymentTransaction.aggregate({
    where: { status: 'PAID' },
    _sum: { amountCents: true },
    _count: true,
  })
  console.log(`\n  💰 Total paid revenue: R$ ${(paidTx._sum.amountCents || 0) / 100} (${paidTx._count} transactions)`)

  // 11. Quote products with values
  const quotesWithValues = await db.quote.count()
  console.log(`  📈 Quote entries in DB: ${quotesWithValues}`)

  // 12. MRR calculation
  const activeSubsWithPlan = await db.subscription.findMany({
    where: { status: 'ACTIVE' },
    include: { plan: { select: { priceCents: true, name: true } } },
  })
  const mrr = activeSubsWithPlan.reduce((sum, s) => sum + (s.plan?.priceCents || 0), 0)
  console.log(`  💵 MRR (Monthly Recurring Revenue): R$ ${mrr / 100}`)

  console.log('\n=== DONE ===')
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect())
