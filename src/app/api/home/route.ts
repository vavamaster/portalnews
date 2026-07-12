import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/home — aggregated home page data with NO duplicate posts across blocks
// Returns: slide, hero, subHero, latest, mostRead, byCategory
// Each block excludes posts already used in previous blocks.
// Config is loaded from SeoSetting key 'home_layout_config' (set by admin).
export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  // === Step 0: Load home layout config from DB (admin-configurable) ===
  const configDoc = await db.seoSetting.findUnique({ where: { key: 'home_layout_config' } })
  const cfg: any = configDoc?.value ? JSON.parse(configDoc.value) : {}
  const categoryCount = cfg.categoryCount || parseInt(url.searchParams.get('categoryCount') || '6', 10)
  const postsPerCategory = cfg.postsPerCategory || parseInt(url.searchParams.get('postsPerCategory') || '4', 10)
  const slideEnabled = cfg.slideEnabled !== false
  const slidePostCount = cfg.slidePostCount || 5
  const slideFilterType = cfg.slideFilterType || 'featured'
  const heroEnabled = cfg.heroEnabled !== false
  const heroFilterType = cfg.heroFilterType || 'featured'
  const subHeroCount = cfg.subHeroCount ?? 4
  const subHeroPreferFeatured = cfg.subHeroPreferFeatured !== false
  const latestCount = cfg.latestCount || 8
  const mostReadCount = cfg.mostReadCount || 5
  const dedupStrategy = cfg.dedupStrategy || 'strict'

  // === Step 1: Load slide config ===
  // If slide_config_global doesn't exist in DB, use sensible defaults
  // so the slide renders out-of-the-box without admin configuration
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
  const slideConfigDoc = await db.seoSetting.findUnique({ where: { key: 'slide_config_global' } })
  let slideConfig: any = { ...DEFAULT_SLIDE_CONFIG }
  if (slideConfigDoc) {
    try {
      slideConfig = { ...DEFAULT_SLIDE_CONFIG, ...JSON.parse(slideConfigDoc.value) }
    } catch {}
  }

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
  if (slideEnabled && slideConfig?.isEnabled !== false) {
    const filterType = slideConfig?.filterType || slideFilterType
    if (filterType === 'featured') {
      slidePosts = pick(allPosts.filter(p => p.featured), slidePostCount)
      // Bug 2 fix: if NO featured posts at all, fall back to most recent
      if (slidePosts.length === 0) {
        slidePosts = pick(allPosts, slidePostCount)
      } else if (slidePosts.length < slidePostCount) {
        // Not enough featured, fill with most viewed
        slidePosts = [...slidePosts, ...pick(mostViewedPool, slidePostCount - slidePosts.length)]
      }
    } else if (filterType === 'breaking') {
      slidePosts = pick(allPosts.filter(p => p.breaking), slidePostCount)
      // Same fallback for breaking
      if (slidePosts.length === 0) {
        slidePosts = pick(allPosts, slidePostCount)
      } else if (slidePosts.length < slidePostCount) {
        slidePosts = [...slidePosts, ...pick(allPosts, slidePostCount - slidePosts.length)]
      }
    } else if (filterType === 'views') {
      slidePosts = pick(mostViewedPool, slidePostCount)
      if (slidePosts.length === 0) {
        slidePosts = pick(allPosts, slidePostCount)
      }
    } else {
      // 'recent' or 'all'
      slidePosts = pick(allPosts, slidePostCount)
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
      categoryBlocks: Object.fromEntries(
        Object.entries(byCategory).map(([k, v]) => [k, v.length])
      ),
    },
  })
}
