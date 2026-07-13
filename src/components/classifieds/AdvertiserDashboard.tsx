'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn, getColorClasses, safeJsonArray } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft, Plus, Eye, MessageCircle, Star, Clock, Flame, Pencil, Trash2,
  TrendingUp, Mail, Phone, MessageSquare, Loader2, Store, Award, Sparkles, AlertCircle,
  MailOpen, MailCheck, Pause, Play, CheckCircle2, Rocket
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Lead {
  id: string; senderName: string; senderEmail?: string | null; senderPhone?: string | null
  subject?: string | null; message: string; channel: string; isRead: boolean; isReplied: boolean
  createdAt: string
  listing: { id: string; title: string; slug: string; category: any }
}

export function AdvertiserDashboard() {
  const { user, setView, hydrated } = useAppStore()
  const { toast } = useToast()
  const [data, setData] = useState<any>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [mineRes, leadsRes] = await Promise.all([
        fetch('/api/classifieds/mine'),
        fetch('/api/leads?mode=received'),
      ])
      const [mineData, leadsData] = await Promise.all([mineRes.json(), leadsRes.json()])
      setData(mineData)
      setLeads(leadsData.leads || [])
    } finally { setLoading(false) }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  if (!hydrated) return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 rounded-full border-4 border-zinc-200 border-t-primary animate-spin" /></div>
  if (!user) {
    return (
      <div className="news-container py-16 text-center">
        <AlertCircle className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Faça login para ver seu painel</h1>
        <Button onClick={() => setView({ name: 'login' })} className="bg-amber-600 hover:bg-amber-700 mt-3">Entrar</Button>
      </div>
    )
  }

  if (loading) {
    return <div className="news-container py-12 text-center flex items-center justify-center gap-2 text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
  }

  const { listings, subscription, stats, leadsByDay } = data || {}

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/classifieds/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Anúncio excluído' })
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: 'Erro', description: d.error || 'Falha na operação', variant: 'destructive' })
    }
  }

  const handleMarkRead = async (leadId: string) => {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    })
    if (res.ok) {
      toast({ title: 'Mensagem marcada como lida' })
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: 'Erro', description: d.error || 'Falha na operação', variant: 'destructive' })
    }
    load()
  }

  const handleMarkReplied = async (leadId: string) => {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isReplied: true, isRead: true }),
    })
    if (res.ok) {
      toast({ title: 'Mensagem marcada como respondida' })
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: 'Erro', description: d.error || 'Falha na operação', variant: 'destructive' })
    }
    load()
  }

  const handleListingAction = async (id: string, status: 'ACTIVE' | 'PAUSED' | 'SOLD') => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/classifieds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && !d.error) {
        const labels: Record<string, string> = {
          ACTIVE: 'Anúncio reativado',
          PAUSED: 'Anúncio pausado',
          SOLD: 'Anúncio marcado como vendido',
        }
        toast({ title: labels[status] })
        load()
      } else {
        toast({ title: 'Erro', description: d.error || 'Falha na operação', variant: 'destructive' })
      }
    } finally {
      setActionLoading(null)
    }
  }

  const unreadLeads = leads.filter(l => !l.isRead).length

  const atLimit = !!subscription && subscription.plan.maxListings !== -1 && (subscription.listingsUsedThisCycle || 0) >= subscription.plan.maxListings
  const canUsePoints = !!subscription?.plan.allowPoints && (user?.points || 0) >= (subscription?.plan.pointsPerListing || 0)
  const blocked = atLimit && !canUsePoints

  return (
    <div className="news-container py-6 animate-fade-in">
      <button onClick={() => setView({ name: 'classifieds' })} className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-amber-600 mb-4">
        <ChevronLeft className="h-4 w-4" /> Voltar aos classificados
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-black text-3xl text-zinc-900 flex items-center gap-2">
            <Store className="h-7 w-7 text-amber-600" /> Painel do Anunciante
          </h1>
          <p className="text-zinc-600 text-sm mt-1">
            {subscription ? (
              <>Plano <strong className="text-amber-600">{subscription.plan.name}</strong> · {subscription.listingsUsedThisCycle} anúncios no ciclo · Renova em {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}</>
            ) : (
              <>Sem plano ativo. Escolha um plano para anunciar.</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView({ name: 'plans' })}>
            <Sparkles className="h-4 w-4 mr-2" /> Planos
          </Button>
          <Button onClick={() => setView({ name: 'classified-editor' })} className="bg-amber-600 hover:bg-amber-700" disabled={blocked} title={blocked ? 'Limite do plano atingido — faça upgrade ou use pontos' : undefined}>
            <Plus className="h-4 w-4 mr-2" /> Novo anúncio
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Store} label="Anúncios ativos" value={stats?.activeListings || 0} color="bg-amber-50 text-amber-600" />
        <StatCard icon={Eye} label="Total de views" value={stats?.totalViews || 0} color="bg-blue-50 text-blue-600" />
        <StatCard icon={MessageCircle} label="Mensagens" value={stats?.totalLeads || 0} color="bg-purple-50 text-purple-600" badge={unreadLeads > 0 ? unreadLeads : undefined} />
        <StatCard icon={Star} label="Avaliações" value={stats?.totalReviews || 0} color="bg-rose-50 text-rose-600" />
        <StatCard icon={Award} label="Seus pontos" value={user.points} color="bg-emerald-50 text-emerald-600" />
      </div>

      {!subscription && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <div className="font-bold text-amber-900">Você ainda não tem um plano ativo</div>
              <div className="text-sm text-amber-700">Escolha o plano Grátis (1 anúncio + uso de pontos) ou um plano pago para mais recursos.</div>
            </div>
            <Button onClick={() => setView({ name: 'plans' })} className="bg-amber-600 hover:bg-amber-700">Ver planos</Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">Meus anúncios ({listings?.length || 0})</TabsTrigger>
          <TabsTrigger value="leads">
            Mensagens ({leads.length})
            {unreadLeads > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{unreadLeads}</span>}
          </TabsTrigger>
          {subscription?.plan?.allowAnalytics && (
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          )}
        </TabsList>

        {/* Listings tab */}
        <TabsContent value="listings" className="space-y-3">
          {listings?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                <h3 className="font-bold text-lg text-zinc-900 mb-1">Você ainda não tem anúncios</h3>
                <p className="text-zinc-600 mb-4">Crie seu primeiro anúncio nos classificados.</p>
                <Button onClick={() => setView({ name: 'classified-editor' })} className="bg-amber-600 hover:bg-amber-700">
                  <Plus className="h-4 w-4 mr-2" /> Criar anúncio
                </Button>
              </CardContent>
            </Card>
          ) : (
            listings?.map((l: any) => {
              const photos = safeJsonArray<string>(l.photos, [])
              const isBoosted = l.boosted && l.boostedUntil && new Date(l.boostedUntil) > new Date()
              const catColors = getColorClasses(l.category.color)
              return (
                <Card key={l.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-20 h-20 rounded bg-zinc-100 overflow-hidden flex-shrink-0">
                      {photos[0] && <img src={photos[0]} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-sm text-zinc-900 line-clamp-1">{l.title}</div>
                        {l.featured && <Badge className="bg-amber-500">Destaque</Badge>}
                        {isBoosted && <Badge className="bg-purple-600">Boost</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                        <span className={cn('px-1.5 py-0.5 rounded font-bold', catColors.bg, catColors.text)}>
                          {l.category.name}
                        </span>
                        <span>{l.plan.name}</span>
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {l.views}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {l._count?.leads || 0}</span>
                        <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {l._count?.reviews || 0}</span>
                        <StatusBadge status={l.status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setView({ name: 'classified', slug: l.slug })} title="Ver">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setView({ name: 'classified-editor', id: l.id })} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {l.status === 'ACTIVE' && (
                        <Button size="icon" variant="ghost" onClick={() => handleListingAction(l.id, 'PAUSED')} disabled={actionLoading === l.id} title="Pausar">
                          {actionLoading === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                        </Button>
                      )}
                      {l.status === 'PAUSED' && (
                        <Button size="icon" variant="ghost" onClick={() => handleListingAction(l.id, 'ACTIVE')} disabled={actionLoading === l.id} title="Reativar" className="text-emerald-600">
                          {actionLoading === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        </Button>
                      )}
                      {(l.status === 'ACTIVE' || l.status === 'PAUSED') && (
                        <Button size="icon" variant="ghost" onClick={() => handleListingAction(l.id, 'SOLD')} disabled={actionLoading === l.id} title="Marcar vendido" className="text-blue-600">
                          {actionLoading === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                      )}
                      {l.status === 'ACTIVE' && l.plan?.allowBoost && (
                        <Button size="icon" variant="ghost" onClick={() => setView({ name: 'classified', slug: l.slug })} title="Impulsionar" className="text-purple-600">
                          <Rocket className="h-4 w-4" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50" title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir anúncio?</AlertDialogTitle>
                            <AlertDialogDescription>"{l.title}" será removido permanentemente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(l.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* Leads tab */}
        <TabsContent value="leads" className="space-y-3">
          {leads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                <h3 className="font-bold text-lg text-zinc-900 mb-1">Nenhuma mensagem ainda</h3>
                <p className="text-zinc-600">Quando alguém enviar uma mensagem nos seus anúncios, ela aparecerá aqui.</p>
              </CardContent>
            </Card>
          ) : (
            leads.map((lead) => (
              <Card key={lead.id} className={cn(!lead.isRead && 'border-amber-300 bg-amber-50')}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold flex-shrink-0">
                      {lead.senderName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-sm">{lead.senderName}</div>
                        {!lead.isRead && <Badge className="bg-amber-500 text-white">Nova</Badge>}
                        {lead.isReplied && <Badge className="bg-emerald-500 text-white">Respondida</Badge>}
                        <ChannelBadge channel={lead.channel} />
                        <div className="text-xs text-zinc-500 ml-auto">{new Date(lead.createdAt).toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Anúncio: <button onClick={() => setView({ name: 'classified', slug: lead.listing.slug })} className="text-amber-600 hover:underline">{lead.listing.title}</button>
                      </div>
                      {lead.subject && <div className="text-sm font-medium mt-2">{lead.subject}</div>}
                      <div className="text-sm text-zinc-700 mt-1">{lead.message}</div>
                      {lead.senderEmail && (
                        <div className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {lead.senderEmail}
                          {lead.senderPhone && <><span className="mx-1">·</span><Phone className="h-3 w-3" /> {lead.senderPhone}</>}
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        {!lead.isRead && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkRead(lead.id)}>
                            <MailOpen className="h-3 w-3 mr-1" /> Marcar como lida
                          </Button>
                        )}
                        {!lead.isReplied && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkReplied(lead.id)}>
                            <MailCheck className="h-3 w-3 mr-1" /> Marcar como respondida
                          </Button>
                        )}
                        {lead.senderEmail && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={`mailto:${lead.senderEmail}?subject=Re: ${lead.subject || lead.listing.title}`}>
                              <Mail className="h-3 w-3 mr-1" /> Responder por email
                            </a>
                          </Button>
                        )}
                        {lead.senderPhone && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={`tel:${lead.senderPhone}`}>
                              <Phone className="h-3 w-3 mr-1" /> Ligar
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Analytics tab */}
        {subscription?.plan?.allowAnalytics && (
          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Mensagens recebidas (últimos 7 dias)</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-32">
                  {leadsByDay?.map((d: any) => {
                    const max = Math.max(...(leadsByDay || []).map((x: any) => x.count), 1)
                    const height = (d.count / max) * 100
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-xs font-bold text-zinc-700">{d.count}</div>
                        <div className="w-full bg-amber-500 rounded-t" style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }} />
                        <div className="text-[10px] text-zinc-500">{new Date(d.date).toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Resumo de desempenho</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div><div className="font-black text-2xl text-amber-600">{stats?.totalViews || 0}</div><div className="text-xs text-zinc-500">Views totais</div></div>
                  <div><div className="font-black text-2xl text-purple-600">{stats?.totalLeads || 0}</div><div className="text-xs text-zinc-500">Mensagens</div></div>
                  <div><div className="font-black text-2xl text-rose-600">{stats?.totalReviews || 0}</div><div className="text-xs text-zinc-500">Avaliações</div></div>
                  <div><div className="font-black text-2xl text-emerald-600">{stats?.totalListings || 0}</div><div className="text-xs text-zinc-500">Anúncios</div></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, badge }: { icon: any; label: string; value: number; color: string; badge?: number }) {
  return (
    <Card>
      <CardContent className="pt-4 relative">
        {badge !== undefined && badge > 0 && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">{badge}</span>
        )}
        <div className={`inline-flex items-center justify-center h-9 w-9 rounded-full ${color} mb-1`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="font-bold text-xl text-zinc-900">{value.toLocaleString('pt-BR')}</div>
        <div className="text-xs text-zinc-500">{label}</div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-800',
    PENDING: 'bg-amber-100 text-amber-800',
    PAUSED: 'bg-zinc-100 text-zinc-700',
    EXPIRED: 'bg-red-100 text-red-800',
    SOLD: 'bg-blue-100 text-blue-800',
  }
  const labels: Record<string, string> = {
    ACTIVE: 'Ativo', PENDING: 'Pendente', PAUSED: 'Pausado', EXPIRED: 'Expirado', SOLD: 'Vendido',
  }
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${styles[status]}`}>{labels[status] || status}</span>
}

function ChannelBadge({ channel }: { channel: string }) {
  const labels: Record<string, string> = { PANEL: 'Painel', WHATSAPP: 'WhatsApp', PHONE: 'Telefone', EMAIL: 'Email' }
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700">{labels[channel] || channel}</span>
}
