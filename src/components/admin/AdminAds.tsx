'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, Check, X, Eye, EyeOff, Clock, Megaphone,
  Search, Filter, AlertCircle, User as UserIcon,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ImageUpload } from './ImageUpload'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { LoadingSpinner } from '@/components/ui/skeleton'

const PLACEMENTS = [
  { value: 'HEADER_BANNER', label: 'Banner do Topo' },
  { value: 'HOME_TOP', label: 'Topo da Home' },
  { value: 'HOME_SIDEBAR', label: 'Sidebar da Home' },
  { value: 'HOME_MIDDLE', label: 'Meio da Home' },
  { value: 'HOME_INFEED', label: 'Home — Nativo (In-feed)' },
  { value: 'ARTICLE_TOP', label: 'Topo de Artigos' },
  { value: 'ARTICLE_MIDDLE', label: 'Meio de Artigos' },
  { value: 'ARTICLE_BOTTOM', label: 'Rodapé de Artigos' },
  { value: 'ARTICLE_SIDEBAR', label: 'Sidebar de Artigos' },
  { value: 'ARTICLE_INFEED', label: 'Anúncio Nativo (In-feed)' },
  { value: 'CATEGORY_SIDEBAR', label: 'Sidebar de Categorias' },
  { value: 'CATEGORY_TOP', label: 'Topo de Categoria' },
  { value: 'CATEGORY_BOTTOM', label: 'Base de Categoria' },
  { value: 'FOOTER_BANNER', label: 'Banner do Rodapé' },
]

const STATUS_TABS = [
  { value: 'ALL', label: 'Todos', color: 'text-zinc-600' },
  { value: 'PENDING', label: 'Aguardando', color: 'text-amber-600' },
  { value: 'ACTIVE', label: 'Ativos', color: 'text-emerald-600' },
  { value: 'PAUSED', label: 'Pausados', color: 'text-zinc-500' },
  { value: 'REJECTED', label: 'Rejeitados', color: 'text-red-600' },
  { value: 'EXPIRED', label: 'Expirados', color: 'text-zinc-400' },
]

// P0-4a fix: sanitize user-submitted ad HTML before rendering in the admin
// list. Strips <script>, <iframe>, <object>, <embed>, on* handlers and
// javascript: URLs.
function sanitizeAdHtml(html: string | null | undefined): string {
  if (!html) return ''
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
}

export function AdminAds() {
  const { toast } = useToast()
  const [ads, setAds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ads?status=ALL')
      const data = await res.json()
      setAds(data.ads || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const handleApprove = async (ad: any) => {
    const res = await fetch(`/api/ads/${ad.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    })
    if (res.ok) {
      toast({ title: 'Anúncio aprovado!' })
      load()
    }
  }

  const handleReject = async (ad: any) => {
    const res = await fetch(`/api/ads/${ad.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED', rejectionReason: rejectReason || 'Não atende às diretrizes' }),
    })
    if (res.ok) {
      toast({ title: 'Anúncio rejeitado' })
      setRejecting(null)
      setRejectReason('')
      load()
    }
  }

  const handlePause = async (ad: any) => {
    const res = await fetch(`/api/ads/${ad.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED' }),
    })
    if (res.ok) { toast({ title: 'Anúncio pausado' }); load() }
  }

  const handleActivate = async (ad: any) => {
    const res = await fetch(`/api/ads/${ad.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    })
    if (res.ok) { toast({ title: 'Anúncio ativado' }); load() }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/ads/${id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: 'Anúncio excluído' }); load() }
  }

  // Filter ads
  const filtered = ads.filter(ad => {
    if (statusFilter !== 'ALL' && ad.status !== statusFilter) return false
    if (search && !ad.title.toLowerCase().includes(search.toLowerCase()) && !ad.owner?.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pendingCount = ads.filter(a => a.status === 'PENDING').length
  const activeCount = ads.filter(a => a.status === 'ACTIVE').length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={ads.length} color="zinc" />
        <StatCard label="Aguardando" value={pendingCount} color="amber" icon={<Clock className="h-3.5 w-3.5" />} />
        <StatCard label="Ativos" value={activeCount} color="emerald" />
        <StatCard label="Impressões" value={ads.reduce((s, a) => s + (a.impressions || 0), 0)} color="blue" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap flex items-center gap-1',
                statusFilter === tab.value ? 'bg-white shadow-sm text-zinc-900' : tab.color
              )}
              style={{ fontWeight: statusFilter === tab.value ? 600 : 400 }}
            >
              {tab.label}
              {tab.value === 'PENDING' && pendingCount > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[9px] px-1 rounded-full">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou anunciante..."
            className="pl-10 h-9 text-sm"
          />
        </div>

        <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="bg-primary h-9">
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      {/* Pending moderation alert */}
      {pendingCount > 0 && statusFilter !== 'PENDING' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4" />
            <span><strong>{pendingCount}</strong> anúncio(s) aguardando aprovação</span>
          </div>
          <button onClick={() => setStatusFilter('PENDING')} className="text-xs text-amber-700 font-medium hover:underline">
            Revisar agora →
          </button>
        </div>
      )}

      {/* Ad list */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        {loading ? (
          <LoadingSpinner className="text-center justify-center" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Megaphone className="h-10 w-10 text-zinc-200 mx-auto mb-2" />
            <p>Nenhum anúncio encontrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map(ad => (
              <div key={ad.id} className="flex items-start gap-3 p-3 hover:bg-zinc-50">
                {/* Thumbnail */}
                <div className="w-20 h-16 rounded bg-zinc-100 overflow-hidden flex-shrink-0">
                  {ad.imageUrl ? (
                    <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Megaphone className="h-5 w-5 text-zinc-400" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm text-zinc-900 line-clamp-1">{ad.title}</div>
                    {ad.isFreeAd && <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-bold">CRÉDITOS</span>}
                    {!ad.isFreeAd && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">PAGO</span>}
                    <StatusBadge status={ad.status} />
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1" dangerouslySetInnerHTML={{ __html: sanitizeAdHtml(ad.content) }} />
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500 flex-wrap">
                    <span>{PLACEMENTS.find(p => p.value === ad.placement)?.label || ad.placement}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5"><UserIcon className="h-2.5 w-2.5" /> {ad.owner?.name || 'N/A'}</span>
                    <span>·</span>
                    <span>{ad.impressions || 0} imp.</span>
                    {ad.isFreeAd && ad.impressionLimit > 0 && (
                      <span className="text-blue-600 font-medium">
                        ({Math.max(0, ad.impressionLimit - ad.impressions)} restantes)
                      </span>
                    )}
                    <span>·</span>
                    <span>{ad.clicks || 0} cliques</span>
                    {ad.startAt && ad.endAt && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {new Date(ad.startAt).toLocaleDateString('pt-BR')} → {new Date(ad.endAt).toLocaleDateString('pt-BR')}</span>
                      </>
                    )}
                  </div>
                  {ad.rejectionReason && ad.status === 'REJECTED' && (
                    <div className="text-xs text-red-600 mt-1">Motivo: {ad.rejectionReason}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {ad.status === 'PENDING' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => handleApprove(ad)} className="text-emerald-600 hover:bg-emerald-50 h-8 w-8 p-0" title="Aprovar">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejecting(ad.id)} className="text-red-600 hover:bg-red-50 h-8 w-8 p-0" title="Rejeitar">
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {ad.status === 'ACTIVE' && (
                    <Button size="sm" variant="ghost" onClick={() => handlePause(ad)} className="h-8 w-8 p-0" title="Pausar">
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  )}
                  {ad.status === 'PAUSED' && (
                    <Button size="sm" variant="ghost" onClick={() => handleActivate(ad)} className="text-emerald-600 hover:bg-emerald-50 h-8 w-8 p-0" title="Ativar">
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {ad.status === 'REJECTED' && (
                    <Button size="sm" variant="ghost" onClick={() => handleApprove(ad)} className="text-emerald-600 hover:bg-emerald-50 h-8 w-8 p-0" title="Aprovar">
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(ad); setDialogOpen(true) }} className="h-8 w-8 p-0" title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 h-8 w-8 p-0" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir anúncio?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(ad.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject dialog */}
      {rejecting && (
        <Dialog open onOpenChange={(o) => !o && setRejecting(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Rejeitar anúncio</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Motivo da rejeição</Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ex: Conteúdo impróprio, imagem de baixa qualidade, etc."
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRejecting(null)}>Cancelar</Button>
                <Button className="bg-red-600 hover:bg-red-700" onClick={() => handleReject(ads.find(a => a.id === rejecting))}>
                  Rejeitar anúncio
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit/Create dialog */}
      <AdDialog open={dialogOpen} onOpenChange={setDialogOpen} ad={editing} onSaved={load} />
    </div>
  )
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon?: React.ReactNode }) {
  const colors: Record<string, string> = {
    zinc: 'bg-zinc-50 text-zinc-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return (
    <div className={cn('rounded-lg p-3', colors[color])}>
      <div className="text-xs opacity-70 flex items-center gap-1">{icon} {label}</div>
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
  }
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    ACTIVE: 'Ativo',
    PAUSED: 'Pausado',
    EXPIRED: 'Expirado',
    REJECTED: 'Rejeitado',
  }
  return <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', styles[status])}>{labels[status] || status}</span>
}

function AdDialog({ open, onOpenChange, ad, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; ad: any; onSaved: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState<any>({
    title: '', content: '', imageUrl: '', linkUrl: '',
    placement: 'HOME_SIDEBAR', status: 'ACTIVE',
    startAt: new Date().toISOString().slice(0, 10),
    endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  })

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (ad) {
      setForm({
        title: ad.title, content: ad.content, imageUrl: ad.imageUrl || '', linkUrl: ad.linkUrl || '',
        placement: ad.placement, status: ad.status,
        startAt: ad.startAt ? new Date(ad.startAt).toISOString().slice(0, 10) : '',
        endAt: ad.endAt ? new Date(ad.endAt).toISOString().slice(0, 10) : '',
      })
    } else {
      setForm({
        title: '', content: '', imageUrl: '', linkUrl: '',
        placement: 'HOME_SIDEBAR', status: 'ACTIVE',
        startAt: new Date().toISOString().slice(0, 10),
        endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      })
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [ad, open])

  const handleSave = async () => {
    if (!form.title || !form.placement) {
      toast({ title: 'Título e posicionamento obrigatórios', variant: 'destructive' })
      return
    }
    const url = ad ? `/api/ads/${ad.id}` : '/api/ads'
    const method = ad ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.error) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    } else {
      toast({ title: ad ? 'Anúncio atualizado!' : 'Anúncio criado!' })
      onOpenChange(false)
      onSaved()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ad ? 'Editar Anúncio' : 'Novo Anúncio'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Título *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Conteúdo (HTML ok)</Label>
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Imagem do anúncio</Label>
            <ImageUpload
              value={form.imageUrl || ''}
              onChange={(url) => setForm({ ...form, imageUrl: url })}
              placeholder="URL da imagem ou faça upload"
            />
          </div>
          <div>
            <Label className="text-sm">Link de destino</Label>
            <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-sm">Posicionamento</Label>
              <Select value={form.placement} onValueChange={(v) => setForm({ ...form, placement: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLACEMENTS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="PAUSED">Pausado</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="REJECTED">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-sm">Início</Label>
              <Input type="date" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Fim</Label>
              <Input type="date" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-primary">Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
