'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, getColorClasses, safeJsonArray, formatDate } from '@/lib/utils'
import {
  Check, X, Eye, EyeOff, Trash2, Loader2, Search, Store, ExternalLink,
  Flame, Star, Mail, Phone, MapPin, Calendar, User as UserIcon, Building2, MessageCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'
import { getPlanConfig } from '@/lib/plans'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { useApiError } from '@/hooks/use-api-error'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const STATUS_TABS = [
  { value: 'ALL', label: 'Todos', color: 'text-zinc-600' },
  { value: 'ACTIVE', label: 'Ativos', color: 'text-emerald-600' },
  { value: 'PENDING', label: 'Pendentes', color: 'text-amber-600' },
  { value: 'PAUSED', label: 'Pausados', color: 'text-zinc-500' },
  { value: 'EXPIRED', label: 'Expirados', color: 'text-red-600' },
  { value: 'REJECTED', label: 'Rejeitados', color: 'text-red-600' },
  { value: 'SOLD', label: 'Vendidos', color: 'text-blue-600' },
]

interface Listing {
  id: string; slug: string; title: string; description: string
  price: number | null; isNegotiable: boolean
  personType: string; businessName?: string | null; document?: string | null
  phone?: string | null; whatsapp?: string | null; email?: string | null; website?: string | null
  address?: string | null; city?: string | null; state?: string | null
  photos?: string | null; logoUrl?: string | null
  featured: boolean; boosted: boolean; boostedUntil?: string | null; featuredUntil?: string | null
  views: number; contactsCount: number
  publishedAt?: string | null; expiresAt?: string | null; createdAt: string
  status: string
  category: { id: string; slug: string; name: string; icon: string; color: string }
  owner: { id: string; name: string; email: string; avatar?: string | null }
  plan: { id: string; slug: string; name: string }
  _count?: { leads: number; reviews: number }
}

export function AdminClassifieds() {
  const { toast } = useToast()
  const apiError = useApiError()
  const { setView } = useAppStore()
  const [data, setData] = useState<{ listings: Listing[]; total: number; byStatus: Record<string, number>; byPlan: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [categories, setCategories] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [detailsOpen, setDetailsOpen] = useState<Listing | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      if (search) params.set('search', search)
      if (planFilter !== 'ALL') params.set('plan', planFilter)
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter)
      const res = await fetch(`/api/admin/classifieds?${params.toString()}`)
      const d = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          apiError('Faça login novamente', 'Sessão expirada')
          setView({ name: 'login' })
          return
        }
        apiError(d.error || 'Falha ao carregar')
        return
      }
      setData(d)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/classified-categories').then(r => r.json()),
      fetch('/api/plans').then(r => r.json()),
    ]).then(([cats, plansData]) => {
      setCategories(cats.categories || [])
      setPlans(plansData.plans || [])
    })
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [statusFilter, search, planFilter, categoryFilter])

  const handleAction = async (id: string, action: 'activate' | 'pause' | 'reject' | 'feature' | 'unfeature' | 'markSold') => {
    if (action === 'feature') {
      const target = listings.find(l => l.id === id)
      const allowFeatured = target ? (getPlanConfig(target.plan.slug)?.allowFeatured ?? false) : false
      if (!allowFeatured) {
        apiError(`Plano ${target?.plan.name || ''} não suporta destaque. Faça upgrade do usuário primeiro.`)
        return
      }
    }
    const updates: Record<string, any> = {
      activate: { status: 'ACTIVE' },
      pause: { status: 'PAUSED' },
      reject: { status: 'REJECTED' },
      markSold: { status: 'SOLD' },
      feature: { featured: true, featuredUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() },
      unfeature: { featured: false, featuredUntil: null },
    }
    const res = await fetch(`/api/admin/classifieds/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates[action]),
    })
    if (res.ok) {
      const labels: Record<string, string> = {
        activate: 'Anúncio ativado',
        pause: 'Anúncio pausado',
        reject: 'Anúncio rejeitado',
        feature: 'Anúncio destacado por 15 dias',
        unfeature: 'Destaque removido',
        markSold: 'Anúncio marcado como vendido',
      }
      toast({ title: labels[action] })
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      apiError(d.error)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/classifieds/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Anúncio excluído permanentemente' })
      load()
    } else {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  const listings = data?.listings || []
  const byStatus = data?.byStatus || {}
  const byPlan = data?.byPlan || []
  const total = data?.total || 0

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={total} color="zinc" />
        <StatCard label="Ativos" value={byStatus.ACTIVE || 0} color="emerald" />
        <StatCard label="Pendentes" value={byStatus.PENDING || 0} color="amber" />
        <StatCard label="Pausados" value={byStatus.PAUSED || 0} color="zinc" />
        <StatCard label="Expirados" value={byStatus.EXPIRED || 0} color="red" />
        <StatCard label="Vendidos" value={byStatus.SOLD || 0} color="blue" />
      </div>

      {/* By plan breakdown */}
      {byPlan.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-2">Distribuição por plano</div>
          <div className="flex flex-wrap gap-2">
            {byPlan.map((p: any) => (
              <span key={p.planSlug} className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded">
                {p.planName}: <strong>{p.count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap',
                statusFilter === tab.value ? 'bg-white shadow-sm text-zinc-900' : tab.color
              )}
              style={{ fontWeight: statusFilter === tab.value ? 600 : 400 }}
            >
              {tab.label}
              {byStatus[tab.value] > 0 && tab.value !== 'ALL' && (
                <span className="ml-1 text-[10px] opacity-70">({byStatus[tab.value]})</span>
              )}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou descrição..."
            className="pl-10 h-9 text-sm"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas categorias</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Plano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos planos</SelectItem>
            {plans.map(p => <SelectItem key={p.id} value={p.slug}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        {loading ? (
          <LoadingSpinner className="text-center justify-center" />
        ) : listings.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Store className="h-10 w-10 text-zinc-200 mx-auto mb-2" />
            <p>Nenhum anúncio encontrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {listings.map((l) => {
              const photos: string[] = safeJsonArray<string>(l.photos, [])
              const cover = photos[0]
              const isBoosted = l.boosted && l.boostedUntil && new Date(l.boostedUntil) > new Date()
              const isFeatured = l.featured && l.featuredUntil && new Date(l.featuredUntil) > new Date()
              const catColors = getColorClasses(l.category.color)
              const planColorMap: Record<string, string> = { FREE: 'zinc', PROFESSIONAL: 'blue', COMPANY: 'amber', PREMIUM: 'purple' }
              const planColors = getColorClasses(planColorMap[l.plan.slug] || 'zinc')
              return (
                <div key={l.id} className="flex items-start gap-3 p-3 hover:bg-zinc-50">
                  <div className="w-20 h-16 rounded bg-zinc-100 overflow-hidden flex-shrink-0">
                    {cover ? (
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store className="h-5 w-5 text-zinc-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setDetailsOpen(l)}
                        className="font-medium text-sm text-zinc-900 hover:text-amber-700 line-clamp-1 text-left"
                      >
                        {l.title}
                      </button>
                      <StatusBadge status={l.status} />
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-bold', planColors.bg, planColors.text)}>{l.plan.name}</span>
                      {isFeatured && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500 text-white rounded font-bold flex items-center gap-0.5"><Star className="h-2.5 w-2.5" /> DESTAQUE</span>}
                      {isBoosted && <span className="text-[10px] px-1.5 py-0.5 bg-purple-600 text-white rounded font-bold flex items-center gap-0.5"><Flame className="h-2.5 w-2.5" /> BOOST</span>}
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5">
                      {l.price !== null ? (
                        <span className="font-bold text-amber-700">R$ {l.price.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                      ) : <span className="text-zinc-400">Preço a combinar</span>}
                      {l.isNegotiable && <span className="text-zinc-400 ml-1">(negociável)</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500 flex-wrap">
                      <span className={cn('px-1.5 py-0.5 rounded font-bold', catColors.bg, catColors.text)}>{l.category.name}</span>
                      <span className="flex items-center gap-0.5">
                        {l.personType === 'PJ' ? <Building2 className="h-2.5 w-2.5" /> : <UserIcon className="h-2.5 w-2.5" />}
                        {l.businessName || l.owner.name}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" /> {l.owner.email}</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" /> {l.views} views</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="h-2.5 w-2.5" /> {l._count?.leads || 0} msgs</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" /> {formatDate(l.createdAt, 'short')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Status actions */}
                    {l.status === 'ACTIVE' && (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(l.id, 'pause')} className="h-8 w-8 p-0" title="Pausar">
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    )}
                    {(l.status === 'PAUSED' || l.status === 'PENDING' || l.status === 'REJECTED' || l.status === 'EXPIRED') && (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(l.id, 'activate')} className="text-emerald-600 hover:bg-emerald-50 h-8 w-8 p-0" title="Ativar">
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {l.status !== 'REJECTED' && l.status !== 'SOLD' && (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(l.id, 'reject')} className="text-red-600 hover:bg-red-50 h-8 w-8 p-0" title="Rejeitar">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {l.status !== 'SOLD' && (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(l.id, 'markSold')} className="text-blue-600 hover:bg-blue-50 h-8 w-8 p-0" title="Marcar vendido">
                        <Check className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Feature toggle */}
                    {isFeatured ? (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(l.id, 'unfeature')} className="text-amber-600 hover:bg-amber-50 h-8 w-8 p-0" title="Remover destaque">
                        <Star className="h-4 w-4 fill-amber-500" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(l.id, 'feature')} className="h-8 w-8 p-0" title="Destacar 15 dias">
                        <Star className="h-4 w-4" />
                      </Button>
                    )}

                    {/* View public */}
                    <Button size="sm" variant="ghost" onClick={() => setView({ name: 'classified', slug: l.slug })} className="h-8 w-8 p-0" title="Ver no portal">
                      <ExternalLink className="h-4 w-4" />
                    </Button>

                    {/* Delete */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 h-8 w-8 p-0" title="Excluir permanentemente">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir anúncio permanentemente?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{l.title}" será removido do banco de dados. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(l.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Details dialog */}
      <Dialog open={!!detailsOpen} onOpenChange={(o) => !o && setDetailsOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailsOpen && <ListingDetails listing={detailsOpen} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ListingDetails({ listing: l }: { listing: Listing }) {
  const photos: string[] = safeJsonArray<string>(l.photos, [])
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">
          <Store className="h-4 w-4" /> Detalhes do anúncio
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        {photos[0] && (
          <img src={photos[0]} alt="" className="w-full aspect-video object-cover rounded" />
        )}
        <div>
          <h3 className="font-bold text-lg text-zinc-900">{l.title}</h3>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {l.price !== null ? `R$ ${l.price.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` : 'Preço a combinar'}
            {l.isNegotiable && <span className="text-xs text-zinc-500 ml-2">(negociável)</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Status"><StatusBadge status={l.status} /></InfoRow>
          <InfoRow label="Plano"><span className="font-medium">{l.plan.name}</span></InfoRow>
          <InfoRow label="Categoria"><span className="font-medium">{l.category.name}</span></InfoRow>
          <InfoRow label="Tipo"><span className="font-medium">{l.personType === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}</span></InfoRow>
          <InfoRow label="Views"><span className="font-medium">{l.views}</span></InfoRow>
          <InfoRow label="Mensagens"><span className="font-medium">{l._count?.leads || 0}</span></InfoRow>
          <InfoRow label="Avaliações"><span className="font-medium">{l._count?.reviews || 0}</span></InfoRow>
          <InfoRow label="Criado em"><span className="font-medium">{formatDate(l.createdAt, 'datetime')}</span></InfoRow>
          {l.publishedAt && <InfoRow label="Publicado em"><span className="font-medium">{formatDate(l.publishedAt, 'short')}</span></InfoRow>}
          {l.expiresAt && <InfoRow label="Expira em"><span className="font-medium">{formatDate(l.expiresAt, 'short')}</span></InfoRow>}
          {l.featuredUntil && <InfoRow label="Destaque até"><span className="font-medium text-amber-700">{formatDate(l.featuredUntil, 'short')}</span></InfoRow>}
          {l.boostedUntil && <InfoRow label="Boost até"><span className="font-medium text-purple-700">{formatDate(l.boostedUntil, 'short')}</span></InfoRow>}
        </div>

        {/* Owner */}
        <div className="border-t border-zinc-100 pt-3">
          <div className="text-xs uppercase text-zinc-500 mb-2">Anunciante</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoRow label="Nome"><span className="font-medium">{l.owner.name}</span></InfoRow>
            <InfoRow label="Email"><span className="font-medium">{l.owner.email}</span></InfoRow>
            {l.businessName && <InfoRow label="Empresa"><span className="font-medium">{l.businessName}</span></InfoRow>}
            {l.document && <InfoRow label="Doc"><span className="font-medium">{l.document}</span></InfoRow>}
            {l.phone && <InfoRow label="Telefone"><span className="font-medium">{l.phone}</span></InfoRow>}
            {l.whatsapp && <InfoRow label="WhatsApp"><span className="font-medium">{l.whatsapp}</span></InfoRow>}
            {l.city && <InfoRow label="Cidade"><span className="font-medium">{l.city}/{l.state}</span></InfoRow>}
          </div>
        </div>

        {/* Description */}
        <div className="border-t border-zinc-100 pt-3">
          <div className="text-xs uppercase text-zinc-500 mb-2">Descrição</div>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{l.description}</p>
        </div>

        {/* Gallery */}
        {photos.length > 1 && (
          <div className="border-t border-zinc-100 pt-3">
            <div className="text-xs uppercase text-zinc-500 mb-2">Fotos ({photos.length})</div>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <img key={i} src={p} alt="" className="aspect-square object-cover rounded" />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-zinc-400 tracking-wider">{label}</div>
      <div>{children}</div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    zinc: 'bg-zinc-50 text-zinc-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className={cn('rounded-lg p-3', colors[color])}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-xl font-numeric mt-0.5" style={{ fontWeight: 700 }}>{value.toLocaleString('pt-BR')}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    ACTIVE: 'bg-emerald-100 text-emerald-800',
    PAUSED: 'bg-zinc-100 text-zinc-700',
    EXPIRED: 'bg-red-100 text-red-800',
    REJECTED: 'bg-red-100 text-red-800',
    SOLD: 'bg-blue-100 text-blue-800',
  }
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    ACTIVE: 'Ativo',
    PAUSED: 'Pausado',
    EXPIRED: 'Expirado',
    REJECTED: 'Rejeitado',
    SOLD: 'Vendido',
  }
  return <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', styles[status])}>{labels[status] || status}</span>
}
