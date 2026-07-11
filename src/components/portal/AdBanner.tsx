'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SmartImage } from '@/components/ui/smart-image'

interface AdData {
  id: string
  title: string
  content: string
  imageUrl?: string | null
  linkUrl?: string | null
  placement: string
  isFreeAd?: boolean
  impressionLimit?: number
  impressions?: number
  remaining?: number | null
}

const PLACEMENT_LABELS: Record<string, string> = {
  HEADER_BANNER: 'Publicidade',
  HOME_TOP: 'Publicidade',
  HOME_SIDEBAR: 'Publicidade',
  HOME_MIDDLE: 'Publicidade',
  ARTICLE_TOP: 'Publicidade',
  ARTICLE_MIDDLE: 'Publicidade',
  ARTICLE_SIDEBAR: 'Publicidade',
  FOOTER_BANNER: 'Publicidade',
}

export function AdBanner({ placement, className, variant = 'full' }: { placement: string; className?: string; variant?: 'full' | 'compact' | 'sidebar' }) {
  const [ad, setAd] = useState<AdData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/ads/serve?placement=${placement}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setAd(data.ad || null)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [placement])

  const handleClick = () => {
    if (ad) {
      fetch(`/api/ads/${ad.id}?action=click`, { method: 'PATCH' }).catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className={cn('bg-zinc-50 border border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-xs h-20', className)}>
        <Megaphone className="h-3 w-3 mr-1 animate-pulse" /> Carregando...
      </div>
    )
  }

  if (!ad) {
    // Placeholder
    return (
      <div className={cn('bg-zinc-50 border border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-xs', className)}>
        <Megaphone className="h-3 w-3 mr-1" /> {PLACEMENT_LABELS[placement] || 'Publicidade'} — Anuncie aqui
      </div>
    )
  }

  const label = PLACEMENT_LABELS[placement] || 'Publicidade'

  if (variant === 'sidebar') {
    return (
      <a
        href={ad.linkUrl || '#'}
        target={ad.linkUrl && ad.linkUrl !== '#' ? '_blank' : undefined}
        rel="noopener noreferrer"
        onClick={handleClick}
        className={cn('block bg-white border border-zinc-200 rounded-xl overflow-hidden hover-lift group', className)}
      >
        {ad.imageUrl && (
          <div className="aspect-video bg-zinc-100 overflow-hidden">
            <SmartImage src={ad.imageUrl} alt={ad.title} containerClassName="w-full h-full" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
        )}
        <div className="p-4">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{label}</div>
          <div className="text-sm text-zinc-900 line-clamp-2" style={{ fontWeight: 500 }}>{ad.title}</div>
          <div className="text-xs text-zinc-600 mt-1 line-clamp-3" dangerouslySetInnerHTML={{ __html: ad.content }} />
          {ad.isFreeAd && ad.remaining !== null && ad.remaining !== undefined && (
            <div className="text-[10px] text-zinc-400 mt-2">Restam {ad.remaining} impressões</div>
          )}
        </div>
      </a>
    )
  }

  if (variant === 'compact') {
    return (
      <a
        href={ad.linkUrl || '#'}
        target={ad.linkUrl && ad.linkUrl !== '#' ? '_blank' : undefined}
        rel="noopener noreferrer"
        onClick={handleClick}
        className={cn('flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-lg p-3 hover:bg-zinc-100 transition-colors', className)}
      >
        {ad.imageUrl && (
          <SmartImage src={ad.imageUrl} alt={ad.title} containerClassName="h-12 w-12 flex-shrink-0 rounded-md overflow-hidden" className="h-12 w-12 object-cover" />
        )}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{label}</div>
          <div className="text-sm text-zinc-900 line-clamp-1" style={{ fontWeight: 500 }}>{ad.title}</div>
          <div className="text-xs text-zinc-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: ad.content }} />
        </div>
        <ExternalLink className="h-3 w-3 text-zinc-400 flex-shrink-0" />
      </a>
    )
  }

  // full banner
  return (
    <a
      href={ad.linkUrl || '#'}
      target={ad.linkUrl && ad.linkUrl !== '#' ? '_blank' : undefined}
      rel="noopener noreferrer"
      onClick={handleClick}
      className={cn('block bg-white border border-zinc-200 rounded-xl overflow-hidden hover-lift group', className)}
    >
      {ad.imageUrl && (
        <div className="relative aspect-[16/4] bg-zinc-100 overflow-hidden">
          <SmartImage src={ad.imageUrl} alt={ad.title} containerClassName="w-full h-full" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">{label}</span>
        </div>
      )}
      <div className="p-4">
        {!ad.imageUrl && <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{label}</div>}
        <div className="text-zinc-900" style={{ fontWeight: 500 }}>{ad.title}</div>
        <div className="text-sm text-zinc-600 mt-1" dangerouslySetInnerHTML={{ __html: ad.content }} />
        {ad.isFreeAd && ad.remaining !== null && ad.remaining !== undefined && (
          <div className="text-[10px] text-zinc-400 mt-2">Restam {ad.remaining} impressões</div>
        )}
      </div>
    </a>
  )
}
