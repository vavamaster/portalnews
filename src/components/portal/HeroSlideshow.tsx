'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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

export function HeroSlideshow({ config, posts, categoryId }: Props) {
  const { setView } = useAppStore()
  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const slides = posts.slice(0, config?.postCount || 5)

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
    if (!config?.autoPlay || isPaused || slides.length <= 1) return
    timerRef.current = setTimeout(goNext, config.delayMs || 5000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [current, isPaused, config, goNext, slides.length])

  if (!config?.isEnabled || slides.length === 0) return null

  const heightClass = HEIGHT_MAP[config.heightPreset] || HEIGHT_MAP.tall
  const post = slides[current]
  if (!post) return null

  const openPost = (slug: string) => {
    setView({ name: 'article', slug })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(post.publishedAt))

  // === DESIGN: OVERLAY ===
  if (config.designType === 'overlay') {
    return (
      <div
        className={cn('relative w-full overflow-hidden rounded-2xl bg-zinc-900 group', heightClass)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Slides */}
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
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
          </div>
        ))}

        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7 lg:p-9 pointer-events-none">
          <div key={current} className="animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              {config.showCategory && post.category && (
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
            {config.showExcerpt && post.subtitle && (
              <p className="text-zinc-300 line-clamp-2 text-sm sm:text-base font-light mb-3">{post.subtitle}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-zinc-400 font-light">
              <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {dateStr}</span>
              <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {post.views}</span>
              {config.showAuthor && post.author && <span>por <span className="text-zinc-200">{post.author.name}</span></span>}
            </div>
          </div>
        </div>

        {/* Arrows */}
        {config.showArrows && slides.length > 1 && (
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
        {config.showDots && slides.length > 1 && (
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
        {config.autoPlay && !isPaused && slides.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20">
            <div
              key={current}
              className="h-full bg-primary"
              style={{ animation: `progressBar ${config.delayMs}ms linear` }}
            />
          </div>
        )}
      </div>
    )
  }

  // === DESIGN: SPLIT ===
  if (config.designType === 'split') {
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
                  {config.showCategory && slide.category && (
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
                {config.showExcerpt && slide.subtitle && (
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
        {config.showArrows && slides.length > 1 && (
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
        {config.showDots && slides.length > 1 && (
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
  if (config.designType === 'minimal') {
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
                  {config.showCategory && slide.category && (
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
                {config.showExcerpt && slide.subtitle && (
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
                />
              </div>
            </div>
          </div>
        ))}

        {/* Arrows */}
        {config.showArrows && slides.length > 1 && (
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
        {config.showDots && slides.length > 1 && (
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
  if (config.designType === 'cards') {
    return (
      <div
        className={cn('relative w-full overflow-hidden group', heightClass)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="flex h-full items-center">
          {slides.map((slide, idx) => {
            const offset = idx - current
            const isActive = offset === 0
            const isVisible = Math.abs(offset) <= 2
            return (
              <div
                key={slide.id}
                className={cn(
                  'absolute transition-all duration-600 ease-out rounded-2xl overflow-hidden cursor-pointer',
                  isActive ? 'z-30' : 'z-10',
                  !isVisible && 'opacity-0 pointer-events-none'
                )}
                style={{
                  transform: `translateX(${offset * 60}%) scale(${isActive ? 1 : 0.78})`,
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
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                {isActive && (
                  <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      {config.showCategory && slide.category && (
                        <span className={cn('text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full', `cat-${slide.category.color || 'slate'}`)}>
                          {slide.category.name}
                        </span>
                      )}
                    </div>
                    <h2 className="text-white text-2xl sm:text-3xl leading-tight mb-2" style={{ fontWeight: 500, letterSpacing: '-0.02em' }}>
                      {slide.title}
                    </h2>
                    {config.showExcerpt && slide.subtitle && (
                      <p className="text-zinc-300 line-clamp-2 text-sm font-light">{slide.subtitle}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Arrows */}
        {config.showArrows && slides.length > 1 && (
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
        {config.showDots && slides.length > 1 && (
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
