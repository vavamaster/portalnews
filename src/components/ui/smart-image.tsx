'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ImageIcon } from 'lucide-react'

// Generic fallback image (data URI) — used when no src is provided or src fails to load.
// Shows a clean gray placeholder with a subtle image icon. No external request.
const FALLBACK_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#f4f4f5"/>
  <g fill="#d4d4d8">
    <rect x="350" y="220" width="100" height="80" rx="6"/>
    <circle cx="400" cy="200" r="22"/>
    <path d="M 280 380 L 350 290 L 420 360 L 470 320 L 540 380 Z"/>
  </g>
  <text x="400" y="450" font-family="system-ui, sans-serif" font-size="20" fill="#a1a1aa" text-anchor="middle">Imagem indisponível</text>
</svg>
`)}`

interface SmartImageProps {
  src?: string | null
  alt: string
  className?: string
  /** Aspect ratio container (e.g., "aspect-[16/10]"). When set, the image fills the container. */
  containerClassName?: string
  /** Optional fallback URL to try before the generic placeholder (e.g., a default news image) */
  fallbackSrc?: string
  /** Loading strategy */
  loading?: 'eager' | 'lazy'
  /** Decode hint */
  decoding?: 'async' | 'auto' | 'sync'
  /** When true, suppresses the error icon overlay (useful for decorative images) */
  silent?: boolean
  /** Clickable behaviour / hover styles applied to the wrapper */
  onClick?: () => void
  /** img element ref forward */
  imgRef?: React.Ref<HTMLImageElement>
}

/**
 * SmartImage — drop-in replacement for <img> that:
 *  1. Returns null (renders nothing) when src is empty AND no children expected — actually shows a clean placeholder
 *  2. Catches onError (broken URL, 404, network failure) and swaps to a fallback chain
 *  3. Optionally tries a provided `fallbackSrc` before falling back to the generic SVG placeholder
 *  4. Shows a subtle loading shimmer while the image is loading
 *
 * Use anywhere you'd use <img>. The className is applied to the <img> element.
 * If you provide containerClassName, the wrapper div gets that class; otherwise the <img> is rendered bare.
 */
export function SmartImage({
  src,
  alt,
  className,
  containerClassName,
  fallbackSrc,
  loading = 'lazy',
  decoding = 'async',
  silent = false,
  onClick,
  imgRef,
}: SmartImageProps) {
  // Use src as key — when src changes, the component re-mounts, avoiding
  // the need for setState-in-effect patterns
  return (
    <SmartImageInner
      key={src || 'empty'}
      src={src}
      alt={alt}
      className={className}
      containerClassName={containerClassName}
      fallbackSrc={fallbackSrc}
      loading={loading}
      decoding={decoding}
      silent={silent}
      onClick={onClick}
      imgRef={imgRef}
    />
  )
}

function SmartImageInner({
  src,
  alt,
  className,
  containerClassName,
  fallbackSrc,
  loading = 'lazy',
  decoding = 'async',
  silent = false,
  onClick,
  imgRef,
}: SmartImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src || undefined)
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error')
  const triedFallback = useRef(false)

  // Reset triedFallback if src changes (defensive — key prop already handles remount)
  useEffect(() => {
    triedFallback.current = false
  }, [src])

  const handleError = () => {
    if (!triedFallback.current && fallbackSrc) {
      triedFallback.current = true
      setCurrentSrc(fallbackSrc)
      setStatus('loading')
    } else if (currentSrc !== FALLBACK_SVG) {
      setCurrentSrc(FALLBACK_SVG)
      setStatus('error')
    } else {
      setStatus('error')
    }
  }

  const handleLoad = () => {
    if (currentSrc === FALLBACK_SVG) {
      setStatus('error')
    } else {
      setStatus('loaded')
    }
  }

  // No src at all → render the placeholder directly
  if (!src && !currentSrc) {
    if (containerClassName) {
      return (
        <div className={cn('relative bg-zinc-100 overflow-hidden', containerClassName)} onClick={onClick}>
          <img
            src={FALLBACK_SVG}
            alt={alt}
            className={cn('w-full h-full object-cover', className)}
            loading={loading}
            decoding={decoding}
          />
        </div>
      )
    }
    return (
      <img
        src={FALLBACK_SVG}
        alt={alt}
        className={cn('bg-zinc-100', className)}
        loading={loading}
        decoding={decoding}
      />
    )
  }

  const img = (
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      className={cn(
        'transition-opacity duration-300',
        status === 'loaded' ? 'opacity-100' : 'opacity-0',
        className,
      )}
      loading={loading}
      decoding={decoding}
      onError={handleError}
      onLoad={handleLoad}
    />
  )

  if (containerClassName) {
    return (
      <div
        className={cn('relative bg-zinc-100 overflow-hidden', containerClassName, onClick && 'cursor-pointer')}
        onClick={onClick}
      >
        {img}
        {/* Loading shimmer */}
        {status === 'loading' && (
          <div className="absolute inset-0 bg-zinc-100 animate-pulse" aria-hidden="true" />
        )}
        {/* Error indicator (subtle) */}
        {status === 'error' && !silent && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/80 pointer-events-none">
            <ImageIcon className="h-5 w-5 text-zinc-300" />
          </div>
        )}
      </div>
    )
  }

  return img
}
