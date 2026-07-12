'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { ArrowRight, Clock, Eye, Newspaper } from 'lucide-react'

interface MegaMenuProps {
  category: { id: string; slug: string; name: string; color?: string | null; description?: string | null }
  children: React.ReactNode
}

interface MegaPost {
  id: string
  title: string
  slug: string
  coverImage: string | null
  excerpt?: string | null
  publishedAt: string | null
  views: number
}

/**
 * Mega-menu that appears on hover over a category in the navigation.
 * Professional layout with:
 *  - Header bar with category color + name + "Ver tudo" button
 *  - Featured post (large image) + 4 compact posts
 *  - Standardized image sizes
 *  - Smooth animations + proper z-index + click-outside to close
 */
export function MegaMenu({ category, children }: MegaMenuProps) {
  const { setView } = useAppStore()
  const [open, setOpen] = useState(false)
  const [posts, setPosts] = useState<MegaPost[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch posts when menu opens for the first time
  useEffect(() => {
    if (!open || fetchedRef.current) return
    fetchedRef.current = true
    setLoading(true)
    void (async () => {
      try {
        const r = await fetch(`/api/posts?category=${category.slug}&limit=5`)
        const d = await r.json()
        setPosts(d.posts || [])
      } catch {} finally {
        setLoading(false)
      }
    })()
  }, [open, category.slug])

  // Debounced hover handlers — 250ms delay before opening, 150ms before closing
  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(true), 250)
  }
  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(false), 150)
  }

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  // Fix: reset fetchedRef when category changes so posts are re-fetched
  useEffect(() => {
    fetchedRef.current = false
    setPosts([])
  }, [category.slug])

  const openArticle = (slug: string) => {
    setOpen(false)
    setView({ name: 'article', slug })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const seeAll = () => {
    setOpen(false)
    setView({ name: 'category', slug: category.slug })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const featuredPost = posts[0]
  const compactPosts = posts.slice(1, 5)

  return (
    <div
      ref={containerRef}
      className="relative h-full"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}

      {open && (
        <>
          {/* Invisible overlay to catch hover gaps */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Mega menu panel */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1 z-50 mega-menu-enter">
            <div
              className="w-[560px] max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
            >
              {/* Header bar — colored with category color */}
              <div
                className="flex items-center justify-between px-4 py-3 text-white"
                style={{ backgroundColor: categoryColor(category.color) }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Newspaper className="h-4 w-4 flex-shrink-0" />
                    <h3 className="text-base font-bold truncate">{category.name}</h3>
                  </div>
                  {category.description && (
                    <p className="text-[11px] text-white/85 mt-0.5 line-clamp-1">{category.description}</p>
                  )}
                </div>
                <button
                  onClick={seeAll}
                  className="flex items-center gap-1 text-[11px] bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md transition-colors font-semibold flex-shrink-0 ml-3"
                >
                  Ver tudo <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {/* Body — featured post + compact posts */}
              <div className="p-3">
                {loading ? (
                  <MegaMenuSkeleton />
                ) : posts.length === 0 ? (
                  <div className="py-10 text-center">
                    <Newspaper className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400">Nenhuma notícia nesta categoria ainda.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Featured post — left column, larger */}
                    {featuredPost && (
                      <button
                        onClick={() => openArticle(featuredPost.slug)}
                        className="group text-left"
                      >
                        <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden mb-2">
                          {featuredPost.coverImage ? (
                            <img
                              src={featuredPost.coverImage}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Newspaper className="h-6 w-6 text-zinc-300 dark:text-zinc-700" />
                            </div>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-3 group-hover:text-primary transition-colors leading-snug">
                          {featuredPost.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-400">
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDate(featuredPost.publishedAt)}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-0.5">
                            <Eye className="h-2.5 w-2.5" /> {featuredPost.views}
                          </span>
                        </div>
                      </button>
                    )}

                    {/* Compact posts — right column, list */}
                    <div className="space-y-2.5">
                      {compactPosts.map(post => (
                        <button
                          key={post.id}
                          onClick={() => openArticle(post.slug)}
                          className="group flex gap-2.5 w-full text-left"
                        >
                          <div className="h-12 w-16 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden flex-shrink-0">
                            {post.coverImage ? (
                              <img
                                src={post.coverImage}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Newspaper className="h-4 w-4 text-zinc-300 dark:text-zinc-700" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                              {post.title}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-1 text-[9px] text-zinc-400">
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-2 w-2" />
                                {formatDate(post.publishedAt)}
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-0.5">
                                <Eye className="h-2 w-2" /> {post.views}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer — quick stats */}
              {!loading && posts.length > 0 && (
                <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span>{posts.length} notícias recentes</span>
                  <button
                    onClick={seeAll}
                    className="flex items-center gap-0.5 hover:text-primary transition-colors font-medium"
                  >
                    Ver todas <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MegaMenuSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Featured skeleton */}
      <div>
        <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-2" />
        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-full animate-pulse" />
        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-2/3 animate-pulse mt-1" />
        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2 animate-pulse mt-2" />
      </div>
      {/* Compact skeleton */}
      <div className="space-y-2.5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-2.5">
            <div className="h-12 w-16 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1 py-0.5">
              <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded w-full animate-pulse" />
              <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4 animate-pulse" />
              <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2 animate-pulse mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(dateStr))
  } catch {
    return '—'
  }
}

// Get category color as hex — fallback to a neutral blue if not set
function categoryColor(color: string | null | undefined): string {
  if (!color) return '#2563eb' // default blue
  // If it's a tailwind color name like 'red', 'blue', etc., convert to hex
  const colorMap: Record<string, string> = {
    red: '#dc2626',
    orange: '#ea580c',
    amber: '#d97706',
    yellow: '#ca8a04',
    lime: '#65a30d',
    green: '#16a34a',
    emerald: '#059669',
    teal: '#0d9488',
    cyan: '#0891b2',
    sky: '#0284c7',
    blue: '#2563eb',
    indigo: '#4f46e5',
    violet: '#7c3aed',
    purple: '#9333ea',
    fuchsia: '#c026d3',
    pink: '#db2777',
    rose: '#e11d48',
    slate: '#475569',
    gray: '#4b5563',
    zinc: '#52525b',
    neutral: '#525252',
    stone: '#57534e',
  }
  return colorMap[color] || '#2563eb'
}
