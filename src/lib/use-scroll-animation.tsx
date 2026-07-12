'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Hook that adds fade-in animation when element enters viewport.
 * Uses IntersectionObserver for performance.
 *
 * Usage:
 *   const ref = useRef<HTMLElement>(null)
 *   const isVisible = useScrollAnimation(ref)
 *   <div ref={ref} className={isVisible ? 'scroll-fade-in is-visible' : 'scroll-fade-in'} />
 *
 * Or simpler:
 *   <ScrollFadeIn><MyComponent /></ScrollFadeIn>
 */
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(options?: {
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
}) {
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', triggerOnce = true } = options || {}
  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // If IntersectionObserver is not available (old browsers), just show
    if (typeof IntersectionObserver === 'undefined') {
      void (async () => { setIsVisible(true) })()
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (triggerOnce) observer.disconnect()
        } else if (!triggerOnce) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin, triggerOnce])

  return { ref, isVisible }
}

/**
 * Wrapper component that applies scroll fade-in animation to children.
 *
 * Usage: <ScrollFadeIn delay={100}><Card /></ScrollFadeIn>
 */
export function ScrollFadeIn({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: any
}) {
  const { ref, isVisible } = useScrollAnimation<HTMLElement>()

  return (
    <Tag
      ref={ref as any}
      className={`scroll-fade-in ${isVisible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
