'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { ArrowRight, Clock, Eye } from 'lucide-react'

interface MegaMenuProps {
  category: { id: string; slug: string; name: string; color?: string | null; description?: string | null }
  children: React.ReactNode
}

interface MegaPost {
  id: string
  title: string
  slug: string
  coverImage: string | null
  publishedAt: string | null
  views: number
}

/**
 * Mega-menu that appears on hover over a category in the navigation.
 * Shows 5 most recent posts from that category with thumbnails.
 */
export function MegaMenu({ category, children }: MegaMenuProps) {
  const { setView } = useAppStore()
  const [open, setOpen] = useState(false)
  const [posts, setPosts] = useState<MegaPost[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchedRef = useRef(false)

  // Fetch posts when menu opens for the first time
  useEffect(() => {
    if (!open || fetchedRef.current) return
    fetchedRef.current = true
    setLoading(true)
    void (async () => {
      try {
        const r = await fetch(`/api/posts?categorySlug=${category.slug}&limit=5&status=PUBLISHED`)
        const d = await r.json()
        setPosts(d.posts || [])
      } catch {} finally {
        setLoading(false)
      }
    })()
  }, [open, category.slug])

  // Debounced hover handlers — 300ms delay before opening/closing
  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(true), 300)
  }
  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(false), 200)
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

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

  return (
    <div
      className="relative h-full"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0 w-[480px] max-w-[calc(100vw-2rem)] z-50 mega-menu-enter">
          <div className="bg-white dark:bg-zinc-900 rounded-b-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            {/* Header */}
            <div className={cn('flex items-center justify-between px-4 py-2.5 text-white', `bg-${category.color || 'slate'}-500`)}>
              <div>
                <div className="text-sm font-bold">{category.name}</div>
                {category.description && (
                  <div className="text-[10px] text-white/80 line-clamp-1">{category.description}</div>
                )}
              </div>
              <button
                onClick={seeAll}
                className="text-[11px] bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors flex items-center gap-1"
              >
                Ver tudo <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </div>

            {/* Posts list */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="h-12 w-16 bg-zinc-100 dark:bg-zinc-800 rounded flex-shrink-0" />
                      <div className="flex-1 space-y-1.5 py-1">
                        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-full" />
                        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  Nenhuma notícia nesta categoria ainda.
                </div>
              ) : (
                posts.map(post => (
                  <button
                    key={post.id}
                    onClick={() => openArticle(post.slug)}
                    className="w-full flex gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left group border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                  >
                    {post.coverImage ? (
                      <img
                        src={post.coverImage}
                        alt=""
                        className="h-12 w-16 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-16 bg-zinc-100 dark:bg-zinc-800 rounded flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-primary transition-colors leading-snug font-medium">
                        {post.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(post.publishedAt || Date.now()))}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-2.5 w-2.5" /> {post.views}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
