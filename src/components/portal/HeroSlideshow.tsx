'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Clock, Eye, Flame, ArrowRight } from 'lucide-react'
import { SmartImage } from '@/components/ui/smart-image'

interface SlidePost {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  excerpt?: string | null
  coverImage?: string | null
  publishedAt: string
  views: number
  breaking?: boolean
  category: { id: string; slug: string; name: string; color: string }
  author?: { id: string; name: string; avatar?: string | null }
}

interface SlideConfig {
  isEnabled: boolean
  postCount: number
  autoPlay: boolean
  delayMs: number
  designType: string // overlay | split | minimal | cards
  showDots: boolean
  showArrows: boolean
  showExcerpt: boolean
  showCategory: boolean
  showAuthor: boolean
  heightPreset: string // short | medium | tall
  filterType: string // featured | latest | breaking | all
}

interface Props {
  config: SlideConfig | null
  posts: SlidePost[]
  categoryId?: string
}

const HEIGHT_MAP: Record<string, string> = {
  short: 'h-[280px] sm:h-[340px] lg:h-[380px]',
  medium: 'h-[360px] sm:h-[440px] lg:h-[500px]',
  tall: 'h-[420px] sm:h-[520px] lg:h-[580px]',
}

// Deterministic gradient fallback per category color — used as the SmartImage fallbackSrc
// when a post has no coverImage or the coverImage URL fails to load. This ensures the slide
// NEVER shows a blank gray box — every slide gets a colored gradient tied to its category.
const COLOR_GRADIENTS: Record<string, string> = {
  blue: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
  red: 'linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)',
  green: 'linear-gradient(135deg, #14532d 0%, #22c55e 100%)',
  amber: 'linear-gradient(135deg, #78350f 0%, #f59e0b 100%)',
  purple: 'linear-gradient(135deg, #581c87 0%, #a855f7 100%)',
  pink: 'linear-gradient(135deg, #831843 0%, #ec4899 100%)',
  rose: 'linear-gradient(135deg, #881337 0%, #f43f5e 100%)',
  orange: 'linear-gradient(135deg, #7c2d12 0%, #f97316 100%)',
  teal: 'linear-gradient(135deg, #134e4a 0%, #14b8a6 100%)',
  cyan: 'linear-gradient(135deg, #164e63 0%, #06b6d4 100%)',
  indigo: 'linear-gradient(135deg, #312e81 0%, #6366f1 100%)',
  emerald: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)',
  slate: 'linear-gradient(135deg, #1e293b 0%, #64748b 100%)',
  zinc: 'linear-gradient(135deg, #27272a 0%, #71717a 100%)',
}

function makeGradientSvg(color: string): string {
  const gradient = COLOR_GRADIENTS[color] || COLOR_GRADIENTS.slate
  // Parse the two hex colors from the gradient string
  const hexMatch = gradient.match(/#([0-9a-fA-F]{6})/g)
  const c1 = hexMatch?.[0] || '#1e293b'
  const c2 = hexMatch?.[1] || '#64748b'
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#g)"/>
</svg>
`)}`
}

export function HeroSlideshow({ config, posts, categoryId }: Props) {
  const { setView } = useAppStore()

  // Bug 3 fix: if config is null, use defaults instead of returning null
  const effectiveConfig = useMemo(() => config || ({
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
  } as SlideConfig), [config])

  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preloadedRef = useRef<Set<string>>(new Set())

  // Use postCount from config (cap at posts.length)
  const effectivePostCount = effectiveConfig.postCount || 5
  const slides = useMemo(
    () => posts.slice(0, Math.max(1, effectivePostCount)),
    [posts, effectivePostCount]
  )

  // === Preload all slide images on mount + preload next image ahead of time ===
  // This is the key fix for "slide images don't show without refresh" — we aggressively
  // preload every image URL on mount so by the time the user sees slide N, image N+1 is
  // already in the browser cache.
  useEffect(() => {
    if (!slides.length) return
    slides.forEach((slide) => {
      const url = slide.coverImage
      if (url && !preloadedRef.current.has(url)) {
        preloadedRef.current.add(url)
        const img = new window.Image()
        img.src = url
        // img.onload / img.onerror handlers not strictly needed — the cache is populated
        // by the request itself, which is what we want.
      }
    })
  }, [slides])

  const goNext = useCallback(() => {
    setDirection(1)
    setCurrent(prev => (prev + 1) % slides.length)
  }, [slides.length])

  const goPrev = useCallback(() => {
    setDirection(-1)
    setCurrent(prev => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])

  const goTo = useCallback((idx: number) => {
    setDirection(idx > current ? 1 : -1)
    setCurrent(idx)
  }, [current])

  // Autoplay
  useEffect(() => {
    if (!effectiveConfig.autoPlay || isPaused || slides.length <= 1) return
    timerRef.current = setTimeout(goNext, effectiveConfig.delayMs || 5000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [current, isPaused, effectiveConfig, goNext, slides.length])

  if (!effectiveConfig.isEnabled || slides.length === 0) return null

  const heightClass = HEIGHT_MAP[effectiveConfig.heightPreset] || HEIGHT_MAP.tall
  const post = slides[current]
  if (!post) return null

  const openPost = (slug: string) => {
    setView({ name: 'article', slug })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(post.publishedAt))

  // Deterministic fallback per slide based on category color
  const getFallback = (slide: SlidePost) => makeGradientSvg(slide.category?.color || 'slate')

  // === DESIGN: OVERLAY ===
  if (effectiveConfig.designType === 'overlay') {
    return (
      <div
        className={cn('relative w-full overflow-hidden rounded-2xl bg-zinc-900 group', heightClass)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Slides — render ALL slides stacked, toggle visibility with opacity/scale.
            This way image elements stay mounted (cached) and transitions are smooth.
            instantOn ensures the image is visible from first paint (no opacity-0 gap). */}
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={cn(
              'absolute inset-0 transition-all duration-700 ease-out',
              idx === current ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
            )}
            onClick={() => openPost(slide.slug)}
          >
            <SmartImage
              src={slide.coverImage}
              alt={slide.title}
              containerClassName="absolute inset-0"
              className="w-full h-full object-cover cursor-pointer"
              loading="eager"
              instantOn
              fetchPriority={idx === 0 ? 'high' : 'auto'}
              fallbackSrc={getFallback(slide)}
              silent
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
          </div>
        ))}

        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7 lg:p-9 pointer-events-none">
          <div key={current} className="animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              {effectiveConfig.showCategory && post.category && (
                <span className={cn('text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full', `cat-${post.category.color || 'slate'}`)}>
                  {post.category.name}
                </span>
              )}
              {post.breaking && (
                <span className="inline-flex items-center gap-1 bg-primary text-white text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full">
                  <Flame className="h-3 w-3" /> Urgente
                </span>
              )}
            </div>
            <h2
              className="text-white text-2xl sm:text-3xl lg:text-[2.5rem] leading-[1.15] mb-2 cursor-pointer pointer-events-auto hover:text-blue-100 transition-colors"
              style={{ fontWeight: 500, letterSpacing: '-0.02em' }}
              onClick={() => openPost(post.slug)}
            >
              {post.title}
            </h2>
            {effectiveConfig.showExcerpt && post.subtitle && (
              <p className="text-zinc-300 line-clamp-2 text-sm sm:text-base font-light mb-3">{post.subtitle}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-zinc-400 font-light">
              <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {dateStr}</span>
              <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {post.views}</span>
              {effectiveConfig.showAuthor && post.author && <span>por <span className="text-zinc-200">{post.author.name}</span></span>}
            </div>
          </div>
        </div>

        {/* Arrows */}
        {effectiveConfig.showArrows && slides.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
              aria-label="Próximo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dots */}
        {effectiveConfig.showDots && slides.length > 1 && (
          <div className="absolute bottom-3 right-5 flex items-center gap-1.5 z-20">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className={cn(
                  'rounded-full transition-all duration-300',
                  idx === current ? 'w-6 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'
                )}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Progress bar */}
        {effectiveConfig.autoPlay && !isPaused && slides.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20">
            <div
              key={current}
              className="h-full bg-primary"
              style={{ animation: `progressBar ${effectiveConfig.delayMs}ms linear` }}
            />
          </div>
        )}
      </div>
    )
  }

  // === DESIGN: SPLIT ===
  if (effectiveConfig.designType === 'split') {
    return (
      <div
        className={cn('relative w-full overflow-hidden rounded-2xl bg-white border border-zinc-100 group', heightClass)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="flex h-full">
          {/* Image side */}
          <div className="w-1/2 relative overflow-hidden flex-shrink-0">
            {slides.map((slide, idx) => (
              <SmartImage
                key={slide.id}
                src={slide.coverImage}
                alt={slide.title}
                containerClassName="absolute inset-0"
                className={cn(
                  'w-full h-full object-cover transition-all duration-700',
                  idx === current ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                )}
                loading="eager"
                instantOn
                fetchPriority={idx === 0 ? 'high' : 'auto'}
                fallbackSrc={getFallback(slide)}
                silent
              />
            ))}
          </div>

          {/* Content side */}
          <div className="w-1/2 flex flex-col justify-center p-6 sm:p-8 lg:p-10 relative overflow-hidden">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                className={cn(
                  'absolute inset-0 flex flex-col justify-center p-6 sm:p-8 lg:p-10 transition-all duration-500',
                  idx === current ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  {effectiveConfig.showCategory && slide.category && (
                    <span className={cn('text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full', `cat-${slide.category.color || 'slate'}`)}>
                      {slide.category.name}
                    </span>
                  )}
                </div>
                <h2
                  className="text-zinc-900 text-2xl sm:text-3xl lg:text-4xl leading-tight mb-3 cursor-pointer hover:text-primary transition-colors"
                  style={{ fontWeight: 500, letterSpacing: '-0.02em' }}
                  onClick={() => openPost(slide.slug)}
                >
                  {slide.title}
                </h2>
                {effectiveConfig.showExcerpt && slide.subtitle && (
                  <p className="text-zinc-500 line-clamp-3 text-sm sm:text-base font-light mb-4">{slide.subtitle}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-zinc-400 font-light mb-4">
                  <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(slide.publishedAt))}</span>
                  <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {slide.views}</span>
                </div>
                <button
                  onClick={() => openPost(slide.slug)}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:gap-2.5 transition-all"
                  style={{ fontWeight: 500 }}
                >
                  Ler matéria <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Arrows */}
        {effectiveConfig.showArrows && slides.length > 1 && (
          <>
            <button onClick={goPrev} className="absolute left-3 bottom-4 z-20 h-9 w-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-all" aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={goNext} className="absolute left-14 bottom-4 z-20 h-9 w-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-all" aria-label="Próximo">
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Dots */}
        {effectiveConfig.showDots && slides.length > 1 && (
          <div className="absolute bottom-4 right-6 flex items-center gap-1.5 z-20">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className={cn(
                  'rounded-full transition-all duration-300',
                  idx === current ? 'w-6 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-zinc-300 hover:bg-zinc-400'
                )}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // === DESIGN: MINIMAL ===
  if (effectiveConfig.designType === 'minimal') {
    return (
      <div
        className={cn('relative w-full overflow-hidden rounded-2xl bg-zinc-50 group', heightClass)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={cn(
              'absolute inset-0 flex items-center transition-all duration-600 ease-out',
              idx === current ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12 pointer-events-none'
            )}
          >
            <div className="flex w-full items-center gap-6 sm:gap-10 p-6 sm:p-10">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  {effectiveConfig.showCategory && slide.category && (
                    <span className={cn('text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full', `cat-${slide.category.color || 'slate'}`)}>
                      {slide.category.name}
                    </span>
                  )}
                  {slide.breaking && (
                    <span className="inline-flex items-center gap-1 bg-primary text-white text-[11px] font-medium uppercase px-2.5 py-1 rounded-full">
                      <Flame className="h-3 w-3" /> Urgente
                    </span>
                  )}
                </div>
                <h2
                  className="text-zinc-900 text-3xl sm:text-4xl lg:text-5xl leading-[1.1] mb-3 cursor-pointer hover:text-primary transition-colors"
                  style={{ fontWeight: 500, letterSpacing: '-0.03em' }}
                  onClick={() => openPost(slide.slug)}
                >
                  {slide.title}
                </h2>
                {effectiveConfig.showExcerpt && slide.subtitle && (
                  <p className="text-zinc-500 line-clamp-2 text-base sm:text-lg font-light mb-4">{slide.subtitle}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-zinc-400 font-light">
                  <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(slide.publishedAt))}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {slide.views}</span>
                </div>
              </div>
              <div className="hidden sm:block w-2/5 h-full rounded-xl overflow-hidden flex-shrink-0">
                <SmartImage
                  src={slide.coverImage}
                  alt={slide.title}
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                  loading="eager"
                  instantOn
                  fetchPriority={idx === 0 ? 'high' : 'auto'}
                  fallbackSrc={getFallback(slide)}
                  silent
                />
              </div>
            </div>
          </div>
        ))}

        {/* Arrows */}
        {effectiveConfig.showArrows && slides.length > 1 && (
          <>
            <button onClick={goPrev} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-white shadow-soft-md text-zinc-700 flex items-center justify-center hover:shadow-lg transition-all opacity-0 group-hover:opacity-100" aria-label="Anterior">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={goNext} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-white shadow-soft-md text-zinc-700 flex items-center justify-center hover:shadow-lg transition-all opacity-0 group-hover:opacity-100" aria-label="Próximo">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dots */}
        {effectiveConfig.showDots && slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className={cn(
                  'rounded-full transition-all duration-300',
                  idx === current ? 'w-8 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-zinc-300 hover:bg-zinc-400'
                )}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // === DESIGN: CARDS ===
  if (effectiveConfig.designType === 'cards') {
    return (
      <div
        className={cn('relative w-full overflow-hidden group', heightClass)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="flex h-full items-center">
          {slides.map((slide, idx) => {
            const offset = idx - current
            // Normalize offset for wrap-around (so the "next" card is always on the right)
            const normalizedOffset = slides.length > 1
              ? ((offset + slides.length) % slides.length) <= slides.length / 2
                ? ((offset + slides.length) % slides.length)
                : ((offset + slides.length) % slides.length) - slides.length
              : 0
            const isActive = normalizedOffset === 0
            const isVisible = Math.abs(normalizedOffset) <= 2
            return (
              <div
                key={slide.id}
                className={cn(
                  'absolute transition-all duration-600 ease-out rounded-2xl overflow-hidden cursor-pointer',
                  isActive ? 'z-30' : 'z-10',
                  !isVisible && 'opacity-0 pointer-events-none'
                )}
                style={{
                  transform: `translateX(${normalizedOffset * 60}%) scale(${isActive ? 1 : 0.78})`,
                  opacity: isVisible ? (isActive ? 1 : 0.4) : 0,
                  width: '70%',
                  left: '15%',
                  top: 0,
                  height: '100%',
                }}
                onClick={() => isActive ? openPost(slide.slug) : goTo(idx)}
              >
                <SmartImage
                  src={slide.coverImage}
                  alt={slide.title}
                  containerClassName="absolute inset-0"
                  className="w-full h-full object-cover"
                  loading="eager"
                  instantOn
                  fetchPriority={isActive ? 'high' : 'auto'}
                  fallbackSrc={getFallback(slide)}
                  silent
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                {isActive && (
                  <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      {effectiveConfig.showCategory && slide.category && (
                        <span className={cn('text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full', `cat-${slide.category.color || 'slate'}`)}>
                          {slide.category.name}
                        </span>
                      )}
                    </div>
                    <h2 className="text-white text-2xl sm:text-3xl leading-tight mb-2" style={{ fontWeight: 500, letterSpacing: '-0.02em' }}>
                      {slide.title}
                    </h2>
                    {effectiveConfig.showExcerpt && slide.subtitle && (
                      <p className="text-zinc-300 line-clamp-2 text-sm font-light">{slide.subtitle}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Arrows */}
        {effectiveConfig.showArrows && slides.length > 1 && (
          <>
            <button onClick={goPrev} className="absolute left-3 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-white/90 backdrop-blur-sm shadow-soft-md text-zinc-700 flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover:opacity-100" aria-label="Anterior">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={goNext} className="absolute right-3 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-white/90 backdrop-blur-sm shadow-soft-md text-zinc-700 flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover:opacity-100" aria-label="Próximo">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dots */}
        {effectiveConfig.showDots && slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-40">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className={cn(
                  'rounded-full transition-all duration-300',
                  idx === current ? 'w-8 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'
                )}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}
