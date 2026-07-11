'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft, Loader2, Star, Award, FileText, Crown, User as UserIcon, Store
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/portal/UserAvatar'

const LEVEL_COLORS: Record<string, string> = {
  JUNIOR: 'blue',
  PLENO: 'emerald',
  SENIOR: 'amber',
  MASTER: 'purple',
}

const LEVEL_LABELS: Record<string, string> = {
  JUNIOR: 'Júnior',
  PLENO: 'Pleno',
  SENIOR: 'Sênior',
  MASTER: 'Master',
}

export function EditorsListView() {
  const { setView } = useAppStore()
  const [editors, setEditors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [siteName, setSiteName] = useState('Portal de Notícias')

  useEffect(() => {
    fetch('/api/editors').then(r => r.json()).then(data => {
      setEditors(data.editors || [])
    }).finally(() => setLoading(false))
    fetch('/api/seo').then(r => r.json()).then(d => {
      if (d.settings?.site_name) setSiteName(d.settings.site_name)
    }).catch(() => {})
  }, [])

  return (
    <div className="news-container py-6 animate-fade-in">
      <button onClick={() => setView({ name: 'home' })} className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-primary mb-4">
        <ChevronLeft className="h-4 w-4" /> Voltar ao início
      </button>

      <div className="mb-6 pb-4 border-b border-zinc-200">
        <h1 className="font-black text-3xl sm:text-4xl text-zinc-900 flex items-center gap-3">
          <UserIcon className="h-8 w-8 text-primary" /> Nossos Editores
        </h1>
        <p className="text-zinc-600 mt-1">
          Conheça a equipe de jornalistas que produzem o conteúdo do portal {siteName}.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </div>
      ) : editors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserIcon className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-600">Nenhum editor cadastrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {editors.map((e) => {
            const levelColor = LEVEL_COLORS[e.level] || 'zinc'
            return (
              <Card
                key={e.slug}
                onClick={() => setView({ name: 'editor-profile', slug: e.slug } as any)}
                className="cursor-pointer hover-lift group"
              >
                <CardContent className="pt-5 text-center">
                  <div className="relative inline-block mb-3">
                    <UserAvatar name={e.name} avatar={e.avatar} size="xl" />
                    <div className={cn('absolute bottom-0 right-0 h-7 w-7 rounded-full border-2 border-white flex items-center justify-center', `bg-${levelColor}-500`)} title={LEVEL_LABELS[e.level]}>
                      <Crown className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                  <h3 className="font-bold text-zinc-900 group-hover:text-primary transition-colors">{e.name}</h3>
                  {e.title && <p className="text-xs text-zinc-500 mt-0.5">{e.title}</p>}
                  <div className={cn('inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold', `bg-${levelColor}-100 text-${levelColor}-800`)}>
                    {LEVEL_LABELS[e.level]}
                  </div>
                  {e.bio && <p className="text-sm text-zinc-600 mt-2 line-clamp-2">{e.bio}</p>}
                  <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {e.totalPosts} posts</span>
                    {e.ratingsCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                        {e.avgRating.toFixed(1)} ({e.ratingsCount})
                      </span>
                    )}
                    <span className="flex items-center gap-1"><Award className="h-3 w-3" /> {e.trustLevel}%</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
