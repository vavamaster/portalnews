'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Award, Coins, BookOpen, Heart, TrendingUp, ShoppingBag, LogOut, User as UserIcon,
  Clock, ArrowRight, Flame, Trophy, Star, Bookmark, UserPlus, BadgeCheck, Copy, Check,
  Loader2, Target, Sparkles, AlertCircle, ChevronRight, Library, GraduationCap,
  Megaphone, Users, CheckCircle2, Crown, Newspaper, Globe, Search, Trash2, Save
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { ImageTips } from '@/components/ui/image-tips'
import { UserAvatar } from '@/components/portal/UserAvatar'
import { cn, safeJsonArray, getColorClasses } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

export function ProfileView() {
  const { user, setView, logout, refreshUser, setUser, hydrated } = useAppStore()
  const { toast } = useToast()
  const [history, setHistory] = useState<any[]>([])
  const [favorites, setFavorites] = useState<any[]>([])
  const [savedSearches, setSavedSearches] = useState<any[]>([])
  const [achievements, setAchievements] = useState<{ achievements: any[]; earned: any[]; totalEarned: number; totalPossible: number; totalPointsEarned: number } | null>(null)
  const [referral, setReferral] = useState<any>(null)
  const [verification, setVerification] = useState<any>(null)
  const [stats, setStats] = useState({ totalReads: 0, totalReactions: 0, pointsEarned: 0 })
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', bio: '', avatar: '' })
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyForm, setVerifyForm] = useState({ type: 'CPF', document: '' })

  const load = async () => {
    if (!user) return
    try {
      const [histRes, favRes, achRes, refRes, verRes, ssRes] = await Promise.all([
        fetch('/api/reading'),
        fetch('/api/favorites'),
        fetch('/api/achievements'),
        fetch('/api/referral'),
        fetch('/api/verification'),
        fetch('/api/saved-searches'),
      ])
      const [histData, favData, achData, refData, verData, ssData] = await Promise.all([
        histRes.json(), favRes.json(), achRes.json(), refRes.json(), verRes.json(), ssRes.json(),
      ])
      setHistory(histData.history || [])
      setFavorites(favData.favorites || [])
      setSavedSearches(ssData.savedSearches || ssData.searches || [])
      setAchievements(achData)
      setReferral(refData)
      setVerification(verData)
      const totalReads = (histData.history || []).length
      const pointsEarned = (histData.history || []).reduce((acc: number, h: any) => acc + (h.points || 0), 0)
      setStats({ totalReads, totalReactions: 0, pointsEarned })
    } catch (e) {
      console.error(e)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [user?.id])

  if (!hydrated) return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 rounded-full border-4 border-zinc-200 border-t-primary animate-spin" /></div>
  if (!user) {
    return (
      <div className="news-container py-16 text-center">
        <UserIcon className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Faça login para ver seu perfil</h1>
        <p className="text-zinc-600 mb-6">Acompanhe seus pontos, créditos, conquistas e histórico.</p>
        <Button onClick={() => setView({ name: 'login' })} className="bg-primary">Entrar</Button>
      </div>
    )
  }

  const profileCompleteness = (() => {
    const checks = [
      { label: 'Nome', ok: !!user.name && user.name.length > 2 },
      { label: 'Avatar', ok: !!user.avatar },
      { label: 'Bio', ok: !!(user as any).bio },
      { label: 'CPF/CNPJ', ok: verification?.verificationStatus === 'VERIFIED' },
      { label: 'Plano ativo', ok: true }, // assumes any user has access
    ]
    const completed = checks.filter(c => c.ok).length
    return { pct: Math.round((completed / checks.length) * 100), missing: checks.filter(c => !c.ok).map(c => c.label) }
  })()

  const handleSaveProfile = async () => {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (data.error) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    } else {
      toast({ title: 'Perfil atualizado!' })
      if (data.user) {
        useAppStore.getState().setUser(data.user)
      }
      await refreshUser()
      setEditOpen(false)
      load()
    }
  }

  const handleVerify = async () => {
    const res = await fetch('/api/verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyForm),
    })
    const data = await res.json()
    if (data.error) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    } else {
      toast({ title: 'Verificação enviada!', description: 'Aguardando aprovação do administrador.' })
      setVerifyOpen(false)
      load()
    }
  }

  const copyReferralLink = async () => {
    if (!referral?.referralCode) return
    const link = `${window.location.origin}/?ref=${referral.referralCode}`
    try {
      await navigator.clipboard.writeText(link)
      toast({ title: 'Link copiado!', description: 'Compartilhe com seus amigos.' })
    } catch {}
  }

  return (
    <div className="news-container py-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 relative">
                <UserAvatar name={user.name} avatar={user.avatar} size="xl" />
                {verification?.verificationStatus === 'VERIFIED' && (
                  <BadgeCheck className="absolute bottom-0 right-0 h-7 w-7 text-blue-600 bg-white rounded-full border-2 border-white" />
                )}
              </div>
              <CardTitle className="text-xl flex items-center justify-center gap-1">
                {user.name}
                {verification?.verificationStatus === 'VERIFIED' && (
                  <BadgeCheck className="h-4 w-4 text-blue-600" />
                )}
              </CardTitle>
              <p className="text-sm text-zinc-500">{user.email}</p>
              {(user as any).bio && (
                <p className="text-xs text-zinc-500 mt-2 max-w-xs mx-auto italic">{(user as any).bio}</p>
              )}
              <div className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-accent text-accent-foreground">
                {user.role}
              </div>
              {verification?.verificationStatus === 'PENDING' && (
                <div className="mt-2 inline-block px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 font-medium">
                  Verificação pendente
                </div>
              )}
              {verification?.verificationStatus === 'NONE' && (
                <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setVerifyOpen(true)}>
                  <BadgeCheck className="h-4 w-4 mr-2" /> Verificar CPF/CNPJ
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-center">
                  <Award className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                  <div className="font-bold text-xl text-zinc-900">{user.points}</div>
                  <div className="text-xs text-zinc-600">Pontos</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-center">
                  <Coins className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                  <div className="font-bold text-xl text-zinc-900">{user.credits}</div>
                  <div className="text-xs text-zinc-600">Créditos</div>
                </div>
              </div>
              {user.checkInStreak !== undefined && user.checkInStreak > 0 && (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-md p-3 text-center">
                  <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                  <div className="font-bold text-xl text-zinc-900">{user.checkInStreak} dia(s)</div>
                  <div className="text-xs text-zinc-600">Sequência de check-in</div>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={() => { setEditForm({ name: user.name, bio: (user as any).bio || '', avatar: user.avatar || '' }); setEditOpen(true) }}>
                <UserIcon className="h-4 w-4 mr-2" /> Editar Perfil
              </Button>
              {(user.role === 'EDITOR' || user.role === 'ADMIN' || user.role === 'MASTER') && (
                <Button onClick={() => setView({ name: 'editor-bio-edit' })} variant="outline" className="w-full">
                  <Globe className="h-4 w-4 mr-2" /> Minha Bio Pública
                </Button>
              )}
              <Button onClick={() => setView({ name: 'credits' })} variant="outline" className="w-full">
                <Award className="h-4 w-4 mr-2" /> Pontos & Créditos
              </Button>
              <Button onClick={() => setView({ name: 'store' })} variant="outline" className="w-full">
                <ShoppingBag className="h-4 w-4 mr-2" /> Anuncie Grátis
              </Button>
              <Button onClick={async () => { await logout(); setView({ name: 'home' }) }} variant="ghost" className="w-full text-zinc-500">
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </Button>
            </CardContent>
          </Card>

          {/* Profile completeness */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Completude do Perfil</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 bg-zinc-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-500 rounded-full',
                      profileCompleteness.pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${profileCompleteness.pct}%` }}
                  />
                </div>
                <span className="font-bold text-sm">{profileCompleteness.pct}%</span>
              </div>
              {profileCompleteness.pct === 100 ? (
                <p className="text-xs text-emerald-700 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Perfil completo! +30 pontos concedidos.
                </p>
              ) : (
                <div className="text-xs text-zinc-600">
                  <p className="mb-1">Falta:</p>
                  <ul className="space-y-0.5">
                    {profileCompleteness.missing.map(m => <li key={m} className="flex items-center gap-1"><ArrowRight className="h-3 w-3" /> {m}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats + sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={BookOpen} label="Notícias Lidas" value={stats.totalReads} color="bg-blue-50 text-blue-600" />
            <StatCard icon={Heart} label="Reações" value={stats.totalReactions} color="bg-rose-50 text-rose-600" />
            <StatCard icon={Bookmark} label="Favoritos" value={favorites.length} color="bg-pink-50 text-pink-600" />
            <StatCard icon={Trophy} label="Conquistas" value={achievements?.totalEarned || 0} color="bg-amber-50 text-amber-600" />
          </div>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" /> Conquistas
                <span className="ml-auto text-sm font-normal text-zinc-500">
                  {achievements?.totalEarned || 0} / {achievements?.totalPossible || 0}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {achievements?.achievements.map((a: any) => {
                  const Icon = getAchievementIcon(a.icon)
                  const aColors = getColorClasses(a.color)
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'border rounded-lg p-3 text-center transition-all',
                        a.earned
                          ? `border-${a.color}-300 bg-${a.color}-50`
                          : 'border-zinc-200 bg-zinc-50 opacity-60'
                      )}
                      title={a.description}
                    >
                      <Icon className={cn('h-7 w-7 mx-auto mb-1', a.earned ? aColors.textSolid : 'text-zinc-400')} />
                      <div className="text-xs font-bold text-zinc-900 line-clamp-1">{a.name}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {a.pointsReward > 0 ? `+${a.pointsReward} pts` : 'Marco'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Referral */}
          {referral && (
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-emerald-600" /> Indique e Ganhe
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-700 mb-3">
                  Convide seus amigos para o portal. Quando eles publicarem o 1º anúncio, você ganha <strong>50 pontos</strong>!
                </p>
                <div className="bg-white border border-emerald-200 rounded-lg p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-zinc-500">Seu código de indicação:</div>
                    <div className="font-bold text-lg tracking-wider text-emerald-700">{referral.referralCode}</div>
                  </div>
                  <Button onClick={copyReferralLink} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <Copy className="h-3 w-3 mr-1" /> Copiar link
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-600">Amigos indicados: <strong>{referral.referralsCount}</strong></span>
                  {referral.referredBy && (
                    <span className="text-zinc-500 text-xs">Indicado por: <strong>{referral.referredBy.name}</strong></span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Favorites */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bookmark className="h-5 w-5 text-pink-500" /> Favoritos
                <span className="ml-auto text-sm font-normal text-zinc-500">{favorites.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {favorites.length === 0 ? (
                <div className="text-center py-6 text-zinc-500">
                  <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum anúncio favorito ainda.</p>
                  <Button onClick={() => setView({ name: 'classifieds' })} variant="link" className="mt-2">
                    Explorar classificados <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                  {favorites.map((f: any) => (
                    <div
                      key={f.id}
                      onClick={() => f.listing && setView({ name: 'classified', slug: f.listing.slug })}
                      className="flex gap-3 items-center p-2 rounded-md border border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                    >
                      {f.listing?.photos ? (
                        <img src={safeJsonArray<string>(f.listing.photos, [])[0]} alt="" className="h-12 w-12 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-12 w-12 rounded bg-zinc-100" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-zinc-900 line-clamp-1">{f.listing?.title || 'Removido'}</div>
                        <div className="text-xs text-zinc-500">{f.listing?.category?.name} · R$ {f.listing?.price?.toLocaleString('pt-BR') || '—'}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reading history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Histórico de Leitura
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-6 text-zinc-500">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Você ainda não leu nenhuma notícia.</p>
                  <Button onClick={() => setView({ name: 'home' })} variant="link" className="mt-2">
                    Explorar notícias <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                  {history.map((h: any) => (
                    <div
                      key={h.id}
                      onClick={() => h.post && setView({ name: 'article', slug: h.post.slug })}
                      className="flex gap-3 items-center p-2 rounded-md border border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                    >
                      {h.post?.coverImage && (
                        <img src={h.post.coverImage} alt="" className="h-12 w-12 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-zinc-900 line-clamp-2">{h.post?.title || 'Notícia removida'}</div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                          <span>{h.readPct}% lido</span>
                          {h.points > 0 && <span className="text-amber-600 font-medium">+{h.points} pontos</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saved searches */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-cyan-500" /> Buscas Salvas
                </span>
                <span className="text-sm font-normal text-zinc-500">{savedSearches.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {savedSearches.length === 0 ? (
                <div className="text-center py-6 text-sm text-zinc-500">
                  <Search className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                  <p className="mb-3">Nenhuma busca salva.</p>
                  <p className="text-xs text-zinc-400 mb-3">Quando você fizer uma busca na página de notícias, poderá salvá-la aqui para acessar rapidamente depois.</p>
                  <Button size="sm" variant="outline" onClick={() => setView({ name: 'home' })}>
                    Buscar notícias
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedSearches.map((s: any) => {
                    let filters: any = {}
                    try { filters = JSON.parse(s.filters) } catch {}
                    return (
                      <div key={s.id} className="flex items-center gap-2 p-2 hover:bg-zinc-50 rounded group">
                        <Search className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                        <button
                          onClick={() => setView({ name: 'search', q: filters.search || filters.q || '' })}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="text-sm font-medium text-zinc-900 truncate">{s.name}</div>
                          <div className="text-xs text-zinc-500 truncate">
                            {filters.search || filters.q ? `"${filters.search || filters.q}"` : '—'}
                            {filters.category && ` · ${filters.category}`}
                            {s.lastResultCount > 0 && ` · ${s.lastResultCount} resultado(s)`}
                          </div>
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                          onClick={async () => {
                            await fetch(`/api/saved-searches/${s.id}`, { method: 'DELETE' })
                            toast({ title: 'Busca removida' })
                            load()
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit profile dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} className="mt-1" placeholder="Conte um pouco sobre você..." />
            </div>
            <div>
              <Label>Avatar (recomendado: 200×200px, PNG ou JPG)</Label>
              <ImageTips context="general" className="mb-2" />
              <ImageUpload
                value={editForm.avatar}
                onChange={(url) => setEditForm({ ...editForm, avatar: url })}
                placeholder="URL do avatar ou faça upload"
              />
            </div>
            <Button onClick={handleSaveProfile} className="bg-primary w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verification dialog */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verificar CPF/CNPJ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">Após verificação, você recebe o <strong>selo verificado</strong> em todos seus anúncios e +50 pontos.</p>
            <div>
              <Label>Tipo de documento</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => setVerifyForm({ ...verifyForm, type: 'CPF' })}
                  className={cn('p-2 border rounded text-sm', verifyForm.type === 'CPF' ? 'border-primary bg-accent' : 'border-zinc-200')}
                >CPF (Pessoa Física)</button>
                <button
                  onClick={() => setVerifyForm({ ...verifyForm, type: 'CNPJ' })}
                  className={cn('p-2 border rounded text-sm', verifyForm.type === 'CNPJ' ? 'border-primary bg-accent' : 'border-zinc-200')}
                >CNPJ (Empresa)</button>
              </div>
            </div>
            <div>
              <Label>{verifyForm.type}</Label>
              <Input
                value={verifyForm.document}
                onChange={(e) => setVerifyForm({ ...verifyForm, document: e.target.value })}
                placeholder={verifyForm.type === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                className="mt-1"
              />
            </div>
            <Button onClick={handleVerify} className="bg-primary w-full">Enviar para verificação</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 text-center">
        <div className={`inline-flex items-center justify-center h-10 w-10 rounded-full ${color} mb-2`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="font-bold text-2xl text-zinc-900">{value}</div>
        <div className="text-xs text-zinc-500">{label}</div>
      </CardContent>
    </Card>
  )
}

const ACHIEVEMENT_ICONS: Record<string, any> = {
  BookOpen, Heart, Megaphone, Star, Bookmark, Flame, Trophy, Newspaper, Library, GraduationCap,
  UserPlus, Users, CheckCircle2, BadgeCheck, Crown, Award,
}

function getAchievementIcon(name: string) {
  return ACHIEVEMENT_ICONS[name] || Award
}