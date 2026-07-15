'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * AnalyticsTracker — invisible component that fires a page-view beacon
 * on every navigation. Mount once in the root layout.
 *
 * Uses navigator.sendBeacon (non-blocking, survives page unload).
 * Falls back to fetch() if sendBeacon is unavailable.
 */
export function AnalyticsTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const path = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    const referrer = typeof document !== 'undefined' ? document.referrer : null
    const startTime = performance.now()

    const t = setTimeout(() => {
      const payload = JSON.stringify({
        path,
        referrer,
        responseTimeMs: Math.round(performance.now() - startTime),
      })

      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/track', payload)
        } else {
          fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {})
        }
      } catch {
        // Silent fail — analytics is non-critical
      }
    }, 100)

    return () => clearTimeout(t)
  }, [pathname, searchParams])

  return null
}
