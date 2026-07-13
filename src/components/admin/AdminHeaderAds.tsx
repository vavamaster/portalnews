'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  Loader2, Plus, Trash2, RefreshCw, Image as ImageIcon, ExternalLink,
  Eye, EyeOff, Clock, Calendar, BarChart3, Plus as PlusIcon, X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ImageUpload } from './ImageUpload'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { useApiError } from '@/hooks/use-api-error'

interface HeaderAd {
  id: string
  name: string
  type: 'static' | 'slider'
  images: string // JSON string or single URL
  linkUrl: string | null
  animation: 'none' | 'fade' | 'slide' | 'kenburns'
  slideInterval: number
  position: 'above-brand' | 'below-brand' | 'below-nav' | 'replace-ticker'
  startAt: string | null
  endAt: string | null
  daysOfWeek: string | null
  hourRange: string | null
  isActive: boolean
  priority: number
  openNewTab: boolean
  widthHint: number
  heightHint: number
  impressions: number
  clicks: number
}

const POSITIONS = [
  { value: 'above-brand', label: 'Acima do logo' },
  { value: 'below-brand', label: 'Abaixo do logo (linha busca)' },
  { value: 'below-nav', label: 'Abaixo do menu' },
  { value: 'replace-ticker', label: 'Substituir ticker urgente' },
]

const ANIMATIONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'fade', label: 'Fade (esmaecer)' },
  { value: 'slide', label: 'Slide (deslizar)' },
  { value: 'kenburns', label: 'Ken Burns (zoom suave)' },
]

const DAYS = [
  { value: '0', label: 'Dom' },
  { value: '1', label: 'Seg' },
  { value: '2', label: 'Ter' },
  { value: '3', label: 'Qua' },
  { value: '4', label: 'Qui' },
  { value: '5', label: 'Sex' },
  { value: '6', label: 'Sáb' },
]

export function AdminHeaderAds() {
  const { toast } = useToast()
  const apiError = useApiError()
  const [ads, setAds] = useState<HeaderAd[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<HeaderAd | null>(null)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/header-ads')
      const d = await r.json()
      setAds(d.ads || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const remove = async (id: string) => {
    if (!confirm('Remover este anúncio?')) return
    await fetch(`/api/admin/header-ads?id=${id}`, { method: 'DELETE' })
    toast({ title: 'Anúncio removido' })
    load()
  }

  const toggleActive = async (ad: HeaderAd) => {
    await fetch(`/api/admin/header-ads?id=${ad.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !ad.isActive }),
    })
    load()
  }

  if (loading) return <LoadingSpinner />

  if (creating) {
    return <AdEditor onSave={async (data) => {
      const r = await fetch('/api/admin/header-ads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const d = await r.json()
      if (d.error) { apiError(d.error) }
      else { toast({ title: '✓ Anúncio criado' }); setCreating(false); load() }
    }} onCancel={() => setCreating(false)} />
  }

  if (editing) {
    return <AdEditor ad={editing} onSave={async (data) => {
      const r = await fetch(`/api/admin/header-ads?id=${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const d = await r.json()
      if (d.error) { apiError(d.error) }
      else { toast({ title: '✓ Anúncio atualizado' }); setEditing(null); load() }
    }} onCancel={() => setEditing(null)} />
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setCreating(true)} className="bg-primary">
          <Plus className="h-4 w-4 mr-1" /> Novo Anúncio
        </Button>
      </div>

      {ads.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <ImageIcon className="h-10 w-10 mx-auto mb-3 text-zinc-300" />
          <div className="text-sm">Nenhum anúncio no header cadastrado.</div>
          <div className="text-xs text-zinc-400 mt-1">Crie o primeiro para exibir no topo do portal.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {ads.map(ad => {
            const images = parseImages(ad.images, ad.type)
            const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : '0.00'
            return (
              <div key={ad.id} className={cn('bg-white border rounded-lg p-3', ad.isActive ? 'border-zinc-200' : 'border-zinc-200 opacity-60')}>
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="h-16 w-24 bg-zinc-100 rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {images[0] ? (
                      <img src={images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-zinc-300" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-zinc-900 truncate">{ad.name}</span>
                      <Badge variant="outline" className="text-[9px]">{ad.type === 'slider' ? `${images.length} slides` : 'Estático'}</Badge>
                      <Badge variant="outline" className="text-[9px]">{POSITIONS.find(p => p.value === ad.position)?.label}</Badge>
                      {ad.animation !== 'none' && <Badge variant="outline" className="text-[9px] capitalize">{ad.animation}</Badge>}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> {ad.impressions.toLocaleString('pt-BR')} impressões</span>
                      <span>·</span>
                      <span>{ad.clicks.toLocaleString('pt-BR')} cliques</span>
                      <span>·</span>
                      <span>CTR {ctr}%</span>
                      <span>·</span>
                      <span>Prioridade {ad.priority}</span>
                    </div>
                    {(ad.startAt || ad.endAt) && (
                      <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {ad.startAt ? `Início: ${new Date(ad.startAt).toLocaleString('pt-BR')}` : 'Sem início'}
                        {' → '}
                        {ad.endAt ? `Fim: ${new Date(ad.endAt).toLocaleString('pt-BR')}` : 'Sem fim'}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(ad)} className="h-7 w-7 p-0" title={ad.isActive ? 'Pausar' : 'Ativar'}>
                      {ad.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(ad)} className="h-7 text-xs">Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(ad.id)} className="h-7 w-7 p-0 text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
        <div className="flex items-start gap-2">
          <ImageIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Sobre os anúncios do header:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
              <li>Suporta imagem estática ou slider (múltiplas imagens com intervalo configurável)</li>
              <li>Animações: fade, slide, ou ken-burns (zoom suave)</li>
              <li>Agendamento por data, dias da semana e faixa de horário</li>
              <li>Prioridade: anúncios com prioridade maior aparecem primeiro</li>
              <li>Tracking automático de impressões e cliques</li>
              <li>Posicionamento flexível: acima do logo, abaixo do logo, abaixo do menu, ou substituindo o ticker</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Ad Editor (create/edit form)
// ============================================================

interface AdEditorProps {
  ad?: HeaderAd
  onSave: (data: any) => Promise<void>
  onCancel: () => void
}

function AdEditor({ ad, onSave, onCancel }: AdEditorProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    name: ad?.name || '',
    type: ad?.type || 'static',
    linkUrl: ad?.linkUrl || '',
    animation: ad?.animation || 'fade',
    slideInterval: ad?.slideInterval || 5000,
    position: ad?.position || 'below-nav',
    startAt: ad?.startAt ? new Date(ad.startAt).toISOString().slice(0, 16) : '',
    endAt: ad?.endAt ? new Date(ad.endAt).toISOString().slice(0, 16) : '',
    daysOfWeek: ad?.daysOfWeek ? ad.daysOfWeek.split(',') : [],
    hourRange: ad?.hourRange || '',
    isActive: ad?.isActive ?? true,
    priority: ad?.priority || 0,
    openNewTab: ad?.openNewTab ?? true,
    widthHint: ad?.widthHint || 728,
    heightHint: ad?.heightHint || 90,
  })

  // For static: single image URL. For slider: array of {url, link}
  const initialImages = (() => {
    if (!ad) return []
    try {
      const parsed = JSON.parse(ad.images)
      if (Array.isArray(parsed)) return parsed
      return [{ url: ad.images, link: ad.linkUrl || '' }]
    } catch {
      return [{ url: ad.images, link: ad.linkUrl || '' }]
    }
  })()
  const [slides, setSlides] = useState<{ url: string; link: string }[]>(
    form.type === 'slider' ? initialImages : (initialImages[0] ? [initialImages[0]] : [{ url: '', link: '' }])
  )
  const [staticImage, setStaticImage] = useState<string>(
    form.type === 'static' ? (initialImages[0]?.url || '') : ''
  )

  const toggleDay = (day: string) => {
    const current = form.daysOfWeek || []
    setForm({
      ...form,
      daysOfWeek: current.includes(day) ? current.filter((d: string) => d !== day) : [...current, day],
    })
  }

  const handleSave = async () => {
    if (!form.name) { toast({ title: 'Informe o nome do anúncio', variant: 'destructive' }); return }
    if (form.type === 'static' && !staticImage) { toast({ title: 'Faça upload da imagem', variant: 'destructive' }); return }
    if (form.type === 'slider' && slides.filter(s => s.url).length === 0) { toast({ title: 'Adicione pelo menos 1 slide', variant: 'destructive' }); return }

    setSaving(true)
    try {
      const data: any = {
        name: form.name,
        type: form.type,
        animation: form.animation,
        slideInterval: form.slideInterval,
        position: form.position,
        startAt: form.startAt || null,
        endAt: form.endAt || null,
        daysOfWeek: form.daysOfWeek.length > 0 ? form.daysOfWeek.join(',') : null,
        hourRange: form.hourRange || null,
        isActive: form.isActive,
        priority: form.priority,
        openNewTab: form.openNewTab,
        widthHint: form.widthHint,
        heightHint: form.heightHint,
        linkUrl: form.type === 'static' ? (form.linkUrl || null) : null,
      }
      if (form.type === 'static') {
        data.images = staticImage
      } else {
        data.images = JSON.stringify(slides.filter(s => s.url))
      }
      await onSave(data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">{ad ? 'Editar Anúncio' : 'Novo Anúncio'}</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        </div>

        {/* Name */}
        <div>
          <Label className="text-xs font-medium">Nome interno *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Banner promoção Black Friday"
            className="mt-1"
          />
        </div>

        {/* Type */}
        <div>
          <Label className="text-xs font-medium mb-2 block">Tipo</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'static' })}
              className={cn('p-2.5 border rounded-lg text-left transition-all', form.type === 'static' ? 'border-primary bg-primary/5' : 'border-zinc-200')}
            >
              <div className="text-xs font-semibold">Imagem Estática</div>
              <div className="text-[10px] text-zinc-500">Uma única imagem</div>
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'slider' })}
              className={cn('p-2.5 border rounded-lg text-left transition-all', form.type === 'slider' ? 'border-primary bg-primary/5' : 'border-zinc-200')}
            >
              <div className="text-xs font-semibold">Slider (múltiplas)</div>
              <div className="text-[10px] text-zinc-500">Várias imagens rotativas</div>
            </button>
          </div>
        </div>

        {/* Images */}
        {form.type === 'static' ? (
          <div>
            <Label className="text-xs font-medium">Imagem *</Label>
            <p className="text-[10px] text-zinc-500 mb-2">Recomendado: 728x90px (leaderboard) ou 970x90px (super leaderboard).</p>
            <ImageUpload
              value={staticImage}
              onChange={(url) => setStaticImage(url)}
              placeholder="URL da imagem ou faça upload"
            />
            {staticImage && (
              <div className="mt-2 aspect-[8/1] bg-zinc-100 rounded overflow-hidden border border-zinc-200">
                <img src={staticImage} alt="" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="mt-2">
              <Label className="text-xs font-medium">Link (opcional)</Label>
              <Input
                value={form.linkUrl}
                onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                placeholder="https://destino.com/campanha"
                className="mt-1"
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium">Slides *</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSlides([...slides, { url: '', link: '' }])}
                className="h-7 text-xs"
              >
                <PlusIcon className="h-3 w-3 mr-1" /> Adicionar slide
              </Button>
            </div>
            <div className="space-y-3">
              {slides.map((slide, i) => (
                <div key={i} className="border border-zinc-200 rounded-lg p-3 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Slide {i + 1}</span>
                    {slides.length > 1 && (
                      <button
                        onClick={() => setSlides(slides.filter((_, j) => j !== i))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <ImageUpload
                    value={slide.url}
                    onChange={(url) => {
                      const next = [...slides]
                      next[i] = { ...next[i], url }
                      setSlides(next)
                    }}
                    placeholder="URL da imagem ou faça upload"
                  />
                  <Input
                    value={slide.link}
                    onChange={(e) => {
                      const next = [...slides]
                      next[i] = { ...next[i], link: e.target.value }
                      setSlides(next)
                    }}
                    placeholder="Link deste slide (opcional)"
                    className="text-xs"
                  />
                  {slide.url && (
                    <div className="aspect-[8/1] bg-zinc-100 rounded overflow-hidden">
                      <img src={slide.url} alt="" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Label className="text-xs font-medium">Intervalo entre slides (ms)</Label>
              <Input
                type="number"
                value={form.slideInterval}
                onChange={(e) => setForm({ ...form, slideInterval: parseInt(e.target.value) || 5000 })}
                className="mt-1"
                min={1000}
                step={500}
              />
              <p className="text-[10px] text-zinc-500 mt-1">Padrão: 5000ms (5 segundos). Mínimo: 1000ms.</p>
            </div>
          </div>
        )}

        {/* Animation */}
        <div>
          <Label className="text-xs font-medium">Animação</Label>
          <Select value={form.animation} onValueChange={(v) => setForm({ ...form, animation: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANIMATIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Position */}
        <div>
          <Label className="text-xs font-medium">Posição no Header</Label>
          <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Scheduling */}
        <div className="border-t border-zinc-100 pt-4">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Agendamento</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> Início</Label>
              <Input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> Fim</Label>
              <Input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          {/* Days of week */}
          <div className="mt-3">
            <Label className="text-xs font-medium mb-1.5 block">Dias da semana (vazio = todos)</Label>
            <div className="flex gap-1 flex-wrap">
              {DAYS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    'h-8 w-10 text-xs rounded border transition-all',
                    form.daysOfWeek.includes(d.value)
                      ? 'bg-primary text-white border-primary'
                      : 'border-zinc-200 hover:border-zinc-300'
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          {/* Hour range */}
          <div className="mt-3">
            <Label className="text-xs font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> Faixa de horário (opcional)</Label>
            <Input
              value={form.hourRange}
              onChange={(e) => setForm({ ...form, hourRange: e.target.value })}
              placeholder="08:00-22:00"
              className="mt-1"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Formato: HH:MM-HH:MM. Vazio = exibe o dia todo.</p>
          </div>
        </div>

        {/* Options */}
        <div className="border-t border-zinc-100 pt-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Opções</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Prioridade</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Maior = aparece primeiro</p>
            </div>
            <div>
              <Label className="text-xs font-medium">Altura máx (px)</Label>
              <Input
                type="number"
                value={form.heightHint}
                onChange={(e) => setForm({ ...form, heightHint: parseInt(e.target.value) || 90 })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.openNewTab} onCheckedChange={(v) => setForm({ ...form, openNewTab: v })} id="new-tab" />
            <Label htmlFor="new-tab" className="cursor-pointer text-xs">Abrir link em nova aba</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} id="active" />
            <Label htmlFor="active" className="cursor-pointer text-xs">Ativo (exibir no portal)</Label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {ad ? 'Salvar Alterações' : 'Criar Anúncio'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function parseImages(images: string, type: string): string[] {
  try {
    const parsed = JSON.parse(images)
    if (Array.isArray(parsed)) return parsed.map((p: any) => typeof p === 'string' ? p : p.url)
    return [parsed.url || parsed]
  } catch {
    return type === 'slider' ? [] : [images]
  }
}
