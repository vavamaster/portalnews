'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SmartImage } from '@/components/ui/smart-image'
import { Play, MapPin, ExternalLink, ChevronRight } from 'lucide-react'

interface SponsoredAd {
  id: string
  title: string
  subtitle?: string | null
  logoUrl?: string | null
  imageUrl?: string | null
  videoUrl?: string | null
  linkUrl?: string | null
  ctaText?: string | null
  trackingToken: string
}

interface SponsorData {
  sponsored: boolean
  mode?: string
  transitionType?: string
  transitionMs?: number
  bannerWidth?: number
  bannerHeight?: number
  ads: SponsoredAd[]
  landingPageSlug?: string | null
}

interface Props {
  categoryId: string
  /** "block" = full-width banner (default). "inline" = compact banner for inline use next to a title. */
  variant?: 'block' | 'inline'
}

// SponsoredCategoryBanner — shows Enterprise ads at the top of a category page.
// Rotates between ads (if mode=ROTATING) using the configured transition.
// Tracks impressions (server-side, in /api/sponsored-categories/serve) and clicks.
export function SponsoredCategoryBanner({ categoryId, variant = 'block' }: Props) {
  const router = useRouter()
  const [data, setData] = useState<SponsorData | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTrackedAdRef = useRef<string | null>(null)
  const bannerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/sponsored-categories/serve?categoryId=${encodeURIComponent(categoryId)}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d && typeof d.sponsored === 'boolean') {
          setCurrentIdx(0)
          lastTrackedAdRef.current = null
          setData(d)
        }
      })
      .catch(() => { if (!cancelled) setData({ sponsored: false, ads: [] }) })
    return () => { cancelled = true }
  }, [categoryId])

  // Rotate ads in ROTATING mode
  useEffect(() => {
    if (!data?.sponsored || data.mode !== 'ROTATING' || data.ads.length <= 1) return
    const ms = data.transitionMs || 5000
    const transitionType = data.transitionType || 'FADE'
    timerRef.current = setInterval(() => {
      if (transitionType === 'NONE') {
        setCurrentIdx(idx => (idx + 1) % data.ads.length)
        return
      }
      setTransitioning(true)
      transitionTimerRef.current = setTimeout(() => {
        setCurrentIdx(idx => (idx + 1) % data.ads.length)
        setTransitioning(false)
      }, 300)
    }, ms)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    }
  }, [data])

  const ad = data?.ads?.[currentIdx]

  // Count only a creative that actually becomes visible. The signed token also
  // prevents arbitrary requests and duplicate processing on the server.
  useEffect(() => {
    if (!ad?.id || !ad.trackingToken || lastTrackedAdRef.current === ad.trackingToken) return

    const track = () => {
      if (lastTrackedAdRef.current === ad.trackingToken) return
      lastTrackedAdRef.current = ad.trackingToken
      void fetch('/api/sponsored-categories/impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: ad.id, token: ad.trackingToken }),
        keepalive: true,
      }).catch(() => {})
    }

    const element = bannerRef.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      track()
      return
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.35)) {
        track()
        observer.disconnect()
      }
    }, { threshold: [0.35] })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ad?.id, ad?.trackingToken])

  // Click handler — tracks the click and opens the URL
  const handleClick = (ad: SponsoredAd) => {
    if (!ad.linkUrl) return
    void fetch('/api/sponsored-categories/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId: ad.id, token: ad.trackingToken }),
      keepalive: true,
    }).catch(() => {})
    // Internal link → navigate via router; external → open in new tab
    if (ad.linkUrl.startsWith('/') || ad.linkUrl.startsWith('?')) {
      router.push(ad.linkUrl)
    } else {
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer')
    }
  }

  if (!data || !data.sponsored || data.ads.length === 0) {
    // No active sponsor — show a discreet "Anuncie aqui" placeholder
    if (variant === 'inline') {
      return (
        <a
          href="/contato"
          onClick={(e) => { e.preventDefault(); router.push('/contato') }}
          className="flex items-center justify-center bg-zinc-50 border border-dashed border-zinc-300 rounded-lg px-4 py-2 text-center hover:bg-zinc-100 transition-colors group h-full min-h-[60px]"
        >
          <div>
            <div className="text-[9px] text-zinc-400 uppercase tracking-wider">Espaço publicitário</div>
            <div className="text-[11px] text-zinc-600 group-hover:text-zinc-900 transition-colors" style={{ fontWeight: 500 }}>
              Anuncie aqui →
            </div>
          </div>
        </a>
      )
    }
    return (
      <div className="mb-6">
        <a
          href="/contato"
          onClick={(e) => { e.preventDefault(); router.push('/contato') }}
          className="block bg-gradient-to-r from-zinc-50 to-zinc-100 border border-dashed border-zinc-300 rounded-lg py-6 px-4 text-center hover:from-zinc-100 hover:to-zinc-200 transition-colors group"
        >
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Espaço publicitário</div>
          <div className="text-sm text-zinc-600 group-hover:text-zinc-900 transition-colors" style={{ fontWeight: 500 }}>
            Anuncie nesta categoria →
          </div>
        </a>
      </div>
    )
  }

  if (!ad) return null

  // Extract YouTube video ID for embed
  const getYoutubeId = (url: string): string | null => {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/)
    return m ? m[1] : null
  }
  const ytId = ad.videoUrl ? getYoutubeId(ad.videoUrl) : null

  // === INLINE VARIANT (compact, sits next to the category title) ===
  if (variant === 'inline') {
    return (
      <div
        ref={bannerRef}
        className={cn(
          'relative bg-white border-2 rounded-lg overflow-hidden group transition-all h-full min-h-[60px] flex',
          data.mode === 'EXCLUSIVE' ? 'border-amber-300' : 'border-zinc-200',
          ad.linkUrl ? 'cursor-pointer' : 'cursor-default',
        )}
        onClick={ad.linkUrl ? () => handleClick(ad) : undefined}
      >
        {/* Image (if available) — fills left side */}
        {ad.imageUrl && (
          <div className="relative w-24 sm:w-32 flex-shrink-0 overflow-hidden">
            <SmartImage
              src={ad.imageUrl}
              alt={ad.title}
              containerClassName="absolute inset-0"
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        )}
        {/* Content */}
        <div className="flex-1 min-w-0 p-2 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[8px] bg-black/70 text-white px-1 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
              {data.mode === 'EXCLUSIVE' ? 'Exclusivo' : 'Patroc.'}
            </span>
            {ad.logoUrl && (
              <img src={ad.logoUrl} alt="" className="h-3 w-auto rounded" />
            )}
          </div>
          <div className="text-zinc-900 text-xs sm:text-sm font-semibold line-clamp-1">{ad.title}</div>
          {ad.subtitle && (
            <div className="text-zinc-500 text-[10px] sm:text-xs line-clamp-1">{ad.subtitle}</div>
          )}
          {ad.ctaText && (
            <div className="text-primary text-[10px] sm:text-xs mt-0.5 flex items-center gap-0.5" style={{ fontWeight: 600 }}>
              {ad.ctaText} <ChevronRight className="h-2.5 w-2.5" />
            </div>
          )}
        </div>
        {/* Landing page link */}
        {data.landingPageSlug && (
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/empresa/${encodeURIComponent(data.landingPageSlug!)}`) }}
            className="flex-shrink-0 self-center pr-2 text-primary hover:underline"
            title="Ver página da empresa"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }

  // === BLOCK VARIANT (default, full-width banner) ===
  return (
    <div className="mb-6">
      <div
        ref={bannerRef}
        className={cn(
          'relative bg-white border-2 border-zinc-200 rounded-xl overflow-hidden group transition-all',
          data.mode === 'EXCLUSIVE' ? 'border-amber-300 shadow-md' : '',
        )}
      >
        {/* "Patrocinado" label */}
        <div className="absolute top-2 left-2 z-10 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
          {data.mode === 'EXCLUSIVE' ? 'Patrocinador exclusivo' : 'Patrocinado'}
        </div>

        {/* Rotating counter (if multiple ads) */}
        {data.ads.length > 1 && (
          <div className="absolute top-2 right-2 z-10 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
            {currentIdx + 1}/{data.ads.length}
          </div>
        )}

        {/* Banner content */}
        <div
          className={cn(
            data.transitionType === 'NONE' ? '' : 'transition-all duration-300',
            transitioning && data.transitionType === 'SLIDE' ? 'opacity-0 translate-x-3' : '',
            transitioning && data.transitionType !== 'SLIDE' ? 'opacity-0' : 'opacity-100 translate-x-0',
          )}
        >
          {/* Image-based banner */}
          {ad.imageUrl ? (
            <button
              onClick={() => handleClick(ad)}
              className={cn('block w-full text-left', ad.linkUrl ? 'cursor-pointer' : 'cursor-default')}
            >
              <div className="relative" style={{ aspectRatio: `${data.bannerWidth || 1200} / ${data.bannerHeight || 200}` }}>
                <SmartImage
                  src={ad.imageUrl}
                  alt={ad.title}
                  containerClassName="absolute inset-0"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="eager"
                />
                {/* Overlay with title + CTA */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent flex items-center">
                  <div className="p-4 sm:p-6 max-w-2xl">
                    {ad.logoUrl && (
                      <img src={ad.logoUrl} alt={ad.title} className="h-8 w-auto mb-2 rounded bg-white/10" />
                    )}
                    <div className="text-white text-base sm:text-xl" style={{ fontWeight: 600 }}>{ad.title}</div>
                    {ad.subtitle && (
                      <div className="text-white/80 text-xs sm:text-sm mt-1 line-clamp-2">{ad.subtitle}</div>
                    )}
                    {ad.ctaText && (
                      <div className="inline-flex items-center gap-1 mt-3 bg-white text-zinc-900 px-3 py-1.5 rounded text-xs sm:text-sm" style={{ fontWeight: 600 }}>
                        {ad.ctaText} <ChevronRight className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ) : ytId ? (
            /* Video-based banner */
            <button
              onClick={() => handleClick(ad)}
              className={cn('block w-full text-left relative', ad.linkUrl ? 'cursor-pointer' : 'cursor-default')}
              style={{ aspectRatio: `${data.bannerWidth || 1200} / ${data.bannerHeight || 200}` }}
            >
              <img
                src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                alt={ad.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="bg-red-600 text-white p-4 rounded-full">
                  <Play className="h-6 w-6" />
                </div>
              </div>
              <div className="absolute bottom-2 left-2 text-white text-sm" style={{ fontWeight: 600 }}>{ad.title}</div>
            </button>
          ) : (
            /* Text-only banner */
            <button
              onClick={() => handleClick(ad)}
              className={cn('block w-full text-left p-4 sm:p-6', ad.linkUrl ? 'cursor-pointer' : 'cursor-default')}
            >
              <div className="flex items-center gap-3">
                {ad.logoUrl && (
                  <img src={ad.logoUrl} alt={ad.title} className="h-10 w-auto rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-zinc-900 text-base sm:text-lg" style={{ fontWeight: 600 }}>{ad.title}</div>
                  {ad.subtitle && (
                    <div className="text-zinc-600 text-xs sm:text-sm line-clamp-2">{ad.subtitle}</div>
                  )}
                </div>
                {ad.ctaText && (
                  <div className="inline-flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded text-xs sm:text-sm" style={{ fontWeight: 600 }}>
                    {ad.ctaText} <ChevronRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            </button>
          )}
        </div>

        {/* Landing page link (if exclusive with landing page) */}
        {data.landingPageSlug && (
          <div className="bg-zinc-50 border-t border-zinc-100 px-3 py-1.5 text-xs text-zinc-500 flex items-center justify-between">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Página da empresa</span>
            <button
              onClick={() => router.push(`/empresa/${encodeURIComponent(data.landingPageSlug!)}`)}
              className="text-primary hover:underline flex items-center gap-1"
            >
              Ver página <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Rotation dots (if multiple ads) */}
      {data.ads.length > 1 && (
        <div className="flex justify-center gap-1 mt-2">
          {data.ads.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
                if (data.transitionType === 'NONE') {
                  setCurrentIdx(i)
                  return
                }
                setTransitioning(true)
                transitionTimerRef.current = setTimeout(() => { setCurrentIdx(i); setTransitioning(false) }, 200)
              }}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === currentIdx ? 'w-6 bg-zinc-900' : 'w-1.5 bg-zinc-300 hover:bg-zinc-400'
              )}
              aria-label={`Anúncio ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
