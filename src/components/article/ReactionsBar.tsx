'use client'

import { useState } from 'react'
import { Share2, Link2, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface Props {
  post: { id: string; slug: string; title: string; coverImage?: string | null }
}

const REACTION_TYPES = [
  { type: 'LIKE', label: 'Curtir', emoji: '👍', color: 'text-blue-600' },
  { type: 'LOVE', label: 'Amei', emoji: '❤️', color: 'text-red-500' },
  { type: 'HAHA', label: 'Haha', emoji: '😂', color: 'text-amber-500' },
  { type: 'WOW', label: 'Uau', emoji: '😮', color: 'text-amber-500' },
  { type: 'SAD', label: 'Triste', emoji: '😢', color: 'text-yellow-600' },
  { type: 'ANGRY', label: 'Grr', emoji: '😡', color: 'text-orange-600' },
]

export function ReactionsBar({ post }: Props) {
  const { user, setView } = useAppStore()
  const { toast } = useToast()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [mine, setMine] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSocial, setShowSocial] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchReactions = async () => {
    try {
      const res = await fetch(`/api/reactions?postId=${post.id}`)
      const data = await res.json()
      setCounts(data.counts || {})
      setMine(data.mine)
    } catch {}
  }

  // fetch on mount
  useState(() => {
    fetchReactions()
  })

  const handleReact = async (type: string) => {
    if (!user) {
      toast({ title: 'Faça login para reagir', description: 'Você ganha pontos ao reagir nas notícias!', variant: 'destructive' })
      setView({ name: 'login' })
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, type }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        toast({
          title: data.action === 'created' ? 'Reação registrada!' : data.action === 'updated' ? 'Reação atualizada' : 'Reação removida',
          description: data.pointsAwarded ? `+${data.pointsAwarded} pontos!` : undefined,
        })
        fetchReactions()
        // refresh user points
        const meRes = await fetch('/api/auth/me')
        const meData = await meRes.json()
        if (meData.user) {
          // update store via setView trick (or import setUser)
          const { useAppStore } = await import('@/lib/store')
          useAppStore.getState().setUser(meData.user)
        }
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/noticias/${encodeURIComponent(post.slug)}` : ''
  const shareText = post.title

  const share = (platform: string) => {
    const urls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      email: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`,
    }
    if (urls[platform]) {
      window.open(urls[platform], '_blank', 'width=600,height=400')
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: 'Link copiado!' })
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' })
    }
  }

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      {/* Reactions */}
      <div className="flex flex-wrap items-center gap-2 py-4 border-y border-zinc-200">
        <span className="text-sm font-medium text-zinc-700 mr-2">Reagir:</span>
        {REACTION_TYPES.map(({ type, label, emoji }) => {
          const count = counts[type] || 0
          const isMine = mine === type
          return (
            <button
              key={type}
              onClick={() => handleReact(type)}
              disabled={loading}
              className={cn(
                'group flex items-center gap-1.5 px-3 py-2 rounded-full border transition-all hover:scale-105',
                isMine
                  ? 'bg-accent border-primary text-primary'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
              )}
              title={label}
            >
              <span className="text-base leading-none">{emoji}</span>
              <span className="text-xs font-medium">{label}</span>
              {count > 0 && <span className="text-xs font-bold text-zinc-700 ml-1">{count}</span>}
            </button>
          )
        })}
        {totalCount > 0 && (
          <span className="text-xs text-zinc-500 ml-auto">{totalCount} reações</span>
        )}
      </div>

      {/* Share */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-700 mr-2 flex items-center gap-1">
          <Share2 className="h-4 w-4" /> Compartilhar:
        </span>
        <ShareBtn label="Facebook" onClick={() => share('facebook')} className="bg-[#1877F2] hover:bg-[#0d6ae0]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </ShareBtn>
        <ShareBtn label="WhatsApp" onClick={() => share('whatsapp')} className="bg-[#25D366] hover:bg-[#1eb558]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.738-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
        </ShareBtn>
        <ShareBtn label="X (Twitter)" onClick={() => share('twitter')} className="bg-black hover:bg-zinc-800">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </ShareBtn>
        <ShareBtn label="Telegram" onClick={() => share('telegram')} className="bg-[#0088cc] hover:bg-[#0077b3]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
        </ShareBtn>
        <ShareBtn label="LinkedIn" onClick={() => share('linkedin')} className="bg-[#0A66C2] hover:bg-[#0854a1]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        </ShareBtn>
        <ShareBtn label="Email" onClick={() => share('email')} className="bg-zinc-700 hover:bg-zinc-800">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M0 3v18h24v-18h-24zm21.518 2l-9.518 7.713-9.518-7.713h19.036zm-19.518 14v-11.817l10 8.104 10-8.104v11.817h-20z"/></svg>
        </ShareBtn>
        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium transition-colors"
          title="Copiar link"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
          {copied ? 'Copiado!' : 'Copiar Link'}
        </button>
      </div>
    </div>
  )
}

function ShareBtn({ label, onClick, className, children }: { label: string; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={`Compartilhar no ${label}`}
      aria-label={`Compartilhar no ${label}`}
      className={cn('flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-white text-xs font-medium transition-colors', className)}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
