'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ChevronLeft, Loader2, Star, Award, FileText, Crown, User as UserIcon, Globe,
  Twitter, Facebook, Instagram, Linkedin, ExternalLink, TrendingUp, MessageSquare,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/portal/UserAvatar'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

const LEVEL_COLORS: Record<string, string> = {
  JUNIOR: 'blue', PLENO: 'emerald', SENIOR: 'amber', MASTER: 'purple',
}
const LEVEL_LABELS: Record<string, string> = {
  JUNIOR: 'Júnior', PLENO: 'Pleno', SENIOR: 'Sênior', MASTER: 'Master',
}

export function EditorProfileView({ slug }: { slug: string }) {
  const { setView, user } = useAppStore()
  const { toast } = useToast()
  const [profile, setProfile] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [ratingForm, setRatingForm] = useState({ rating: 5, comment: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/editors/${slug}`).then(r => r.json()).then(data => {
      setProfile(data.profile || null)
    }).finally(() => setLoading(false))
  }, [slug])

  const handleRate = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/editor-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editorId: profile.id, ...ratingForm }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        toast({ title: 'Avaliação enviada!', description: data.pointsAwarded ? `+${data.pointsAwarded} pontos!` : '' })
        setRatingOpen(false)
        // reload
        fetch(`/api/editors/${slug}`).then(r => r.json()).then(data => setProfile(data.profile))
      }
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return (
      <div className="news-container py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="news-container py-16 text-center">
        <UserIcon className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Editor não encontrado</h1>
        <Button onClick={() => setView({ name: 'editors' } as any)} className="bg-primary mt-3">Ver todos editores</Button>
      </div>
    )
  }

  const levelColor = LEVEL_COLORS[profile.level] || 'zinc'

  return (
    <div className="news-container py-6 animate-fade-in">
      <button onClick={() => setView({ name: 'editors' } as any)} className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-primary mb-4">
        <ChevronLeft className="h-4 w-4" /> Voltar para editores
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Editor card */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="pt-5 text-center">
              <div className="relative inline-block mb-3">
                <UserAvatar name={profile.name} avatar={profile.avatar} size="xl" className="border-4 border-white shadow rounded-full" />
                <div className={cn('absolute bottom-0 right-0 h-9 w-9 rounded-full border-4 border-white flex items-center justify-center', `bg-${levelColor}-500`)} title={LEVEL_LABELS[profile.level]}>
                  <Crown className="h-4 w-4 text-white" />
                </div>
              </div>
              <h1 className="font-black text-2xl text-zinc-900">{profile.name}</h1>
              {profile.title && <p className="text-sm text-zinc-600 mt-0.5">{profile.title}</p>}
              <div className={cn('inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold', `bg-${levelColor}-100 text-${levelColor}-800`)}>
                Editor {LEVEL_LABELS[profile.level]}
              </div>

              {profile.bio && <p className="text-sm text-zinc-700 mt-4 text-left">{profile.bio}</p>}

              {profile.socialLinks && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  {profile.socialLinks.twitter && (
                    <a href={profile.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full bg-zinc-100 hover:bg-blue-100 flex items-center justify-center text-zinc-600 hover:text-blue-600">
                      <Twitter className="h-4 w-4" />
                    </a>
                  )}
                  {profile.socialLinks.facebook && (
                    <a href={profile.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full bg-zinc-100 hover:bg-blue-100 flex items-center justify-center text-zinc-600 hover:text-blue-600">
                      <Facebook className="h-4 w-4" />
                    </a>
                  )}
                  {profile.socialLinks.instagram && (
                    <a href={profile.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full bg-zinc-100 hover:bg-pink-100 flex items-center justify-center text-zinc-600 hover:text-pink-600">
                      <Instagram className="h-4 w-4" />
                    </a>
                  )}
                  {profile.socialLinks.linkedin && (
                    <a href={profile.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full bg-zinc-100 hover:bg-blue-100 flex items-center justify-center text-zinc-600 hover:text-blue-600">
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                  {profile.socialLinks.website && (
                    <a href={profile.socialLinks.website} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-900">
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}

              {user && user.id !== profile.id && (
                <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full mt-4 bg-primary">
                      <Star className="h-4 w-4 mr-2" /> Avaliar editor
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Avaliar {profile.name}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Avaliação (1-5 estrelas)</Label>
                        <div className="flex gap-1 mt-2">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              onClick={() => setRatingForm({ ...ratingForm, rating: n })}
                              className="text-3xl hover:scale-110 transition-transform"
                            >
                              <Star className={cn('h-8 w-8', n <= ratingForm.rating ? 'fill-amber-500 text-amber-500' : 'text-zinc-300')} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>Comentário (opcional)</Label>
                        <Textarea
                          value={ratingForm.comment}
                          onChange={(e) => setRatingForm({ ...ratingForm, comment: e.target.value })}
                          rows={3}
                          placeholder="Conte sua experiência com o trabalho deste editor..."
                          className="mt-1"
                        />
                      </div>
                      <Button onClick={handleRate} disabled={submitting} className="w-full bg-primary">
                        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Star className="h-4 w-4 mr-2" />}
                        Enviar avaliação (+5 pts)
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          {profile.stats && (
            <Card>
              <CardHeader><CardTitle className="text-base">Estatísticas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <StatRow icon={FileText} label="Posts publicados" value={profile.stats.totalPosts} />
                <StatRow icon={CheckCircle2} label="Aprovações recebidas" value={profile.stats.totalApproved} />
                <StatRow icon={Shield} label="Trust level" value={`${profile.stats.trustLevel}%`} />
                <StatRow icon={Crown} label="Nível" value={LEVEL_LABELS[profile.stats.level]} />
              </CardContent>
            </Card>
          )}

          {/* Rating */}
          {profile.rating && profile.rating.count > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Avaliação dos leitores</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-3xl font-black text-amber-600">{profile.rating.average.toFixed(1)}</div>
                  <div className="flex flex-col">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className={cn('h-4 w-4', n <= Math.round(profile.rating.average) ? 'fill-amber-500 text-amber-500' : 'text-zinc-300')} />
                      ))}
                    </div>
                    <div className="text-xs text-zinc-500">{profile.rating.count} avaliação(ões)</div>
                  </div>
                </div>
                {profile.rating.reviews && profile.rating.reviews.length > 0 && (
                  <div className="space-y-2 mt-3 pt-3 border-t border-zinc-100">
                    {profile.rating.reviews.slice(0, 3).map((r: any) => (
                      <div key={r.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          {r.rater && <UserAvatar name={r.rater.name} avatar={r.rater.avatar} size="xs" />}
                          <span className="font-medium text-xs">{r.rater?.name}</span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star key={n} className={cn('h-3 w-3', n <= r.rating ? 'fill-amber-500 text-amber-500' : 'text-zinc-300')} />
                            ))}
                          </div>
                        </div>
                        {r.comment && <p className="text-xs text-zinc-600 mt-1">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Categories */}
          {profile.categories && profile.categories !== 'all' && Array.isArray(profile.categories) && profile.categories.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Categorias</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.categories.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => setView({ name: 'category', slug: c.slug })}
                      className={cn('px-2 py-1 rounded text-xs font-bold', `bg-${c.color}-100 text-${c.color}-800 hover:opacity-80`)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Recent posts */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Posts recentes
                <span className="ml-auto text-sm font-normal text-zinc-500">{profile.recentPosts?.length || 0}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!profile.recentPosts || profile.recentPosts.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-6">Nenhum post publicado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {profile.recentPosts.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => setView({ name: 'article', slug: p.slug })}
                      className="flex gap-3 items-start p-2 hover:bg-zinc-50 rounded cursor-pointer"
                    >
                      {p.coverImage && (
                        <img src={p.coverImage} alt="" className="h-16 w-16 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-zinc-900 line-clamp-2 hover:text-primary transition-colors">{p.title}</div>
                        <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
                          <span className={cn('px-1.5 py-0.5 rounded font-bold', `bg-${p.category?.color || 'slate'}-100 text-${p.category?.color || 'slate'}-800`)}>
                            {p.category?.name}
                          </span>
                          <span>{new Date(p.publishedAt).toLocaleDateString('pt-BR')}</span>
                          <span>·</span>
                          <span>{p.views} views</span>
                        </div>
                        {p.excerpt && <p className="text-xs text-zinc-600 mt-1 line-clamp-2">{p.excerpt}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatRow({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-zinc-600">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="font-bold text-zinc-900">{value}</span>
    </div>
  )
}

import { CheckCircle2 } from 'lucide-react'
