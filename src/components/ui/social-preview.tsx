'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MessageCircle, Facebook, Twitter, ImageIcon } from 'lucide-react'

interface SocialPreviewProps {
  title: string
  description: string
  image?: string
  siteName?: string
  url?: string
}

type Network = 'whatsapp' | 'facebook' | 'twitter'

export function SocialPreview({ title, description, image, siteName = 'Portal', url = 'portal.com.br' }: SocialPreviewProps) {
  const [network, setNetwork] = useState<Network>('whatsapp')

  const networks: { id: Network; label: string; icon: any; color: string }[] = [
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-600' },
    { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600' },
    { id: 'twitter', label: 'Twitter/X', icon: Twitter, color: 'text-zinc-700' },
  ]

  return (
    <div className="space-y-3">
      {/* Network selector */}
      <div className="flex items-center gap-1 p-1 bg-zinc-100/70 rounded-lg w-fit">
        {networks.map(n => {
          const Icon = n.icon
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setNetwork(n.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                network === n.id
                  ? 'bg-white shadow-sm text-zinc-900 ring-1 ring-zinc-200/60'
                  : 'text-zinc-500 hover:text-zinc-700'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', network === n.id && n.color)} />
              {n.label}
            </button>
          )
        })}
      </div>

      {/* WhatsApp preview */}
      {network === 'whatsapp' && (
        <div className="bg-[#e5ddd5] rounded-xl p-3 max-w-md">
          <div className="bg-white rounded-lg overflow-hidden shadow-sm">
            {image ? (
              <div className="aspect-[1.91/1] bg-zinc-100 overflow-hidden">
                <img src={image} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-[1.91/1] bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-zinc-300" />
              </div>
            )}
            <div className="p-2.5">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wide truncate">{url}</div>
              <div className="text-sm font-medium text-zinc-900 leading-tight mt-0.5 line-clamp-2">{title}</div>
              <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-snug">{description}</div>
            </div>
          </div>
        </div>
      )}

      {/* Facebook preview */}
      {network === 'facebook' && (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden max-w-md shadow-sm">
          {image ? (
            <div className="aspect-[1.91/1] bg-zinc-100 overflow-hidden">
              <img src={image} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-[1.91/1] bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-zinc-300" />
            </div>
          )}
          <div className="p-3 bg-zinc-50">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide truncate">{url.toUpperCase()}</div>
            <div className="text-sm font-semibold text-zinc-900 leading-tight mt-0.5 line-clamp-2">{title}</div>
            <div className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-snug">{description}</div>
          </div>
        </div>
      )}

      {/* Twitter/X preview */}
      {network === 'twitter' && (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden max-w-md shadow-sm">
          {image ? (
            <div className="aspect-[1.91/1] bg-zinc-100 overflow-hidden border-b border-zinc-200">
              <img src={image} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-[1.91/1] bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center border-b border-zinc-200">
              <ImageIcon className="h-8 w-8 text-zinc-300" />
            </div>
          )}
          <div className="p-3">
            <div className="text-[10px] text-zinc-500 truncate">{url}</div>
            <div className="text-sm font-medium text-zinc-900 leading-tight mt-0.5 line-clamp-2">{title}</div>
            <div className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-snug">{description}</div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="text-[11px] text-zinc-400 flex items-start gap-1.5">
        <span className="text-amber-500">💡</span>
        <span>
          Dica: a imagem OG ideal é <strong>1200×630px</strong>. Títulos até 60 caracteres e descrições até 160 caracteres são exibidos sem cortes.
        </span>
      </div>
    </div>
  )
}
