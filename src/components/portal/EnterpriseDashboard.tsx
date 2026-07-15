'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Loader2, Megaphone, Crown, RefreshCw, TrendingUp, MousePointer, Eye,
  Plus, Trash2, Edit, ExternalLink, AlertCircle, CreditCard, Building2,
  MapPin, Phone, Mail, Globe, Calendar, CheckCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { ImageTips } from '@/components/ui/image-tips'
import { useApiError } from '@/hooks/use-api-error'

export function EnterpriseDashboard() {
  const { user, setView } = useAppStore()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'ads' | 'landing' | 'billing'>('overview')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/enterprise/me')
      if (r.status === 403) {
        setError('Você não tem acesso Enterprise. Entre em contato com o comercial.')
        return
      }
      const d = await r.json()
      if (d.error) {
        setError(d.error)
      } else {
        setData(d)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  if (loading) return <div className="text-zinc-500 flex items-center gap-2 py-12"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <AlertCircle className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Acesso Enterprise</h2>
        <p className="text-zinc-600 mb-6">{error}</p>
        <Button onClick={() => setView({ name: 'home' })} className="bg-primary">Voltar ao início</Button>
      </div>
    )
  }

  if (!data) return null

  const { link, ads, billingCycles, totals, availableSponsors = [] } = data

  return (
    <div className="news-container py-6 animate-fade-in">
      <button onClick={() => setView({ name: 'home' })} className="text-sm text-zinc-600 hover:text-primary mb-3">
        ← Voltar ao início
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-5 text-white mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-white p-2 rounded-lg">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Painel Enterprise</h1>
              <p className="text-zinc-400 text-sm">{link.companyName}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 overflow-x-auto mb-4">
        {([
          { id: 'overview', label: 'Visão geral', icon: TrendingUp },
          { id: 'ads', label: 'Meus anúncios', icon: Megaphone },
          { id: 'landing', label: 'Landing page', icon: Building2 },
          { id: 'billing', label: 'Cobrança', icon: CreditCard },
        ] as const).map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px whitespace-nowrap',
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-zinc-800'
              )}
              style={{ fontWeight: tab === t.id ? 600 : 400 }}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab totals={totals} ads={ads} billingCycles={billingCycles} />}
      {tab === 'ads' && <AdsTab ads={ads} sponsors={availableSponsors} onChange={load} />}
      {tab === 'landing' && <LandingTab billingCycles={billingCycles} onChange={load} />}
      {tab === 'billing' && <BillingTab cycles={billingCycles} />}
    </div>
  )
}

// === OVERVIEW ===
function OverviewTab({ totals, ads, billingCycles }: { totals: any; ads: any[]; billingCycles: any[] }) {
  const now = Date.now()
  const activeCycles = billingCycles.filter((cycle: any) => (
    cycle.status === 'ACTIVE'
    && cycle.isServing !== false
    && new Date(cycle.startAt).getTime() <= now
    && (cycle.type === 'MONTHLY'
      ? (!cycle.endAt || new Date(cycle.endAt).getTime() > now)
      : cycle.impressionsLimit > 0 && cycle.impressionsUsed < cycle.impressionsLimit)
  ))
  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={Eye} label="Impressões" value={totals.impressions} tone="blue" />
        <MetricCard icon={MousePointer} label="Cliques" value={totals.clicks} tone="emerald" />
        <MetricCard icon={TrendingUp} label="CTR" value={`${(totals?.ctr ?? 0).toFixed(2)}%`} tone="amber" />
        <MetricCard icon={Megaphone} label="Anúncios ativos" value={`${totals.activeAds}/${totals.totalAds}`} tone="zinc" />
      </div>

      {/* Active cycle */}
      {activeCycles.length > 0 ? (
        <div className="space-y-2">
          {activeCycles.map((activeCycle: any) => (
            <div key={activeCycle.id} className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <div className="font-bold text-emerald-900">{activeCycle.sponsoredCategory?.category?.name || 'Ciclo ativo'}</div>
              </div>
              <div className="text-sm text-emerald-800">
                {activeCycle.type === 'MONTHLY'
                  ? `Mensal · R$ ${(activeCycle.valueCents / 100).toFixed(2)} · até ${activeCycle.endAt ? new Date(activeCycle.endAt).toLocaleDateString('pt-BR') : 'indeterminado'}`
                  : `Por impressões · ${activeCycle.impressionsUsed}/${activeCycle.impressionsLimit} usadas`
                }
              </div>
              {activeCycle.type === 'IMPRESSIONS' && (
                <div className="mt-2 h-2 bg-emerald-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${activeCycle.impressionsLimit > 0 ? Math.min(100, (activeCycle.impressionsUsed / activeCycle.impressionsLimit) * 100) : 0}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <div className="text-sm">Você não tem ciclo ativo no momento. Entre em contato com o comercial para renovar.</div>
          </div>
        </div>
      )}

      {/* Recent ads */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4">
        <h3 className="font-bold text-zinc-900 mb-3">Anúncios recentes</h3>
        <div className="space-y-2">
          {ads.slice(0, 5).map((ad: any) => (
            <div key={ad.id} className="flex items-center gap-3 text-sm">
              {ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} className="h-10 w-16 object-cover rounded" />}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-900 truncate">{ad.title}</div>
                <div className="text-xs text-zinc-500">{ad.sponsoredCategory?.category?.name}</div>
              </div>
              <Badge variant="outline" className="text-[10px]">{ad.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone: string }) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    zinc: 'bg-white border-zinc-200 text-zinc-700',
  }
  return (
    <div className={cn('border rounded-lg p-3', tones[tone])}>
      <Icon className="h-4 w-4 mb-1 opacity-70" />
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  )
}

// === ADS ===
function AdsTab({ ads, sponsors, onChange }: { ads: any[]; sponsors: any[]; onChange: () => void }) {
  const { toast } = useToast()
  const apiError = useApiError()
  const [editing, setEditing] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)
  const [creatingSponsorId, setCreatingSponsorId] = useState<string | null>(null)

  const remove = async (id: string) => {
    if (!confirm('Excluir este anúncio?')) return
    const r = await fetch(`/api/enterprise/ads/${id}`, { method: 'DELETE' })
    const data = await r.json().catch(() => ({}))
    if (r.ok) { toast({ title: 'Anúncio removido' }); onChange() }
    else apiError(data.error || 'Não foi possível excluir o anúncio')
  }

  // Group ads by sponsor
  const bySponsor = (ads || []).reduce((acc: any, ad: any) => {
    const sid = ad.sponsoredCategoryId
    if (!acc[sid]) acc[sid] = { sponsor: ad.sponsoredCategory, ads: [] }
    acc[sid].ads.push(ad)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {Object.keys(bySponsor).length === 0 && !creating && (
        <div className="text-center py-8 text-zinc-500">
          <Megaphone className="h-10 w-10 mx-auto mb-2 text-zinc-300" />
          <p>{sponsors.length > 0 ? 'Você ainda não tem anúncios. Crie o primeiro.' : 'Nenhum contrato ativo disponível para criar anúncios.'}</p>
          {sponsors.length > 0 && (
            <Button onClick={() => { setCreatingSponsorId(sponsors[0].id); setCreating(true) }} className="bg-primary mt-3">
              <Plus className="h-4 w-4 mr-1" /> Criar anúncio
            </Button>
          )}
        </div>
      )}

      {Object.entries(bySponsor).map(([sid, group]: [string, any]) => (
        <div key={sid} className="bg-white border border-zinc-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold text-zinc-900 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                {group.sponsor?.category?.name || 'Categoria'}
              </div>
              <div className="text-xs text-zinc-500">
                {group.sponsor?.mode === 'EXCLUSIVE' ? 'Modo exclusivo' : `Rotativo (máx ${group.sponsor?.maxRotatingAds})`}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!sponsors.some(sponsor => sponsor.id === sid)}
              onClick={() => { setCreatingSponsorId(sid); setCreating(true) }}
            >
              <Plus className="h-4 w-4 mr-1" /> Novo anúncio
            </Button>
          </div>
          <div className="space-y-2">
            {group.ads.map((ad: any) => (
              <div key={ad.id} className="border border-zinc-100 rounded p-3 flex items-center gap-3">
                {ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} className="h-12 w-20 object-cover rounded" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-zinc-900 truncate">{ad.title}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {ad.impressions} imp · {ad.clicks} cliques · CTR {ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{ad.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setEditing(ad)} className="h-7 w-7 p-0">
                  <Edit className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(ad.id)} className="h-7 w-7 p-0 text-red-600">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {(creating || editing) && (
        <AdEditor
          ad={editing}
          sponsors={sponsors}
          initialSponsorId={creatingSponsorId}
          onClose={() => { setCreating(false); setEditing(null); setCreatingSponsorId(null) }}
          onSaved={() => { setCreating(false); setEditing(null); setCreatingSponsorId(null); onChange() }}
        />
      )}
    </div>
  )
}

function AdEditor({ ad, sponsors, initialSponsorId, onClose, onSaved }: { ad: any | null; sponsors: any[]; initialSponsorId: string | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const apiError = useApiError()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    sponsoredCategoryId: ad?.sponsoredCategoryId || initialSponsorId || sponsors[0]?.id || '',
    title: ad?.title || '',
    subtitle: ad?.subtitle || '',
    logoUrl: ad?.logoUrl || '',
    imageUrl: ad?.imageUrl || '',
    videoUrl: ad?.videoUrl || '',
    linkUrl: ad?.linkUrl || '',
    ctaText: ad?.ctaText || 'Saiba mais',
  })

  const save = async () => {
    if (!form.sponsoredCategoryId || !form.title) {
      apiError('Categoria e título são obrigatórios')
      return
    }
    setSaving(true)
    try {
      const url = ad ? `/api/enterprise/ads/${ad.id}` : '/api/enterprise/ads'
      const method = ad ? 'PATCH' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (d.error) {
        apiError(d.error)
      } else {
        toast({ title: ad ? '✓ Anúncio atualizado' : '✓ Anúncio criado (aguarda aprovação)' })
        onSaved()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ad ? 'Editar anúncio' : 'Novo anúncio'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Categoria patrocinada</Label>
            <select
              value={form.sponsoredCategoryId}
              onChange={e => setForm({ ...form, sponsoredCategoryId: e.target.value })}
              disabled={!!ad}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm disabled:bg-zinc-100"
            >
              {ad && !sponsors.some(sponsor => sponsor.id === ad.sponsoredCategoryId) && (
                <option value={ad.sponsoredCategoryId}>{ad.sponsoredCategory?.category?.name || 'Contrato encerrado'}</option>
              )}
              {sponsors.map(sponsor => (
                <option key={sponsor.id} value={sponsor.id}>
                  {sponsor.category?.name || 'Categoria'} · {sponsor.mode === 'EXCLUSIVE' ? 'Exclusivo' : 'Rotativo'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-sm">Título *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Subtítulo</Label>
            <Input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Logo da empresa (recomendado: 200×200px, PNG transparente)</Label>
            <ImageUpload
              value={form.logoUrl}
              onChange={(url) => setForm({ ...form, logoUrl: url })}
              placeholder="https://..."
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm">Imagem do banner (recomendado: 400×100px para banner inline)</Label>
            <ImageTips context="enterprise" className="mb-2" />
            <ImageUpload
              value={form.imageUrl}
              onChange={(url) => setForm({ ...form, imageUrl: url })}
              placeholder="https://..."
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm">URL do vídeo YouTube (opcional)</Label>
            <Input value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">URL de clique (opcional — padrão: sua landing page)</Label>
            <Input value={form.linkUrl} onChange={e => setForm({ ...form, linkUrl: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Texto do CTA</Label>
            <Input value={form.ctaText} onChange={e => setForm({ ...form, ctaText: e.target.value })} className="mt-1" />
          </div>
          {ad?.status === 'REJECTED' && ad?.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
              <strong>Rejeitado:</strong> {ad.rejectionReason}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-primary">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {ad ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// === LANDING TAB ===
function LandingTab({ billingCycles, onChange }: { billingCycles: any[]; onChange: () => void }) {
  const { toast } = useToast()
  const apiError = useApiError()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sponsorId, setSponsorId] = useState<string | null>(null)
  const [lp, setLp] = useState<any>(null)
  const [form, setForm] = useState<any>({})

  const exclusiveSponsors = useMemo(() => {
    const now = Date.now()
    const valid = billingCycles.filter((cycle: any) => (
      cycle.status === 'ACTIVE'
      && cycle.isServing !== false
      && cycle.sponsoredCategory?.mode === 'EXCLUSIVE'
      && new Date(cycle.startAt).getTime() <= now
      && (cycle.type === 'MONTHLY'
        ? (!cycle.endAt || new Date(cycle.endAt).getTime() > now)
        : cycle.impressionsLimit > 0 && cycle.impressionsUsed < cycle.impressionsLimit)
    ))
    return [...new Map(valid.map((cycle: any) => [cycle.sponsoredCategoryId, {
      id: cycle.sponsoredCategoryId,
      name: cycle.sponsoredCategory?.category?.name || 'Categoria',
    }])).values()] as { id: string; name: string }[]
  }, [billingCycles])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (exclusiveSponsors.length === 0) {
      setSponsorId(null)
      setLoading(false)
      return
    }
    if (!sponsorId || !exclusiveSponsors.some(sponsor => sponsor.id === sponsorId)) {
      setSponsorId(exclusiveSponsors[0].id)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [exclusiveSponsors, sponsorId])

  useEffect(() => {
    if (!sponsorId) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true)
    setLp(null)
    setForm({})
    let cancelled = false
    fetch(`/api/enterprise/landing-page?sponsoredCategoryId=${sponsorId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.landingPage) {
          setLp(d.landingPage)
          setForm(d.landingPage)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { cancelled = true }
  }, [sponsorId])

  if (loading) return <div className="text-zinc-500 flex items-center gap-2 py-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>

  if (!sponsorId) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <Building2 className="h-10 w-10 mx-auto mb-2 text-zinc-300" />
        <p>Landing page disponível apenas para patrocínios <strong>exclusivos</strong>.</p>
        <p className="text-xs mt-2">Seu plano atual é rotativo. Entre em contato com o comercial para upgrade.</p>
      </div>
    )
  }

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/enterprise/landing-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsoredCategoryId: sponsorId, ...form }),
      })
      const d = await r.json()
      if (d.error) {
        apiError(d.error)
      } else {
        toast({ title: '✓ Landing page salva' })
        setLp(d.landingPage)
        onChange()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {exclusiveSponsors.length > 1 && (
        <div>
          <Label className="text-sm">Categoria exclusiva</Label>
          <select
            value={sponsorId || ''}
            onChange={event => setSponsorId(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
          >
            {exclusiveSponsors.map(sponsor => <option key={sponsor.id} value={sponsor.id}>{sponsor.name}</option>)}
          </select>
        </div>
      )}
      {lp?.slug && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-emerald-900 flex items-center justify-between">
          <span>Sua página está no ar em <code>/empresa/{lp.slug}</code></span>
          <a href={`/empresa/${encodeURIComponent(lp.slug)}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline flex items-center gap-1">
            Ver página <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      <Input placeholder="Nome da empresa" value={form.companyName || ''} onChange={e => setForm({ ...form, companyName: e.target.value })} />
      <Input placeholder="Nicho (ex: Agronegócio)" value={form.niche || ''} onChange={e => setForm({ ...form, niche: e.target.value })} />
      <div>
        <Label className="text-sm">Logo da empresa (200×200px, PNG transparente)</Label>
        <ImageTips context="enterprise" className="mb-2" />
        <ImageUpload value={form.logoUrl || ''} onChange={(url) => setForm({ ...form, logoUrl: url })} placeholder="https://..." className="mt-1" />
      </div>
      <div className="flex gap-2">
        <input type="color" value={form.primaryColor || '#2563eb'} onChange={e => setForm({ ...form, primaryColor: e.target.value })} className="h-9 w-12 rounded border" />
        <Input value={form.primaryColor || ''} onChange={e => setForm({ ...form, primaryColor: e.target.value })} placeholder="Cor primária" />
      </div>
      <Input placeholder="Título hero" value={form.heroTitle || ''} onChange={e => setForm({ ...form, heroTitle: e.target.value })} />
      <Input placeholder="Subtítulo hero" value={form.heroSubtitle || ''} onChange={e => setForm({ ...form, heroSubtitle: e.target.value })} />
      <div>
        <Label className="text-sm">Imagem hero (1200×400px)</Label>
        <ImageUpload value={form.heroImageUrl || ''} onChange={(url) => setForm({ ...form, heroImageUrl: url })} placeholder="https://..." className="mt-1" />
      </div>
      <Textarea placeholder="Sobre a empresa (markdown)" rows={4} value={form.aboutText || ''} onChange={e => setForm({ ...form, aboutText: e.target.value })} />
      <div className="grid grid-cols-3 gap-2">
        <Input placeholder="Telefone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <Input placeholder="WhatsApp" value={form.whatsapp || ''} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
        <Input placeholder="Email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
      </div>
      <Input placeholder="Website" value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Facebook" value={form.facebookUrl || ''} onChange={e => setForm({ ...form, facebookUrl: e.target.value })} />
        <Input placeholder="Instagram" value={form.instagramUrl || ''} onChange={e => setForm({ ...form, instagramUrl: e.target.value })} />
        <Input placeholder="YouTube" value={form.youtubeUrl || ''} onChange={e => setForm({ ...form, youtubeUrl: e.target.value })} />
        <Input placeholder="LinkedIn" value={form.linkedinUrl || ''} onChange={e => setForm({ ...form, linkedinUrl: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Endereço" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
        <Input placeholder="Cidade" value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} />
        <Input placeholder="Latitude" value={form.latitude || ''} onChange={e => setForm({ ...form, latitude: e.target.value })} />
        <Input placeholder="Longitude" value={form.longitude || ''} onChange={e => setForm({ ...form, longitude: e.target.value })} />
      </div>
      <Button onClick={save} disabled={saving} className="bg-primary">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Salvar landing page
      </Button>
    </div>
  )
}

// === BILLING TAB ===
function BillingTab({ cycles }: { cycles: any[] }) {
  const { toast } = useToast()
  const apiError = useApiError()
  const [payingId, setPayingId] = useState<string | null>(null)

  const handlePay = async (cycleId: string) => {
    setPayingId(cycleId)
    try {
      const r = await fetch(`/api/enterprise/billing/${cycleId}/checkout`, { method: 'POST' })
      const d = await r.json()
      if (d.error) {
        apiError(d.error)
      } else if (d.checkoutUrl) {
        // Navigate in the same tab so browsers cannot block the checkout as a popup.
        window.location.assign(d.checkoutUrl)
        toast({ title: 'Pagamento', description: 'Você foi redirecionado para o checkout.' })
      } else if (d.pixCode) {
        try {
          await navigator.clipboard.writeText(d.pixCode)
          toast({ title: 'PIX gerado', description: 'Código PIX copiado para a área de transferência.' })
        } catch {
          window.prompt('Copie o código PIX:', d.pixCode)
        }
      } else {
        toast({ title: 'Pagamento criado', description: 'Verifique as instruções no email.' })
      }
    } finally {
      setPayingId(null)
    }
  }

  if (cycles.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <CreditCard className="h-10 w-10 mx-auto mb-2 text-zinc-300" />
        <p>Nenhum ciclo de cobrança ainda.</p>
        <p className="text-xs mt-1">O comercial irá criar o ciclo após confirmação de pagamento.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {cycles.map(c => (
        <div key={c.id} className="bg-white border border-zinc-200 rounded-lg p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-zinc-900 flex items-center gap-2">
                {c.sponsoredCategory?.category?.name || '—'}
                <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                R$ {(c.valueCents / 100).toFixed(2)} · {c.type === 'MONTHLY' ? 'mensal' : `${c.impressionsLimit} impressões`}
                {c.endAt && ` · até ${new Date(c.endAt).toLocaleDateString('pt-BR')}`}
                {c.type === 'IMPRESSIONS' && ` · ${c.impressionsUsed}/${c.impressionsLimit} usadas`}
              </div>
            </div>
            {c.status === 'PENDING' && (
              <Button size="sm" onClick={() => handlePay(c.id)} disabled={payingId === c.id} className="bg-primary flex-shrink-0">
                {payingId === c.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CreditCard className="h-3 w-3 mr-1" />}
                Pagar
              </Button>
            )}
            {c.status === 'ACTIVE' && (
              <Badge className={cn(
                'text-[10px] flex-shrink-0',
                c.isServing === false
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-emerald-100 text-emerald-700 border-emerald-200',
              )}>
                {c.isServing === false ? <AlertCircle className="h-3 w-3 mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                {c.isServing === false ? 'Não veiculando' : 'Ativo'}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
