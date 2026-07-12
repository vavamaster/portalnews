'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface HeaderAd {
  id: string
  name: string
  type: 'static' | 'slider'
  images: any // string for static, array for slider
  linkUrl: string | null
  animation: 'none' | 'fade' | 'slide' | 'kenburns'
  slideInterval: number
  position: string
  openNewTab: boolean
  widthHint: number
  heightHint: number
}

interface HeaderAdSlotProps {
  position: 'above-brand' | 'below-brand' | 'below-nav' | 'replace-ticker'
  className?: string
}

export function HeaderAdSlot({ position, className }: HeaderAdSlotProps) {
  const [ad, setAd] = useState<HeaderAd | null>(null)
  const [loading, setLoading] = useState(true)
  const trackedRef = useRef(false)

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/header-ads/serve?position=${position}`)
        const d = await r.json()
        setAd(d.ad || null)
      } catch {} finally {
        setLoading(false)
      }
    })()
  }, [position])

  // Track impression once when ad is shown
  useEffect(() => {
    if (ad && !trackedRef.current) {
      trackedRef.current = true
      // impression is already tracked on /serve GET
    }
  }, [ad])

  if (loading || !ad) return null

  return (
    <div className={cn('w-full', className)}>
      <AdRenderer ad={ad} />
    </div>
  )
}

function AdRenderer({ ad }: { ad: HeaderAd }) {
  if (ad.type === 'slider' && Array.isArray(ad.images)) {
    return <SliderAd ad={ad} />
  }

  // Static ad
  const imageUrl = typeof ad.images === 'string' ? ad.images : (Array.isArray(ad.images) ? (ad.images[0]?.url || '') : '')
  const linkUrl = ad.linkUrl || (Array.isArray(ad.images) ? (ad.images[0]?.link || '') : '') || ''

  if (!imageUrl) return null

  const content = (
    <img
      src={imageUrl}
      alt={ad.name}
      className="w-full h-auto block"
      style={{ maxHeight: `${ad.heightHint}px`, objectFit: 'contain' }}
    />
  )

  // Apply ken-burns animation to the image
  const animatedContent = ad.animation === 'kenburns' ? (
    <div className="overflow-hidden">
      <div className="header-ad-kenburns">{content}</div>
    </div>
  ) : content

  if (linkUrl) {
    return (
      <a
        href={linkUrl}
        target={ad.openNewTab ? '_blank' : '_self'}
        rel={ad.openNewTab ? 'noopener noreferrer' : ''}
        onClick={() => trackClick(ad.id)}
        className="block hover:opacity-95 transition-opacity"
      >
        {animatedContent}
      </a>
    )
  }

  return animatedContent
}

function SliderAd({ ad }: { ad: HeaderAd }) {
  const slides: { url: string; link?: string }[] = ad.images
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const interval = setInterval(() => {
      setCurrent(prev => (prev + 1) % slides.length)
    }, ad.slideInterval)
    return () => clearInterval(interval)
  }, [slides.length, ad.slideInterval])

  if (slides.length === 0) return null

  return (
    <div
      className="relative overflow-hidden"
      style={{ maxHeight: `${ad.heightHint}px` }}
    >
      {/* Slides */}
      <div
        className={cn(
          'flex transition-all duration-700',
          ad.animation === 'slide' && 'ease-out',
        )}
        style={{
          transform: `translateX(-${current * 100}%)`,
          transitionTimingFunction: ad.animation === 'fade' ? 'ease-in-out' : 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {slides.map((slide, i) => {
          const content = (
            <img
              src={slide.url}
              alt={`${ad.name} — slide ${i + 1}`}
              className="w-full h-auto block flex-shrink-0"
              style={{ maxHeight: `${ad.heightHint}px`, objectFit: 'contain' }}
            />
          )
          const animatedContent = ad.animation === 'kenburns' ? (
            <div className="overflow-hidden h-full">
              <div className="header-ad-kenburns h-full">{content}</div>
            </div>
          ) : content

          return (
            <div key={i} className="w-full flex-shrink-0">
              {slide.link ? (
                <a
                  href={slide.link}
                  target={ad.openNewTab ? '_blank' : '_self'}
                  rel={ad.openNewTab ? 'noopener noreferrer' : ''}
                  onClick={() => trackClick(ad.id)}
                  className="block hover:opacity-95 transition-opacity"
                >
                  {animatedContent}
                </a>
              ) : (
                animatedContent
              )}
            </div>
          )
        })}
      </div>

      {/* Dots indicator */}
      {slides.length > 1 && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.preventDefault(); setCurrent(i) }}
              className={cn(
                'h-1.5 rounded-full transition-all',
                current === i ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
              )}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Prev/Next arrows (only on hover) */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setCurrent(prev => prev === 0 ? slides.length - 1 : prev - 1) }}
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-1 rounded opacity-0 hover:opacity-100 transition-opacity"
            aria-label="Anterior"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setCurrent(prev => (prev + 1) % slides.length) }}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-1 rounded opacity-0 hover:opacity-100 transition-opacity"
            aria-label="Próximo"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
          </button>
        </>
      )}
    </div>
  )
}

async function trackClick(adId: string) {
  try {
    await fetch('/api/header-ads/serve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId }),
    })
  } catch {}
}
