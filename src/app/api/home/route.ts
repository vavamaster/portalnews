import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/home — aggregated home page data with NO duplicate posts across blocks
// Returns: slide, hero, subHero, latest, mostRead, byCategory
// Each block excludes posts already used in previous blocks.
//
// === Slide config source of truth ===
// 1. SlideConfig Prisma model (scope=GLOBAL, categoryId=null) — managed by AdminSlideConfig
// 2. (legacy fallback) SeoSetting.slide_config_global
// 3. (legacy fallback) home_layout_config.slideEnabled / slidePostCount / slideFilterType
// 4. Hardcoded defaults
//
// filterType vocabulary (canonical):
//   featured → posts com flag featured=true
//   latest   → mais recentes (publishedAt desc)
//   breaking → posts com flag breaking=true
//   all      → por relevância (mais vistos)
// Back-compat aliases: views→all, recent→latest
export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  // === Step 0: Load home layout config from DB (admin-configurable) ===
  const configDoc = await db.seoSetting.findUnique({ where: { key: 'home_layout_config' } })
  const cfg: any = configDoc?.value ? JSON.parse(configDoc.value) : {}
  const categoryCount = cfg.categoryCount || parseInt(url.searchParams.get('categoryCount') || '6', 10)
  const postsPerCategory = cfg.postsPerCategory || parseInt(url.searchParams.get('postsPerCategory') || '4', 10)
  // slideEnabled here is ONLY a legacy fallback — real source of truth is SlideConfig.isEnabled
  const legacySlideEnabled = cfg.slideEnabled !== false
  const legacySlidePostCount = cfg.slidePostCount || 5
  const legacySlideFilterType = cfg.slideFilterType || 'featured'
  const heroEnabled = cfg.heroEnabled !== false
  const heroFilterType = cfg.heroFilterType || 'featured'
  const subHeroCount = cfg.subHeroCount ?? 4
  const subHeroPreferFeatured = cfg.subHeroPreferFeatured !== false
  const latestCount = cfg.latestCount || 8
  const mostReadCount = cfg.mostReadCount || 5
  const dedupStrategy = cfg.dedupStrategy || 'strict'

  // === Step 1: Load slide config (source of truth = SlideConfig Prisma table) ===
  const DEFAULT_SLIDE_CONFIG = {
    isEnabled: true,
    postCount: 5,
    autoPlay: true,
    delayMs: 5000,
    designType: 'overlay',
    showDots: true,
    showArrows: true,
    showExcerpt: true,
    showCategory: true,
    showAuthor: false,
    heightPreset: 'tall',
    filterType: 'featured',
  }

  // 1. Try SlideConfig Prisma (managed by AdminSlideConfig — source of truth)
  const slideConfigRow = await db.slideConfig.findFirst({
    where: { scope: 'GLOBAL', categoryId: null },
  })

  // 2. Legacy fallback: SeoSetting.slide_config_global
  const legacySlideConfigDoc = await db.seoSetting.findUnique({ where: { key: 'slide_config_global' } })
  let legacySlideConfig: any = null
  if (legacySlideConfigDoc) {
    try { legacySlideConfig = JSON.parse(legacySlideConfigDoc.value) } catch {}
  }

  // 3. Build final slideConfig with precedence:
  //    SlideConfig Prisma > legacy SeoSetting > defaults
  let slideConfig: any = { ...DEFAULT_SLIDE_CONFIG }
  if (legacySlideConfig) {
    slideConfig = { ...slideConfig, ...legacySlideConfig }
  }
  if (slideConfigRow) {
    slideConfig = {
      ...slideConfig,
      isEnabled: slideConfigRow.isEnabled,
      postCount: slideConfigRow.postCount,
      autoPlay: slideConfigRow.autoPlay,
      delayMs: slideConfigRow.delayMs,
      designType: slideConfigRow.designType,
      showDots: slideConfigRow.showDots,
      showArrows: slideConfigRow.showArrows,
      showExcerpt: slideConfigRow.showExcerpt,
      showCategory: slideConfigRow.showCategory,
      showAuthor: slideConfigRow.showAuthor,
      heightPreset: slideConfigRow.heightPreset,
      filterType: slideConfigRow.filterType,
    }
  }

  // Normalize filterType with back-compat aliases
  const rawFilter = String(slideConfig.filterType || legacySlideFilterType || 'featured').toLowerCase()
  let normalizedFilter: 'featured' | 'latest' | 'breaking' | 'all'
  if (rawFilter === 'featured' || rawFilter === 'latest' || rawFilter === 'breaking' || rawFilter === 'all') {
    normalizedFilter = rawFilter
  } else if (rawFilter === 'views') {
    normalizedFilter = 'all' // alias
  } else if (rawFilter === 'recent') {
    normalizedFilter = 'latest' // alias
  } else {
    normalizedFilter = 'featured'
  }
  slideConfig.filterType = normalizedFilter

  // Effective post count: SlideConfig > legacy home_layout_config > default
  const effectiveSlidePostCount = slideConfigRow?.postCount || legacySlideConfig?.postCount || legacySlidePostCount

  // Effective enabled: SlideConfig > legacy home_layout_config > default
  const slideEffectivelyEnabled =
    slideConfigRow ? slideConfigRow.isEnabled : (legacySlideConfig?.isEnabled ?? legacySlideEnabled)

  // === Step 2: Load ALL published posts in one query (large pool to draw from) ===
  // We fetch more than needed to have room for deduplication
  const poolSize = 100
  const allPosts = await db.post.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      category: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: poolSize,
  })

  // Also load "most viewed" pool (might overlap, but we'll handle that)
  const mostViewedPool = await db.post.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      category: true,
    },
    orderBy: { views: 'desc' },
    take: 30,
  })

  // Index mostViewedPool for quick lookup
  const mostViewedMap = new Map(mostViewedPool.map(p => [p.id, p]))

  // === Step 3: Categories (top N by order) ===
  const categories = await db.category.findMany({
    where: { parentId: null },
    orderBy: { order: 'asc' },
    take: categoryCount,
  })

  // === Step 4: Allocate posts to each block with deduplication ===
  const usedIds = new Set<string>()

  const pick = (source: any[], count: number, filter?: (p: any) => boolean): any[] => {
    const result: any[] = []
    for (const p of source) {
      if (result.length >= count) break
      if (usedIds.has(p.id)) continue
      if (filter && !filter(p)) continue
      result.push(p)
      usedIds.add(p.id)
    }
    return result
  }

  // --- Block A: Slide ---
  let slidePosts: any[] = []
  if (slideEffectivelyEnabled) {
    const filterType = normalizedFilter
    if (filterType === 'featured') {
      slidePosts = pick(allPosts.filter(p => p.featured), effectiveSlidePostCount)
      // Bug 2 fix: if NO featured posts at all, fall back to most recent
      if (slidePosts.length === 0) {
        slidePosts = pick(allPosts, effectiveSlidePostCount)
      } else if (slidePosts.length < effectiveSlidePostCount) {
        // Not enough featured, fill with most viewed
        slidePosts = [...slidePosts, ...pick(mostViewedPool, effectiveSlidePostCount - slidePosts.length)]
      }
    } else if (filterType === 'breaking') {
      slidePosts = pick(allPosts.filter(p => p.breaking), effectiveSlidePostCount)
      // Same fallback for breaking
      if (slidePosts.length === 0) {
        slidePosts = pick(allPosts, effectiveSlidePostCount)
      } else if (slidePosts.length < effectiveSlidePostCount) {
        slidePosts = [...slidePosts, ...pick(allPosts, effectiveSlidePostCount - slidePosts.length)]
      }
    } else if (filterType === 'all') {
      // "all by relevance" — most viewed first (relevance proxy)
      slidePosts = pick(mostViewedPool, effectiveSlidePostCount)
      if (slidePosts.length === 0) {
        slidePosts = pick(allPosts, effectiveSlidePostCount)
      }
    } else {
      // 'latest' — most recent (default branch; allPosts is already ordered by publishedAt desc)
      slidePosts = pick(allPosts, effectiveSlidePostCount)
    }
  }

  // --- Block B: Hero (1 post) ---
  // Pick the most recent featured post that's not in slide (if heroFilterType === 'featured')
  let heroPost: any = null
  if (heroEnabled) {
    const heroCandidates = heroFilterType === 'featured'
      ? allPosts.filter(p => p.featured)
      : allPosts
    heroPost = pick(heroCandidates, 1)[0] || null
  }

  // --- Block C: Sub-hero (4 posts, exclude slide + hero) ---
  let subHeroPosts: any[] = []
  if (heroEnabled && subHeroCount > 0) {
    const subHeroCandidates = subHeroPreferFeatured
      ? allPosts.filter(p => p.featured)
      : allPosts
    subHeroPosts = pick(subHeroCandidates, subHeroCount)
    if (subHeroPosts.length < subHeroCount) {
      subHeroPosts = [...subHeroPosts, ...pick(allPosts, subHeroCount - subHeroPosts.length)]
    }
  }

  // --- Block D: Latest news (exclude everything above) ---
  const latest = pick(allPosts, latestCount)

  // --- Block E: Most read (exclude everything above) ---
  let mostRead = pick(mostViewedPool, mostReadCount)
  if (mostRead.length < mostReadCount) {
    mostRead = [...mostRead, ...pick(allPosts, mostReadCount - mostRead.length)]
  }

  // --- Block F: Per-category blocks ---
  // Each category block shows ONLY posts that haven't been used in any previous block.
  // In 'strict' mode (default): if category has 0 unused posts, the block is omitted.
  // In 'flexible' mode: allows reusing posts from latest/mostRead (but never from slide).
  const byCategory: Record<string, any[]> = {}
  const slideIds = new Set(slidePosts.map(p => p.id))
  for (const cat of categories) {
    let catPosts = pick(allPosts, postsPerCategory, (p) => p.categoryId === cat.id)
    // If not enough, load more from DB for this category (excluding ALL used IDs)
    if (catPosts.length < postsPerCategory) {
      const additional = await db.post.findMany({
        where: {
          status: 'PUBLISHED',
          categoryId: cat.id,
          id: { notIn: Array.from(usedIds) },
        },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: postsPerCategory - catPosts.length,
      })
      additional.forEach(p => { usedIds.add(p.id); catPosts.push(p) })
    }
    // Flexible mode: allow reuse from latest/mostRead (but NEVER from slide)
    if (dedupStrategy === 'flexible' && catPosts.length < postsPerCategory) {
      const fallback = await db.post.findMany({
        where: {
          status: 'PUBLISHED',
          categoryId: cat.id,
          id: { notIn: Array.from(slideIds) },
        },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: postsPerCategory - catPosts.length,
      })
      catPosts = [...catPosts, ...fallback.filter(p => !catPosts.some(c => c.id === p.id))]
    }
    byCategory[cat.slug] = catPosts
  }

  // === Step 5: Return aggregated response ===
  return NextResponse.json({
    slide: {
      config: slideConfig,
      posts: slidePosts,
      // Surface the source for debugging/admin transparency
      source: slideConfigRow ? 'slide_config_table' : (legacySlideConfig ? 'legacy_seosetting' : 'defaults'),
    },
    hero: heroPost,
    subHero: subHeroPosts,
    latest,
    mostRead,
    byCategory,
    categories: categories.map(c => ({ id: c.id, slug: c.slug, name: c.name, color: c.color, description: c.description })),
    stats: {
      totalPoolSize: allPosts.length,
      totalUsed: usedIds.size,
      slideCount: slidePosts.length,
      heroCount: heroPost ? 1 : 0,
      subHeroCount: subHeroPosts.length,
      latestCount: latest.length,
      mostReadCount: mostRead.length,
      slideConfigSource: slideConfigRow ? 'slide_config_table' : (legacySlideConfig ? 'legacy_seosetting' : 'defaults'),
      slideFilterType: normalizedFilter,
      slidePostCount: effectiveSlidePostCount,
      categoryBlocks: Object.fromEntries(
        Object.entries(byCategory).map(([k, v]) => [k, v.length])
      ),
    },
  })
}
