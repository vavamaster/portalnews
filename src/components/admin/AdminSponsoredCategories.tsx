'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Loader2, Save, Megaphone, Crown, RefreshCw, CheckCircle, XCircle, Clock,
  Plus, Trash2, Edit, ExternalLink, AlertCircle, Building2, CreditCard,
  ChevronLeft,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { notifyPortalUpdate } from '@/lib/portal-sync'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { useApiError } from '@/hooks/use-api-error'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { UserSearchInput } from '@/components/admin/UserSearchInput'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { ImageTips } from '@/components/ui/image-tips'

interface CategoryRow {
  id: string
  slug: string
  name: string
  color: string | null
  icon: string | null
  postCount: number
  sponsor: any | null
}

export function AdminSponsoredCategories() {
  const { toast } = useToast()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CategoryRow | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/sponsored-categories')
      const data = await r.json()
      setCategories(data.categories || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  if (loading) {
    return <LoadingSpinner />
  }

  // === EDITOR VIEW (replaces list when a category is selected) ===
  if (editing) {
    return (
      <div className="space-y-3">
        {/* Back button + title */}
        <div className="flex items-center justify-between gap-3 py-2">
          <button
            onClick={() => { setEditing(null); load() }}
            className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar para lista
          </button>
          <h3 className="font-bold text-zinc-900 text-sm truncate">{editing.name}</h3>
        </div>
        <SponsorEditor category={editing} onSaved={() => { setEditing(null); load() }} />
      </div>
    )
  }

  // === LIST VIEW ===
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Total" value={categories.length} tone="zinc" />
        <StatCard label="Ativos" value={categories.filter(c => c.sponsor?.isActive && c.sponsor?.hasActiveCycle).length} tone="emerald" />
        <StatCard label="Exclusivos" value={categories.filter(c => c.sponsor?.mode === 'EXCLUSIVE').length} tone="amber" />
        <StatCard label="Rotativos" value={categories.filter(c => c.sponsor?.mode === 'ROTATING').length} tone="blue" />
      </div>

      {/* Categories list */}
      <div className="space-y-2">
        {categories.map(c => (
          <CategoryCard key={c.id} category={c} onEdit={() => setEditing(c)} />
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'zinc' | 'emerald' | 'amber' | 'blue' }) {
  const tones: Record<string, string> = {
    zinc: 'bg-white border-zinc-200 text-zinc-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
  }
  return (
    <div className={cn('border rounded-lg p-3 text-center', tones[tone])}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  )
}

function CategoryCard({ category, onEdit }: { category: CategoryRow; onEdit: () => void }) {
  const sponsor = category.sponsor
  return (
    <div className={cn(
      'bg-white border rounded-lg p-4 flex items-center gap-4',
      sponsor?.isActive && sponsor?.hasActiveCycle ? 'border-emerald-200' : 'border-zinc-200',
    )}>
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-white flex-shrink-0', `bg-${category.color || 'slate'}-500`)}>
        <Megaphone className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-bold text-zinc-900">{category.name}</div>
          <Badge variant="outline" className="text-[10px]">{category.postCount} posts</Badge>
          {!sponsor && <Badge variant="outline" className="text-[10px] bg-zinc-50">Sem patrocínio</Badge>}
          {sponsor?.mode === 'EXCLUSIVE' && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200"><Crown className="h-3 w-3 mr-1" />Exclusivo</Badge>}
          {sponsor?.mode === 'ROTATING' && <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">Rotativo</Badge>}
          {sponsor?.isActive && sponsor?.hasActiveCycle && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1" />Ativo</Badge>}
          {sponsor && (!sponsor.isActive || !sponsor.hasActiveCycle) && <Badge className="text-[10px] bg-zinc-100 text-zinc-600">Pausado</Badge>}
        </div>
        {sponsor && (
          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-3 flex-wrap">
            <span>{sponsor.billingType === 'MONTHLY' ? `R$ ${(sponsor.billingValueCents / 100).toFixed(2)}/mês` : `${sponsor.billingImpressions} impressões`}</span>
            {sponsor.ads?.length > 0 && <span>{sponsor.ads.length} anúncio(s)</span>}
            {sponsor.landingPage && <span className="text-amber-600">Landing page: /empresa/{sponsor.landingPage.slug}</span>}
            {sponsor.commercialContactName && <span>Comercial: {sponsor.commercialContactName}</span>}
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Edit className="h-4 w-4 mr-1" /> {sponsor ? 'Editar' : 'Configurar'}
      </Button>
    </div>
  )
}

function SponsorEditor({ category, onSaved }: { category: CategoryRow; onSaved: () => void }) {
  const { toast } = useToast()
  const apiError = useApiError()
  const [tab, setTab] = useState<'config' | 'ads' | 'billing' | 'metrics'>('config')
  const [saving, setSaving] = useState(false)
  const [sponsor, setSponsor] = useState<any>(category.sponsor || {
    mode: 'ROTATING',
    billingType: 'MONTHLY',
    billingValueCents: 0,
    billingImpressions: 0,
    maxRotatingAds: 3,
    transitionType: 'FADE',
    transitionMs: 5000,
    bannerWidth: 1200,
    bannerHeight: 200,
    commercialContactName: '',
    commercialContactEmail: '',
    commercialContactPhone: '',
    isActive: true,
  })
  const [fullSponsor, setFullSponsor] = useState<any>(null)
  const [ads, setAds] = useState<any[]>([])
  const [landingPage, setLandingPage] = useState<any>(null)
  const [billingCycles, setBillingCycles] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any[]>([])

  // Load full sponsor detail if exists
  useEffect(() => {
    if (category.sponsor?.id) {
      fetch(`/api/admin/sponsored-categories/${category.sponsor.id}`)
        .then(r => r.json())
        .then(d => {
          setFullSponsor(d.sponsor)
          setAds(d.sponsor.ads || [])
          setLandingPage(d.sponsor.landingPage)
          setBillingCycles(d.sponsor.billingCycles || [])
          setMetrics(d.metrics || [])
        })
        .catch(() => {})
    }
  }, [category.sponsor?.id])

  const saveConfig = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/sponsored-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: category.id, ...sponsor }),
      })
      const d = await r.json()
      if (d.error) {
        apiError(d.error)
      } else {
        toast({ title: '✓ Configuração salva' }); notifyPortalUpdate('sponsored')
        onSaved()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Tabs — only 4 tabs: Config, Cobrança, Anúncios, Métricas */}
      <div className="flex gap-1 border-b border-zinc-200 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {([
          { id: 'config', label: 'Configuração', icon: Building2 },
          { id: 'billing', label: 'Cobrança & Empresa', icon: CreditCard },
          { id: 'ads', label: 'Anúncios', icon: Megaphone },
          { id: 'metrics', label: 'Métricas', icon: RefreshCw },
        ] as const).map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 -mb-px whitespace-nowrap',
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-zinc-800'
              )}
              style={{ fontWeight: tab === t.id ? 600 : 400 }}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Config tab */}
      {tab === 'config' && (
        <div className="space-y-3">
          {/* Mode + Max ads */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Modo</Label>
              <Select value={sponsor.mode} onValueChange={v => setSponsor({ ...sponsor, mode: v })}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DISABLED">Desativado</SelectItem>
                  <SelectItem value="ROTATING">Rotativo</SelectItem>
                  <SelectItem value="EXCLUSIVE">Exclusivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Máx. anúncios/empresa</Label>
              <Input type="number" min={1} max={5} value={sponsor.maxRotatingAds}
                onChange={e => setSponsor({ ...sponsor, maxRotatingAds: parseInt(e.target.value) || 1 })}
                disabled={sponsor.mode === 'EXCLUSIVE'}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          {/* Billing */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Cobrança</Label>
              <Select value={sponsor.billingType} onValueChange={v => setSponsor({ ...sponsor, billingType: v })}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Mensal</SelectItem>
                  <SelectItem value="IMPRESSIONS">Por impressões</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={(sponsor.billingValueCents / 100).toFixed(2)}
                onChange={e => setSponsor({ ...sponsor, billingValueCents: Math.round(parseFloat(e.target.value) * 100) })}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          {sponsor.billingType === 'IMPRESSIONS' && (
            <div>
              <Label className="text-xs">Impressões contratadas</Label>
              <Input type="number" value={sponsor.billingImpressions}
                onChange={e => setSponsor({ ...sponsor, billingImpressions: parseInt(e.target.value) || 0 })}
                className="mt-1 h-8 text-xs"
              />
            </div>
          )}

          {/* Transition */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Transição</Label>
              <Select value={sponsor.transitionType} onValueChange={v => setSponsor({ ...sponsor, transitionType: v })}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FADE">Fade</SelectItem>
                  <SelectItem value="SLIDE">Slide</SelectItem>
                  <SelectItem value="NONE">Nenhuma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tempo (ms) 3-10k</Label>
              <Input type="number" min={3000} max={10000} step={500} value={sponsor.transitionMs}
                onChange={e => setSponsor({ ...sponsor, transitionMs: parseInt(e.target.value) || 5000 })}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          {/* Banner dimensions */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Largura banner (px)</Label>
              <Input type="number" value={sponsor.bannerWidth}
                onChange={e => setSponsor({ ...sponsor, bannerWidth: parseInt(e.target.value) || 1200 })}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Altura banner (px)</Label>
              <Input type="number" value={sponsor.bannerHeight}
                onChange={e => setSponsor({ ...sponsor, bannerHeight: parseInt(e.target.value) || 200 })}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          {/* Comercial contact */}
          <div className="border-t border-zinc-100 pt-2">
            <Label className="text-xs font-bold">Contato comercial</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
              <Input placeholder="Nome" value={sponsor.commercialContactName || ''}
                onChange={e => setSponsor({ ...sponsor, commercialContactName: e.target.value })}
                className="h-8 text-xs" />
              <Input placeholder="Email" value={sponsor.commercialContactEmail || ''}
                onChange={e => setSponsor({ ...sponsor, commercialContactEmail: e.target.value })}
                className="h-8 text-xs" />
              <Input placeholder="Telefone" value={sponsor.commercialContactPhone || ''}
                onChange={e => setSponsor({ ...sponsor, commercialContactPhone: e.target.value })}
                className="h-8 text-xs" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveConfig} disabled={saving} className="bg-primary h-8 text-xs">
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Salvar
            </Button>
          </div>

          {/* Dimension hint */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
            <strong>Dimensões recomendadas:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Banner inline (categoria): <strong>400×100px</strong> (formato lateral compacto)</li>
              <li>Logo da empresa: <strong>200×200px</strong> (PNG transparente)</li>
              <li>Landing page hero: <strong>1200×400px</strong></li>
              <li>Imagens da galeria: <strong>800×600px</strong> (proporção 4:3)</li>
            </ul>
          </div>
        </div>
      )}

      {/* Ads tab */}
      {tab === 'ads' && (
        <AdsTab sponsorId={category.sponsor?.id} ads={ads} onChange={() => load()} />
      )}

      {/* Billing & Empresa tab — criar ciclo = vincular empresa + cobrança */}
      {tab === 'billing' && (
        <BillingTab sponsorId={category.sponsor?.id} cycles={billingCycles} billingType={sponsor.billingType} valueCents={sponsor.billingValueCents} impressionsLimit={sponsor.billingImpressions} mode={sponsor.mode} maxRotatingAds={sponsor.maxRotatingAds} onChange={() => load()} />
      )}

      {/* Metrics tab */}
      {tab === 'metrics' && (
        <MetricsTab metrics={metrics} />
      )}
    </div>
  )

  function load() {
    if (!category.sponsor?.id) return
    fetch(`/api/admin/sponsored-categories/${category.sponsor.id}`)
      .then(r => r.json())
      .then(d => {
        setAds(d.sponsor.ads || [])
        setLandingPage(d.sponsor.landingPage)
        setBillingCycles(d.sponsor.billingCycles || [])
        setMetrics(d.metrics || [])
      })
  }
}

// === ADS TAB ===
function AdsTab({ sponsorId, ads, onChange }: { sponsorId?: string; ads: any[]; onChange: () => void }) {
  const { toast } = useToast()
  const apiError = useApiError()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ ownerId: '', title: '', subtitle: '', logoUrl: '', imageUrl: '', videoUrl: '', linkUrl: '', ctaText: '' })

  if (!sponsorId) {
    return <div className="text-sm text-zinc-500 text-center py-8">Salve a configuração primeiro para gerenciar anúncios.</div>
  }

  const create = async () => {
    if (!form.ownerId || !form.title) {
      apiError('ownerId e title são obrigatórios')
      return
    }
    const r = await fetch(`/api/admin/sponsored-categories/${sponsorId}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, status: 'PENDING' }),
    })
    const d = await r.json()
    if (d.error) {
      apiError(d.error)
    } else {
      toast({ title: '✓ Anúncio criado' })
      setForm({ ownerId: '', title: '', subtitle: '', logoUrl: '', imageUrl: '', videoUrl: '', linkUrl: '', ctaText: '' })
      setCreating(false)
      onChange()
    }
  }

  const updateStatus = async (adId: string, status: string) => {
    const r = await fetch(`/api/admin/sponsored-categories/${sponsorId}/ads/${adId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const d = await r.json()
    if (d.error) {
      apiError(d.error)
    } else {
      toast({ title: `✓ Anúncio ${status === 'ACTIVE' ? 'aprovado' : status === 'REJECTED' ? 'rejeitado' : status === 'PAUSED' ? 'pausado' : 'atualizado'}` })
      onChange()
    }
  }

  const remove = async (adId: string) => {
    await fetch(`/api/admin/sponsored-categories/${sponsorId}/ads/${adId}`, { method: 'DELETE' })
    toast({ title: 'Anúncio removido' })
    onChange()
  }

  return (
    <div className="space-y-3">
      {ads.length === 0 && !creating && (
        <div className="text-center py-8 text-zinc-500">
          <Megaphone className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
          Nenhum anúncio. Crie o primeiro ou peça para a empresa enviar via painel Enterprise.
        </div>
      )}
      {ads.map(ad => (
        <div key={ad.id} className="bg-white border border-zinc-200 rounded-lg p-3">
          <div className="flex items-start gap-3">
            {ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} className="h-12 w-20 object-cover rounded" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium text-sm text-zinc-900">{ad.title}</div>
                <StatusBadge status={ad.status} />
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {ad.owner?.name || '—'} · {ad.impressions} impressões · {ad.clicks} cliques · CTR {ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="flex gap-1">
              {ad.status !== 'ACTIVE' && (
                <Button size="sm" variant="outline" onClick={() => updateStatus(ad.id, 'ACTIVE')} className="h-7 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" /> Aprovar
                </Button>
              )}
              {ad.status === 'ACTIVE' && (
                <Button size="sm" variant="outline" onClick={() => updateStatus(ad.id, 'PAUSED')} className="h-7 text-xs">
                  Pausar
                </Button>
              )}
              {ad.status !== 'REJECTED' && (
                <Button size="sm" variant="outline" onClick={() => updateStatus(ad.id, 'REJECTED')} className="h-7 text-xs text-red-600">
                  <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => remove(ad.id)} className="h-7 w-7 p-0 text-red-600">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
      {creating ? (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-3">
          <div>
            <Label className="text-xs font-medium mb-1 block">Empresa (dono do anúncio)</Label>
            <UserSearchInput
              value={form.ownerId}
              onChange={(id) => setForm({ ...form, ownerId: id })}
              placeholder="Buscar empresa por nome ou email..."
            />
          </div>
          <Input placeholder="Título do anúncio" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Subtítulo (opcional)" value={form.subtitle}
            onChange={e => setForm({ ...form, subtitle: e.target.value })} />
          <ImageTips context="enterprise" className="mb-2" />
          <ImageUpload
            value={form.logoUrl}
            onChange={(url) => setForm({ ...form, logoUrl: url })}
            label="Logo (200×200px, PNG transparente)"
            placeholder="https://..."
          />
          <ImageUpload
            value={form.imageUrl}
            onChange={(url) => setForm({ ...form, imageUrl: url })}
            label="Imagem do banner (400×100px para inline)"
            placeholder="https://..."
          />
          <Input placeholder="URL do vídeo YouTube (opcional)" value={form.videoUrl}
            onChange={e => setForm({ ...form, videoUrl: e.target.value })} />
          <Input placeholder="URL de clique (opcional — padrão: landing page)" value={form.linkUrl}
            onChange={e => setForm({ ...form, linkUrl: e.target.value })} />
          <Input placeholder="Texto do CTA (ex: Saiba mais)" value={form.ctaText}
            onChange={e => setForm({ ...form, ctaText: e.target.value })} />
          <div className="flex gap-2">
            <Button onClick={create} className="bg-primary">Criar anúncio</Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setCreating(true)} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" /> Criar anúncio (admin)
        </Button>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: string; label: string }> = {
    ACTIVE: { tone: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Ativo' },
    PENDING: { tone: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pendente' },
    PAUSED: { tone: 'bg-zinc-100 text-zinc-700 border-zinc-200', label: 'Pausado' },
    REJECTED: { tone: 'bg-red-100 text-red-700 border-red-200', label: 'Rejeitado' },
    EXPIRED: { tone: 'bg-zinc-100 text-zinc-500 border-zinc-200', label: 'Expirado' },
  }
  const s = map[status] || map.PENDING
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', s.tone)}>{s.label}</span>
}

// === LANDING PAGE TAB ===
function LandingPageTab({ sponsorId, mode, landingPage, onChange }: { sponsorId?: string; mode: string; landingPage: any; onChange: () => void }) {
  const { toast } = useToast()
  const apiError = useApiError()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(landingPage || {
    companyName: '', slug: '', niche: '', logoUrl: '', primaryColor: '#2563eb',
    heroTitle: '', heroSubtitle: '', heroImageUrl: '', aboutText: '',
    phone: '', whatsapp: '', email: '', website: '',
    facebookUrl: '', instagramUrl: '', youtubeUrl: '', linkedinUrl: '',
    address: '', latitude: '', longitude: '', city: '', state: '', zipCode: '',
    seoTitle: '', seoDescription: '', seoKeywords: '',
  })

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (landingPage) setForm(landingPage)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [landingPage])

  if (!sponsorId) {
    return <div className="text-sm text-zinc-500 text-center py-8">Salve a configuração primeiro.</div>
  }
  if (mode !== 'EXCLUSIVE') {
    return <div className="text-sm text-zinc-500 text-center py-8">Landing page só está disponível no modo EXCLUSIVE.</div>
  }

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch(`/api/admin/sponsored-categories/${sponsorId}/landing-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (d.error) {
        apiError(d.error)
      } else {
        toast({ title: '✓ Landing page salva' })
        onChange()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
        A landing page fica em <code>/empresa/[slug]</code> e tem SEO próprio para indexação no Google.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input placeholder="Nome da empresa *" value={form.companyName || ''} onChange={e => setForm({ ...form, companyName: e.target.value })} />
        <Input placeholder="Slug (URL) *" value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} />
        <Input placeholder="Nicho (ex: Agronegócio)" value={form.niche || ''} onChange={e => setForm({ ...form, niche: e.target.value })} />
        <Input placeholder="URL do logo" value={form.logoUrl || ''} onChange={e => setForm({ ...form, logoUrl: e.target.value })} />
        <div>
          <Label className="text-xs">Cor primária</Label>
          <div className="flex gap-2">
            <input type="color" value={form.primaryColor || '#2563eb'} onChange={e => setForm({ ...form, primaryColor: e.target.value })} className="h-9 w-12 rounded border" />
            <Input value={form.primaryColor || ''} onChange={e => setForm({ ...form, primaryColor: e.target.value })} />
          </div>
        </div>
        <Input placeholder="URL imagem hero (1600x600)" value={form.heroImageUrl || ''} onChange={e => setForm({ ...form, heroImageUrl: e.target.value })} />
      </div>
      <Input placeholder="Título hero" value={form.heroTitle || ''} onChange={e => setForm({ ...form, heroTitle: e.target.value })} />
      <Input placeholder="Subtítulo hero" value={form.heroSubtitle || ''} onChange={e => setForm({ ...form, heroSubtitle: e.target.value })} />
      <Textarea placeholder="Sobre a empresa (markdown)" rows={4} value={form.aboutText || ''} onChange={e => setForm({ ...form, aboutText: e.target.value })} />

      <div className="border-t border-zinc-100 pt-3">
        <Label className="text-sm font-bold">Contato</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          <Input placeholder="Telefone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="WhatsApp" value={form.whatsapp || ''} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
          <Input placeholder="Email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <Input placeholder="Website (URL)" value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} className="mt-2" />
      </div>

      <div className="border-t border-zinc-100 pt-3">
        <Label className="text-sm font-bold">Redes sociais</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <Input placeholder="Facebook URL" value={form.facebookUrl || ''} onChange={e => setForm({ ...form, facebookUrl: e.target.value })} />
          <Input placeholder="Instagram URL" value={form.instagramUrl || ''} onChange={e => setForm({ ...form, instagramUrl: e.target.value })} />
          <Input placeholder="YouTube URL" value={form.youtubeUrl || ''} onChange={e => setForm({ ...form, youtubeUrl: e.target.value })} />
          <Input placeholder="LinkedIn URL" value={form.linkedinUrl || ''} onChange={e => setForm({ ...form, linkedinUrl: e.target.value })} />
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-3">
        <Label className="text-sm font-bold">Geolocalização (gera rota no Google Maps)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <Input placeholder="Endereço completo" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
          <Input placeholder="Cidade" value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} />
          <Input placeholder="Estado (UF)" value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value })} />
          <Input placeholder="CEP" value={form.zipCode || ''} onChange={e => setForm({ ...form, zipCode: e.target.value })} />
          <Input placeholder="Latitude (ex: -16.9556)" value={form.latitude || ''} onChange={e => setForm({ ...form, latitude: e.target.value })} />
          <Input placeholder="Longitude (ex: -53.5244)" value={form.longitude || ''} onChange={e => setForm({ ...form, longitude: e.target.value })} />
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          Obtenha coordenadas em <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Maps</a> → clique direito no local → "x,y".
        </p>
      </div>

      <div className="border-t border-zinc-100 pt-3">
        <Label className="text-sm font-bold">SEO</Label>
        <div className="space-y-2 mt-2">
          <Input placeholder="Título SEO (até 60 chars)" value={form.seoTitle || ''} onChange={e => setForm({ ...form, seoTitle: e.target.value })} />
          <Input placeholder="Descrição SEO (até 160 chars)" value={form.seoDescription || ''} onChange={e => setForm({ ...form, seoDescription: e.target.value })} />
          <Input placeholder="Palavras-chave (separadas por vírgula)" value={form.seoKeywords || ''} onChange={e => setForm({ ...form, seoKeywords: e.target.value })} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-primary">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar landing page
        </Button>
      </div>
    </div>
  )
}

// === BILLING TAB ===
function BillingTab({ sponsorId, cycles, billingType, valueCents, impressionsLimit, mode, maxRotatingAds, onChange }: {
  sponsorId?: string
  cycles: any[]
  billingType: string
  valueCents: number
  impressionsLimit: number
  mode?: string
  maxRotatingAds?: number
  onChange: () => void
}) {
  const { toast } = useToast()
  const apiError = useApiError()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [userId, setUserId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [type, setType] = useState(billingType)
  const [valueCentsState, setValueCentsState] = useState(valueCents / 100)
  const [impressionsLimitState, setImpressionsLimitState] = useState(impressionsLimit)
  const [status, setStatus] = useState('PENDING')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')

  // Keep derived state in sync with parent props without setState-in-effect
  // by using a key prop on the parent component (billingType etc. should reset)
  // For now, use direct props when they change
  const form = {
    userId, companyName, type, valueCents: valueCentsState,
    impressionsLimit: impressionsLimitState, status, startAt, endAt,
  }
  const setForm = (updater: any) => {
    if (typeof updater === 'function') {
      const next = updater(form)
      setUserId(next.userId); setCompanyName(next.companyName); setType(next.type)
      setValueCentsState(next.valueCents); setImpressionsLimitState(next.impressionsLimit)
      setStatus(next.status); setStartAt(next.startAt); setEndAt(next.endAt)
    } else {
      setUserId(updater.userId ?? userId)
      setCompanyName(updater.companyName ?? companyName)
      setType(updater.type ?? type)
      setValueCentsState(updater.valueCents ?? valueCentsState)
      setImpressionsLimitState(updater.impressionsLimit ?? impressionsLimitState)
      setStatus(updater.status ?? status)
      setStartAt(updater.startAt ?? startAt)
      setEndAt(updater.endAt ?? endAt)
    }
  }

  if (!sponsorId) {
    return <div className="text-sm text-zinc-500 text-center py-8">Salve a configuração primeiro.</div>
  }

  const create = async () => {
    if (!form.userId) {
      apiError('Selecione uma empresa')
      return
    }
    if (!form.companyName.trim()) {
      apiError('Digite o nome da empresa')
      return
    }
    const r = await fetch(`/api/admin/sponsored-categories/${sponsorId}/billing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: form.userId,
        companyName: form.companyName.trim(),
        type: form.type,
        valueCents: Math.round(form.valueCents * 100),
        impressionsLimit: form.impressionsLimit,
        status: form.status,
        startAt: form.startAt || undefined,
        endAt: form.endAt || undefined,
      }),
    })
    const d = await r.json()
    if (d.error) {
      apiError(d.error)
    } else {
      toast({ title: '✓ Ciclo criado', description: `${form.companyName} vinculada ao painel Enterprise.` }); notifyPortalUpdate('sponsored')
      setCreating(false)
      setForm({ userId: '', companyName: '', type: billingType, valueCents: valueCents / 100, impressionsLimit, status: 'PENDING', startAt: '', endAt: '' })
      onChange()
    }
  }

  const startEdit = (c: any) => {
    setEditingId(c.id)
    setEditForm({
      status: c.status,
      valueCents: (c.valueCents / 100).toFixed(2),
      type: c.type,
      impressionsLimit: c.impressionsLimit,
      startAt: c.startAt ? new Date(c.startAt).toISOString().split('T')[0] : '',
      endAt: c.endAt ? new Date(c.endAt).toISOString().split('T')[0] : '',
    })
  }

  const saveEdit = async (cycleId: string) => {
    const r = await fetch(`/api/admin/sponsored-categories/${sponsorId}/billing/${cycleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: editForm.status,
        valueCents: Math.round(parseFloat(editForm.valueCents) * 100),
        type: editForm.type,
        impressionsLimit: parseInt(editForm.impressionsLimit) || 0,
        startAt: editForm.startAt || null,
        endAt: editForm.endAt || null,
      }),
    })
    const d = await r.json()
    if (d.error) {
      apiError(d.error)
    } else {
      toast({ title: '✓ Ciclo atualizado' }); notifyPortalUpdate('sponsored')
      setEditingId(null)
      onChange()
    }
  }

  const deleteCycle = async (cycleId: string) => {
    if (!confirm('Excluir este ciclo de cobrança? Esta ação não pode ser desfeita.')) return
    const r = await fetch(`/api/admin/sponsored-categories/${sponsorId}/billing/${cycleId}`, { method: 'DELETE' })
    if (r.ok) {
      toast({ title: '✓ Ciclo excluído' }); notifyPortalUpdate('sponsored')
      onChange()
    }
  }

  return (
    <div className="space-y-3">
      {cycles.length === 0 && !creating && (
        <div className="text-center py-8 text-zinc-500">
          <CreditCard className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
          Nenhum ciclo de cobrança. Crie o primeiro para ativar o sponsor.
        </div>
      )}
      {cycles.map(c => (
        <div key={c.id} className="bg-white border border-zinc-200 rounded-lg p-3">
          {editingId === c.id ? (
            // === EDIT MODE ===
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-700">Editando ciclo de {c.user?.name}</div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pendente</SelectItem>
                    <SelectItem value="ACTIVE">Ativo</SelectItem>
                    <SelectItem value="PAUSED">Pausado</SelectItem>
                    <SelectItem value="EXPIRED">Expirado</SelectItem>
                    <SelectItem value="CANCELLED">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={editForm.type} onValueChange={v => setEditForm({ ...editForm, type: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                    <SelectItem value="IMPRESSIONS">Por impressões</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" step="0.01" placeholder="Valor (R$)" value={editForm.valueCents}
                  onChange={e => setEditForm({ ...editForm, valueCents: e.target.value })} className="h-8 text-xs" />
                {editForm.type === 'IMPRESSIONS' && (
                  <Input type="number" placeholder="Impressões" value={editForm.impressionsLimit}
                    onChange={e => setEditForm({ ...editForm, impressionsLimit: e.target.value })} className="h-8 text-xs" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={editForm.startAt} onChange={e => setEditForm({ ...editForm, startAt: e.target.value })} className="h-8 text-xs" />
                <Input type="date" value={editForm.endAt} onChange={e => setEditForm({ ...editForm, endAt: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveEdit(c.id)} className="bg-primary h-8 text-xs">Salvar</Button>
                <Button variant="outline" onClick={() => setEditingId(null)} className="h-8 text-xs">Cancelar</Button>
              </div>
            </div>
          ) : (
            // === VIEW MODE ===
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-zinc-900 flex items-center gap-2">
                  {c.user?.name || '—'}
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  R$ {(c.valueCents / 100).toFixed(2)} · {c.type === 'MONTHLY' ? 'mensal' : `${c.impressionsLimit} impressões`}
                  {c.endAt && ` · até ${new Date(c.endAt).toLocaleDateString('pt-BR')}`}
                  {c.type === 'IMPRESSIONS' && ` · ${c.impressionsUsed}/${c.impressionsLimit} usadas`}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Início: {new Date(c.startAt).toLocaleDateString('pt-BR')}
                  {c.paymentTransactionId && ` · TX: ${c.paymentTransactionId.substring(0, 12)}...`}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startEdit(c)} className="h-7 w-7 p-0" title="Editar">
                  <Edit className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteCycle(c.id)} className="h-7 w-7 p-0 text-red-600" title="Excluir">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
      {creating ? (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-3">
          <div>
            <Label className="text-xs font-medium mb-1 block">1. Selecione o usuário (empresa)</Label>
            <UserSearchInput
              value={form.userId}
              onChange={(id, user) => {
                setForm({ ...form, userId: id, companyName: user?.name || form.companyName })
              }}
              placeholder="Buscar por nome ou email..."
            />
          </div>
          {form.userId && (
            <div>
              <Label className="text-xs font-medium mb-1 block">2. Nome da empresa</Label>
              <Input
                placeholder="Nome da empresa (ex: VS Agencia)"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Mensal</SelectItem>
                <SelectItem value="IMPRESSIONS">Por impressões</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" step="0.01" placeholder="Valor (R$)" value={form.valueCents}
              onChange={e => setForm({ ...form, valueCents: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
          </div>
          {form.type === 'IMPRESSIONS' && (
            <Input type="number" placeholder="Impressões contratadas" value={form.impressionsLimit}
              onChange={e => setForm({ ...form, impressionsLimit: parseInt(e.target.value) || 0 })} className="h-8 text-xs" />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" placeholder="Início" value={form.startAt}
              onChange={e => setForm({ ...form, startAt: e.target.value })} className="h-8 text-xs" />
            {form.type === 'MONTHLY' && (
              <Input type="date" placeholder="Fim (opcional)" value={form.endAt}
                onChange={e => setForm({ ...form, endAt: e.target.value })} className="h-8 text-xs" />
            )}
          </div>
          <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pendente (aguardando pagamento)</SelectItem>
              <SelectItem value="ACTIVE">Ativo (pago / manual)</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button onClick={create} className="bg-primary h-8 text-xs">Criar ciclo</Button>
            <Button variant="outline" onClick={() => setCreating(false)} className="h-8 text-xs">Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setCreating(true)} variant="outline" size="sm" className="text-xs">
          <Plus className="h-3 w-3 mr-1" /> Novo ciclo de cobrança
        </Button>
      )}
      <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-900">
        <strong>Fluxo simples:</strong> Selecione um usuário, digite o nome da empresa, configure o ciclo (mensal ou por impressões), defina o valor e clique em Criar.
        O usuário é automaticamente vinculado e passa a ver o painel Enterprise no menu do perfil.
        Em modo <strong>Exclusivo</strong>, a empresa tem a categoria só para ela + landing page própria.
        Em modo <strong>Rotativo</strong>, até {maxRotatingAds || 3} anúncios de empresas diferentes revezam.
      </div>
    </div>
  )
}

// === ENTERPRISE TAB — view/manage Enterprise users (NO assign form — use Cobrança tab) ===
function EnterpriseTab({ sponsorId, onChange }: { sponsorId?: string; onChange: () => void }) {
  const { toast } = useToast()
  const [enterpriseUsers, setEnterpriseUsers] = useState<any[]>([])

  const loadEnterpriseUsers = async () => {
    try {
      const r = await fetch('/api/admin/enterprise-users')
      const d = await r.json()
      setEnterpriseUsers(d.users || [])
    } catch {}
  }

  // Initial fetch — uses async IIFE so setState is in a microtask callback, not in effect body
  useEffect(() => {
    (async () => {
      await loadEnterpriseUsers()
    })()
  }, [])

  if (!sponsorId) {
    return <div className="text-sm text-zinc-500 text-center py-8">Salve a configuração primeiro.</div>
  }

  const handleToggle = async (linkId: string, isActive: boolean) => {
    const r = await fetch(`/api/admin/enterprise-users/${linkId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    if (r.ok) {
      toast({ title: isActive ? 'Acesso desativado' : 'Acesso reativado' })
      loadEnterpriseUsers()
    }
  }

  const handleDelete = async (linkId: string, name: string) => {
    if (!confirm(`Remover acesso Enterprise de "${name}"? Os anúncios e ciclos de cobrança permanecem para histórico.`)) return
    const r = await fetch(`/api/admin/enterprise-users/${linkId}`, { method: 'DELETE' })
    if (r.ok) {
      toast({ title: '✓ Acesso Enterprise removido' }); notifyPortalUpdate('sponsored')
      loadEnterpriseUsers()
    }
  }

  return (
    <div className="space-y-3">
      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
        <div className="flex items-start gap-2">
          <Crown className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Empresas com acesso Enterprise</strong>
            <p className="mt-1">
              Para vincular uma nova empresa, use a aba <strong>Cobrança</strong> → ao criar um ciclo,
              o usuário é automaticamente vinculado como Enterprise.
              Aqui você apenas gerencia (ativa/desativa/remove) os acessos existentes.
            </p>
          </div>
        </div>
      </div>

      {/* ALL enterprise users (global list) */}
      <div className="bg-white border border-zinc-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-bold">Empresas com acesso ({enterpriseUsers.length})</Label>
          <Button variant="ghost" size="sm" onClick={loadEnterpriseUsers} className="h-6 text-[10px]">
            <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
          </Button>
        </div>
        {enterpriseUsers.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-4">
            Nenhuma empresa vinculada. Crie um ciclo na aba <strong>Cobrança</strong>.
          </div>
        ) : (
          <div className="space-y-1">
            {enterpriseUsers.map(u => (
              <div key={u.id} className={cn('flex items-center gap-2 text-xs border rounded p-2', u.isActive ? 'border-zinc-200' : 'border-zinc-100 opacity-60')}>
                <div className="h-7 w-7 rounded-full bg-primary text-white text-[10px] flex items-center justify-center flex-shrink-0" style={{ fontWeight: 700 }}>
                  {u.user?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-900 truncate flex items-center gap-1">
                    {u.companyName}
                    {!u.isActive && <span className="text-[9px] bg-zinc-200 text-zinc-600 px-1 rounded">desativado</span>}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">{u.user?.name} · {u.user?.email}</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">
                    {u.adCount} anúncio(s) · {u.cycleCount} ciclo(s) · desde {new Date(u.assignedAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggle(u.id, u.isActive)}
                    className="h-6 text-[10px] px-2"
                    title={u.isActive ? 'Desativar acesso' : 'Reativar acesso'}
                  >
                    {u.isActive ? <XCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(u.id, u.companyName)}
                    className="h-6 text-[10px] px-2 text-red-600"
                    title="Remover acesso"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// === METRICS TAB ===
function MetricsTab({ metrics }: { metrics: any[] }) {
  if (metrics.length === 0) {
    return <div className="text-center py-8 text-zinc-500"><RefreshCw className="h-8 w-8 mx-auto mb-2 text-zinc-300" /> Sem métricas ainda.</div>
  }
  const totalImp = metrics.reduce((s, m) => s + m.impressions, 0)
  const totalClicks = metrics.reduce((s, m) => s + m.clicks, 0)
  const maxImp = Math.max(...metrics.map(m => m.impressions), 1)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border rounded p-2 text-center">
          <div className="text-xl font-black text-zinc-900">{totalImp}</div>
          <div className="text-xs text-zinc-500">Impressões (30d)</div>
        </div>
        <div className="bg-white border rounded p-2 text-center">
          <div className="text-xl font-black text-zinc-900">{totalClicks}</div>
          <div className="text-xs text-zinc-500">Cliques (30d)</div>
        </div>
        <div className="bg-white border rounded p-2 text-center">
          <div className="text-xl font-black text-zinc-900">{totalImp > 0 ? ((totalClicks / totalImp) * 100).toFixed(1) : 0}%</div>
          <div className="text-xs text-zinc-500">CTR</div>
        </div>
      </div>
      {/* Simple bar chart */}
      <div className="bg-white border rounded p-3">
        <div className="text-xs text-zinc-500 mb-2">Impressões por dia (últimos 30 dias)</div>
        <div className="flex items-end gap-0.5 h-32">
          {metrics.map((m, i) => (
            <div key={i} className="flex-1 bg-primary rounded-t" style={{ height: `${(m.impressions / maxImp) * 100}%`, minHeight: '2px' }} title={`${new Date(m.date).toLocaleDateString('pt-BR')}: ${m.impressions} imp, ${m.clicks} cliques`} />
          ))}
        </div>
      </div>
    </div>
  )
}
