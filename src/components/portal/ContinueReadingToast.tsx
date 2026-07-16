'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Clock, X, ChevronRight } from 'lucide-react'

interface RelatedArticle {
  id: string
  title: string
  slug: string
  coverImage?: string | null
  category?: { name: string; color: string } | null
}

/**
 * Toast that appears after 30s of reading an article, suggesting related articles.
 * Closes automatically after 15s, or when user clicks X, or navigates away.
 */
export function ContinueReadingToast({ slug, category }: { slug: string; category?: string }) {
  const { setView } = useAppStore()
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [related, setRelated] = useState<RelatedArticle[]>([])
  const toastRef = useRef<HTMLDivElement>(null)

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => setVisible(false), 400)
  }

  // Fetch related articles and show toast after 30s
  useEffect(() => {
    if (!slug) return

    let toastTimer: ReturnType<typeof setTimeout> | undefined
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    let cancelled: boolean = false

    void (async () => {
      try {
        // Fetch related articles (from same category)
        const url = new URL('/api/posts', window.location.origin)
        url.searchParams.set('limit', '5')
        if (category) url.searchParams.set('categorySlug', category)
        const r = await fetch(url.toString())
        const d = await r.json()
        if (cancelled) return

        // Filter out the current article and pick 3
        const filtered = (d.posts || []).filter((p: any) => p.slug !== slug).slice(0, 3)
        if (filtered.length === 0) return

        setRelated(filtered)

        // Show toast after 30s of reading
        toastTimer = setTimeout(() => {
          if (!cancelled) {
            setVisible(true)
            // Auto-close after 15s
            closeTimer = setTimeout(() => {
              if (!cancelled) handleClose()
            }, 15000)
          }
        }, 30000)
      } catch {}
    })()

    return () => {
      cancelled = true
      clearTimeout(toastTimer)
      clearTimeout(closeTimer)
    }
  }, [slug])

  useEffect(() => {
    const root = document.documentElement
    const toastElement = toastRef.current
    if (!visible || !toastElement) {
      root.style.removeProperty('--portal-continue-reading-offset')
      return
    }

    const updateOffset = () => {
      root.style.setProperty('--portal-continue-reading-offset', `${Math.ceil(toastElement.getBoundingClientRect().height)}px`)
    }
    updateOffset()
    const observer = new ResizeObserver(updateOffset)
    observer.observe(toastElement)
    window.addEventListener('resize', updateOffset)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateOffset)
      root.style.removeProperty('--portal-continue-reading-offset')
    }
  }, [visible])

  const handleOpen = (articleSlug: string) => {
    handleClose()
    setTimeout(() => {
      setView({ name: 'article', slug: articleSlug })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 200)
  }

  if (!visible || related.length === 0) return null

  return (
    <div
      ref={toastRef}
      className={`portal-continue-reading fixed left-4 right-4 z-50 w-auto ${closing ? 'slide-out-right' : 'slide-in-right'} sm:left-auto sm:w-80`}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-primary text-white">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Continue lendo</span>
          </div>
          <button
            onClick={handleClose}
            className="hover:bg-white/20 p-1 rounded transition-colors"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Related articles list */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
          {related.map(article => (
            <button
              key={article.id}
              onClick={() => handleOpen(article.slug)}
              className="w-full flex items-center gap-3 p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left group"
            >
              {/* Thumbnail */}
              {article.coverImage ? (
                <img
                  src={article.coverImage}
                  alt=""
                  className="h-12 w-16 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-12 w-16 rounded bg-zinc-100 dark:bg-zinc-800 flex-shrink-0" />
              )}

              {/* Title + category */}
              <div className="flex-1 min-w-0">
                {article.category && (
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-0.5">
                    {article.category.name}
                  </div>
                )}
                <div className="text-xs text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                  {article.title}
                </div>
              </div>

              <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-primary flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
