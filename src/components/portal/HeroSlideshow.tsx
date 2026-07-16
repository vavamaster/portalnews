'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { cn, formatDate } from '@/lib/utils'
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

const SPLIT_HEIGHT_MAP: Record<string, string> = {
  short: 'h-[500px] sm:h-[340px] lg:h-[380px]',
  medium: 'h-[560px] sm:h-[440px] lg:h-[500px]',
  tall: 'h-[620px] sm:h-[520px] lg:h-[580px]',
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preloadedRef = useRef<Set<string>>(new Set())
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const swipedRef = useRef(false)

  // Use postCount from config (cap at posts.length)
  const effectivePostCount = effectiveConfig.postCount || 5
  const slides = useMemo(
    () => posts.slice(0, Math.max(1, effectivePostCount)),
    [posts, effectivePostCount]
  )

  const goNext = useCallback(() => {
    setCurrent(prev => (prev + 1) % slides.length)
  }, [slides.length])

  const goPrev = useCallback(() => {
    setCurrent(prev => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])

  const goTo = useCallback((idx: number) => {
    setCurrent(idx)
  }, [])

  // Keep only the current and adjacent slides warm. The previous implementation
  // downloaded every banner immediately, which was expensive on mobile networks.
  useEffect(() => {
    if (!slides.length) return
    const adjacent = [
      current,
      (current + 1) % slides.length,
      (current - 1 + slides.length) % slides.length,
    ]
    adjacent.forEach((idx) => {
      const url = slides[idx]?.coverImage
      if (url && !preloadedRef.current.has(url)) {
        preloadedRef.current.add(url)
        const img = new window.Image()
        img.src = url
      }
    })
  }, [current, slides])

  const circularDistance = useCallback((idx: number) => {
    const direct = Math.abs(idx - current)
    return Math.min(direct, slides.length - direct)
  }, [current, slides.length])

  const imageSrcFor = useCallback((slide: SlidePost, idx: number) => {
    const renderDistance = effectiveConfig.designType === 'cards' ? 2 : 1
    return circularDistance(idx) <= renderDistance ? slide.coverImage : null
  }, [circularDistance, effectiveConfig.designType])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    setIsPaused(true)
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current
    const touch = e.changedTouches[0]
    touchStartRef.current = null
    setIsPaused(false)
    if (!start || !touch || slides.length <= 1) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return

    swipedRef.current = true
    if (deltaX < 0) goNext()
    else goPrev()
    window.setTimeout(() => { swipedRef.current = false }, 80)
  }, [goNext, goPrev, slides.length])

  const suppressClickAfterSwipe = useCallback((e: React.MouseEvent) => {
    if (!swipedRef.current) return
    e.preventDefault()
    e.stopPropagation()
  }, [])

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

  const dateStr = formatDate(post.publishedAt, 'datetime')

  // Deterministic fallback per slide based on category color
  const getFallback = (slide: SlidePost) => makeGradientSvg(slide.category?.color || 'slate')

  // === DESIGN: OVERLAY ===
  if (effectiveConfig.designType === 'overlay') {
    return (
      <div
        className={cn('relative w-full overflow-hidden rounded-2xl bg-zinc-900 group', heightClass)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClickCapture={suppressClickAfterSwipe}
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
              src={imageSrcFor(slide, idx)}
              alt={slide.title}
              containerClassName="absolute inset-0"
              className="w-full h-full object-cover cursor-pointer"
              loading={idx === current ? 'eager' : 'lazy'}
              instantOn
              fetchPriority={idx === current ? 'high' : 'auto'}
              fallbackSrc={getFallback(slide)}
              silent
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
          </div>
        ))}

        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-5 pr-12 sm:p-7 sm:pr-16 lg:p-9 lg:pr-20 pointer-events-none">
          <div key={current} className="animate-fade-in max-w-5xl">
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
              className="text-white text-2xl sm:text-3xl lg:text-[2.5rem] leading-[1.15] line-clamp-3 mb-2 cursor-pointer pointer-events-auto hover:text-blue-100 transition-colors"
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
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Próximo slide"
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
                  'relative rounded-full transition-all duration-300 after:absolute after:-inset-2',
                  idx === current ? 'w-6 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'
                )}
                aria-label={`Ir para o slide ${idx + 1}`}
                aria-current={idx === current ? 'true' : undefined}
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
    const splitHeightClass = SPLIT_HEIGHT_MAP[effectiveConfig.heightPreset] || SPLIT_HEIGHT_MAP.tall
    const isShortSplit = effectiveConfig.heightPreset === 'short'

    return (
      <div
        className={cn('relative w-full overflow-hidden rounded-2xl bg-white border border-zinc-100 group', splitHeightClass)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClickCapture={suppressClickAfterSwipe}
      >
        <div className="flex h-full flex-col sm:flex-row">
          {/* Image side */}
          <div className="h-[42%] w-full sm:h-full sm:w-1/2 relative overflow-hidden flex-shrink-0 bg-zinc-100">
            {slides.map((slide, idx) => (
              <SmartImage
                key={slide.id}
                src={imageSrcFor(slide, idx)}
                alt={slide.title}
                containerClassName={cn(
                  'absolute inset-0 transition-all duration-700 ease-out',
                  idx === current
                    ? 'z-10 opacity-100 scale-100'
                    : 'z-0 opacity-0 scale-105 pointer-events-none'
                )}
                className={cn(
                  'w-full h-full object-cover transition-transform duration-700 ease-out',
                  idx === current ? 'scale-100' : 'scale-105'
                )}
                loading={idx === current ? 'eager' : 'lazy'}
                instantOn
                fetchPriority={idx === current ? 'high' : 'auto'}
                fallbackSrc={getFallback(slide)}
                silent
              />
            ))}
          </div>

          {/* Content side */}
          <div className="h-[58%] w-full sm:h-full sm:w-1/2 relative overflow-hidden">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                className={cn(
                  'absolute inset-0 flex min-h-0 flex-col justify-center p-5 pb-12 sm:p-7 sm:pb-14 lg:p-10 lg:pb-16 transition-all duration-500',
                  idx === current ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'
                )}
              >
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  {effectiveConfig.showCategory && slide.category && (
                    <span className={cn('text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full', `cat-${slide.category.color || 'slate'}`)}>
                      {slide.category.name}
                    </span>
                  )}
                </div>
                <h2
                  className={cn(
                    'text-zinc-900 leading-tight mb-2 sm:mb-3 cursor-pointer hover:text-primary transition-colors',
                    isShortSplit
                      ? 'text-xl sm:text-2xl lg:text-3xl line-clamp-2'
                      : 'text-2xl sm:text-3xl lg:text-4xl line-clamp-3'
                  )}
                  style={{ fontWeight: 500, letterSpacing: '-0.02em' }}
                  onClick={() => openPost(slide.slug)}
                >
                  {slide.title}
                </h2>
                {effectiveConfig.showExcerpt && slide.subtitle && (
                  <p className={cn(
                    'text-zinc-500 text-sm sm:text-base font-light mb-3 sm:mb-4',
                    isShortSplit ? 'line-clamp-1' : 'line-clamp-2 lg:line-clamp-3'
                  )}>{slide.subtitle}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 font-light mb-3 sm:mb-4">
                  <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {formatDate(slide.publishedAt, 'short')}</span>
                  <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {slide.views}</span>
                  {effectiveConfig.showAuthor && slide.author && <span>por <span className="text-zinc-600">{slide.author.name}</span></span>}
                </div>
                <button
                  onClick={() => openPost(slide.slug)}
                  className="inline-flex w-fit items-center gap-1.5 text-sm text-primary hover:gap-2.5 transition-all"
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
            <button onClick={goPrev} className="absolute left-3 top-[21%] -translate-y-1/2 sm:top-auto sm:bottom-4 sm:translate-y-0 z-20 h-9 w-9 rounded-full bg-white/90 sm:bg-zinc-100 shadow-sm hover:bg-white sm:hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-all" aria-label="Slide anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={goNext} className="absolute right-3 top-[21%] -translate-y-1/2 sm:right-auto sm:left-14 sm:top-auto sm:bottom-4 sm:translate-y-0 z-20 h-9 w-9 rounded-full bg-white/90 sm:bg-zinc-100 shadow-sm hover:bg-white sm:hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-all" aria-label="Próximo slide">
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
                  'relative rounded-full transition-all duration-300 after:absolute after:-inset-2',
                  idx === current ? 'w-6 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-zinc-300 hover:bg-zinc-400'
                )}
                aria-label={`Ir para o slide ${idx + 1}`}
                aria-current={idx === current ? 'true' : undefined}
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClickCapture={suppressClickAfterSwipe}
      >
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={cn(
              'absolute inset-0 flex items-center transition-all duration-500 ease-out',
              idx === current ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12 pointer-events-none'
            )}
          >
            <div className="flex w-full items-center gap-6 sm:gap-10 px-12 py-6 sm:p-10">
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
                  className="text-zinc-900 text-2xl sm:text-4xl lg:text-5xl leading-[1.1] line-clamp-3 mb-3 cursor-pointer hover:text-primary transition-colors"
                  style={{ fontWeight: 500, letterSpacing: '-0.03em' }}
                  onClick={() => openPost(slide.slug)}
                >
                  {slide.title}
                </h2>
                {effectiveConfig.showExcerpt && slide.subtitle && (
                  <p className="text-zinc-500 line-clamp-2 text-base sm:text-lg font-light mb-4">{slide.subtitle}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-zinc-400 font-light">
                  <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {formatDate(slide.publishedAt, 'datetime')}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {slide.views}</span>
                  {effectiveConfig.showAuthor && slide.author && <span className="hidden lg:inline">por {slide.author.name}</span>}
                </div>
              </div>
              <div className="hidden sm:block w-2/5 h-full rounded-xl overflow-hidden flex-shrink-0">
                <SmartImage
                  src={imageSrcFor(slide, idx)}
                  alt={slide.title}
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                  loading={idx === current ? 'eager' : 'lazy'}
                  instantOn
                  fetchPriority={idx === current ? 'high' : 'auto'}
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
            <button onClick={goPrev} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-white shadow-soft-md text-zinc-700 flex items-center justify-center hover:shadow-lg transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100" aria-label="Slide anterior">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={goNext} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-white shadow-soft-md text-zinc-700 flex items-center justify-center hover:shadow-lg transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100" aria-label="Próximo slide">
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
                  'relative rounded-full transition-all duration-300 after:absolute after:-inset-2',
                  idx === current ? 'w-8 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-zinc-300 hover:bg-zinc-400'
                )}
                aria-label={`Ir para o slide ${idx + 1}`}
                aria-current={idx === current ? 'true' : undefined}
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClickCapture={suppressClickAfterSwipe}
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
                  'absolute w-[86%] left-[7%] sm:w-[70%] sm:left-[15%] transition-all duration-500 ease-out rounded-2xl overflow-hidden cursor-pointer',
                  isActive ? 'z-30' : 'z-10',
                  !isVisible && 'opacity-0 pointer-events-none'
                )}
                style={{
                  transform: `translateX(${normalizedOffset * 60}%) scale(${isActive ? 1 : 0.78})`,
                  opacity: isVisible ? (isActive ? 1 : 0.4) : 0,
                  top: 0,
                  height: '100%',
                }}
                onClick={() => isActive ? openPost(slide.slug) : goTo(idx)}
              >
                <SmartImage
                  src={imageSrcFor(slide, idx)}
                  alt={slide.title}
                  containerClassName="absolute inset-0"
                  className="w-full h-full object-cover"
                  loading={isActive ? 'eager' : 'lazy'}
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
                    <h2 className="text-white text-2xl sm:text-3xl leading-tight line-clamp-3 mb-2" style={{ fontWeight: 500, letterSpacing: '-0.02em' }}>
                      {slide.title}
                    </h2>
                    {effectiveConfig.showExcerpt && slide.subtitle && (
                      <p className="text-zinc-300 line-clamp-2 text-sm font-light">{slide.subtitle}</p>
                    )}
                    {effectiveConfig.showAuthor && slide.author && (
                      <p className="mt-2 text-xs text-zinc-300">por {slide.author.name}</p>
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
            <button onClick={goPrev} className="absolute left-3 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-white/90 backdrop-blur-sm shadow-soft-md text-zinc-700 flex items-center justify-center hover:bg-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100" aria-label="Slide anterior">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={goNext} className="absolute right-3 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-white/90 backdrop-blur-sm shadow-soft-md text-zinc-700 flex items-center justify-center hover:bg-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100" aria-label="Próximo slide">
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
                aria-label={`Ir para o slide ${idx + 1}`}
                aria-current={idx === current ? 'true' : undefined}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}
