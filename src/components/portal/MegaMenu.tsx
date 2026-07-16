'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { ArrowRight, Clock, Eye, Newspaper } from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { SmartImage } from '@/components/ui/smart-image'

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
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

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

  // Debounced hover handlers reduce accidental flyouts while keeping navigation responsive.
  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(true), 300)
  }
  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(false), 180)
  }
  const closeImmediately = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setOpen(false)
  }

  const handleFocus = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(true)
  }

  const handleBlur = () => {
    requestAnimationFrame(() => {
      const activeElement = document.activeElement
      if (
        activeElement
        && !triggerRef.current?.contains(activeElement)
        && !panelRef.current?.contains(activeElement)
      ) {
        setOpen(false)
      }
    })
  }

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown') return
    event.preventDefault()
    setOpen(true)
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    })
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
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchedRef.current = false
    setPosts([])
    /* eslint-enable react-hooks/set-state-in-effect */
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
    <Popover open={open} onOpenChange={setOpen}>
      <div
        ref={triggerRef}
        className="group/mega relative h-full"
        data-state={open ? 'open' : 'closed'}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocusCapture={handleFocus}
        onBlurCapture={handleBlur}
        onKeyDownCapture={handleTriggerKeyDown}
        onClick={closeImmediately}
      >
        <PopoverAnchor asChild>{children}</PopoverAnchor>
      </div>

      <PopoverContent
        ref={panelRef}
        align="center"
        side="bottom"
        sideOffset={6}
        collisionPadding={16}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocusCapture={handleFocus}
        onBlurCapture={handleBlur}
        onOpenAutoFocus={event => event.preventDefault()}
        onCloseAutoFocus={event => event.preventDefault()}
        className="mega-menu-enter z-[70] w-[680px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-0 bg-white p-0 shadow-[0_24px_70px_-18px_rgba(15,23,42,0.55)] dark:bg-zinc-900 dark:shadow-[0_28px_80px_-20px_rgba(0,0,0,0.9)]"
      >
            <div data-mega-menu-panel>
              {/* Header bar — colored with category color */}
              <div
                className="flex items-center justify-between px-5 py-4 text-white"
                style={{ backgroundColor: categoryColor(category.color) }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <Newspaper className="h-5 w-5 flex-shrink-0" />
                    <h3 className="text-lg font-bold truncate">{category.name}</h3>
                  </div>
                  {category.description && (
                    <p className="text-sm text-white/90 mt-1 line-clamp-2 leading-snug">{category.description}</p>
                  )}
                </div>
                <button
                  onClick={seeAll}
                  className="flex items-center gap-1.5 text-sm bg-white/20 hover:bg-white/30 px-3.5 py-2 rounded-md transition-colors font-semibold flex-shrink-0 ml-4"
                >
                  Ver tudo <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {/* Body — featured post + compact posts */}
              <div className="p-4">
                {loading ? (
                  <MegaMenuSkeleton />
                ) : posts.length === 0 ? (
                  <div className="py-12 text-center">
                    <Newspaper className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma notícia nesta categoria ainda.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-[1.1fr_1fr] gap-4">
                    {/* Featured post — left column, larger */}
                    {featuredPost && (
                      <button
                        onClick={() => openArticle(featuredPost.slug)}
                        className="group text-left w-full"
                      >
                        <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden mb-3">
                          {featuredPost.coverImage ? (
                            <SmartImage
                              src={featuredPost.coverImage}
                              alt={featuredPost.title}
                              containerClassName="h-full w-full"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Newspaper className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                            </div>
                          )}
                        </div>
                        <h4 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-3 group-hover:text-primary transition-colors leading-snug">
                          {featuredPost.title}
                        </h4>
                        <div className="flex items-center gap-2.5 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(featuredPost.publishedAt)}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {featuredPost.views}
                          </span>
                        </div>
                      </button>
                    )}

                    {/* Compact posts — right column, list */}
                    <div className="space-y-3">
                      {compactPosts.map(post => (
                        <button
                          key={post.id}
                          onClick={() => openArticle(post.slug)}
                          className="group flex gap-3 w-full text-left"
                        >
                          <div className="h-16 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden flex-shrink-0">
                            {post.coverImage ? (
                              <SmartImage
                                src={post.coverImage}
                                alt={post.title}
                                containerClassName="h-full w-full"
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Newspaper className="h-5 w-5 text-zinc-300 dark:text-zinc-700" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                              {post.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                              <span className="flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatDate(post.publishedAt)}
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-2.5 w-2.5" /> {post.views}
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
                <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-800/60 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
                  <span>{posts.length} notícias recentes</span>
                  <button
                    onClick={seeAll}
                    className="flex items-center gap-1 hover:text-primary transition-colors font-semibold"
                  >
                    Ver todas <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
      </PopoverContent>
    </Popover>
  )
}

function MegaMenuSkeleton() {
  return (
    <div className="grid grid-cols-[1.1fr_1fr] gap-4">
      {/* Featured skeleton */}
      <div>
        <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-3" />
        <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-full animate-pulse" />
        <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-2/3 animate-pulse mt-1.5" />
        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2 animate-pulse mt-2.5" />
      </div>
      {/* Compact skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-3">
            <div className="h-16 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1 py-0.5">
              <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-full animate-pulse" />
              <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4 animate-pulse" />
              <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2 animate-pulse mt-1.5" />
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
