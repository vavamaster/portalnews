'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChevronLeft, Save, Plus, X, ImageIcon, MapPin, Building2, User as UserIcon, Loader2,
  Lock, AlertCircle, Award, Sparkles, Package
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { ImageTips } from '@/components/ui/image-tips'
import { getPlanConfig } from '@/lib/plans'
import { useApiError } from '@/hooks/use-api-error'
import { safeJsonArray } from '@/lib/utils'

interface Props {
  listingId?: string
}

export function ClassifiedEditor({ listingId }: Props) {
  const { user, setView, refreshUser, hydrated } = useAppStore()
  const { toast } = useToast()
  const apiError = useApiError()
  const [categories, setCategories] = useState<any[]>([])
  const [subscription, setSubscription] = useState<any | null>(null)
  const [loading, setLoading] = useState(!!listingId)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    title: '', description: '', price: '', isNegotiable: false,
    categoryId: '', personType: 'PF',
    document: '', businessName: '',
    phone: '', whatsapp: '', email: '', website: '',
    address: '', city: '', state: '', zipCode: '',
    latitude: null, longitude: null,
    photos: [] as string[], logoUrl: '', services: [] as any[],
  })
  const [geoLoading, setGeoLoading] = useState(false)
  const [needPointsConfirm, setNeedPointsConfirm] = useState(false)
  const [subsLoading, setSubsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/classified-categories').then(r => r.json()),
      fetch('/api/subscriptions').then(r => r.json()),
    ]).then(([catsData, subsData]) => {
      setCategories(catsData.categories || [])
      const activeSub = (subsData.subscriptions || []).find((s: any) => s.status === 'ACTIVE')
      setSubscription(activeSub || null)
      if (!listingId && activeSub && catsData.categories[0]) {
        setForm((f: any) => ({ ...f, categoryId: catsData.categories[0].id }))
      }
    }).finally(() => setSubsLoading(false))
    if (listingId) {
      fetch(`/api/classifieds/${listingId}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) {
            apiError(data.error, 'Erro ao carregar')
            setView({ name: 'advertiser' })
            return
          }
          if (data.listing) {
            const l = data.listing
            setForm({
              title: l.title, description: l.description, price: l.price?.toString() || '', isNegotiable: l.isNegotiable,
              categoryId: l.categoryId, personType: l.personType,
              document: l.document || '', businessName: l.businessName || '',
              phone: l.phone || '', whatsapp: l.whatsapp || '', email: l.email || '', website: l.website || '',
              address: l.address || '', city: l.city || '', state: l.state || '', zipCode: l.zipCode || '',
              latitude: l.latitude, longitude: l.longitude,
              photos: safeJsonArray<string>(l.photos, []), logoUrl: l.logoUrl || '',
              services: safeJsonArray<any>(l.services, []),
            })
          }
        })
        .catch(() => {
          apiError('Não foi possível carregar o anúncio')
          setView({ name: 'advertiser' })
        })
        .finally(() => setLoading(false))
    }
  }, [listingId])

  if (!hydrated) return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 rounded-full border-4 border-zinc-200 border-t-primary animate-spin" /></div>
  if (!user) {
    return (
      <div className="news-container py-16 text-center">
        <AlertCircle className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Faça login para anunciar</h1>
        <Button onClick={() => setView({ name: 'login' })} className="bg-amber-600 hover:bg-amber-700 mt-3">Entrar</Button>
      </div>
    )
  }

  if (!loading && !subsLoading && !subscription) {
    return (
      <div className="news-container py-16 text-center">
        <AlertCircle className="h-12 w-12 text-amber-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Você precisa de um plano</h1>
        <p className="text-zinc-600 mb-6 max-w-md mx-auto">
          Para criar anúncios nos classificados, escolha um plano. O plano Grátis permite 1 anúncio (e mais pagando com pontos).
        </p>
        <Button onClick={() => setView({ name: 'plans' })} className="bg-amber-600 hover:bg-amber-700">
          Ver planos
        </Button>
      </div>
    )
  }

  const plan = subscription?.plan
  if (!plan) return null
  const planConfig = subscription?.plan ? getPlanConfig(subscription.plan.slug) : null
  const pjDisabled = planConfig?.personType === 'PF'
  const pfDisabled = planConfig?.personType === 'PJ'
  const personTypeHint = pjDisabled ? 'Seu plano é exclusivo para PF' : pfDisabled ? 'Seu plano é exclusivo para PJ' : null

  const handleGeocode = async () => {
    setGeoLoading(true)
    try {
      const params = new URLSearchParams()
      if (form.address) params.set('address', form.address)
      if (form.city) params.set('city', form.city)
      if (form.state) params.set('state', form.state)
      if (form.zipCode) params.set('zipCode', form.zipCode)
      const res = await fetch(`/api/geocode?${params.toString()}`)
      const data = await res.json()
      if (data.error) {
        apiError(data.error, 'Endereço não encontrado')
      } else {
        setForm({ ...form, latitude: data.latitude, longitude: data.longitude })
        toast({ title: 'Localização encontrada!', description: data.displayName })
      }
    } catch (e: any) {
      apiError(e.message)
    } finally {
      setGeoLoading(false)
    }
  }

  const handleSave = async (usePoints = false) => {
    if (!form.title || !form.description || !form.categoryId || !form.personType) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body = {
        ...form,
        price: form.price ? parseFloat(form.price) : null,
        usePoints,
      }
      const url = listingId ? `/api/classifieds/${listingId}` : '/api/classifieds'
      const method = listingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.needPoints) {
        setNeedPointsConfirm(true)
        setSaving(false)
        return
      }
      if (data.error) {
        apiError(data.error)
      } else {
        setNeedPointsConfirm(false)
        toast({ title: listingId ? 'Anúncio atualizado!' : 'Anúncio publicado!', description: data.pointsCharged ? `${data.pointsCharged} pontos debitados` : undefined })
        await refreshUser()
        setView({ name: 'advertiser' })
      }
    } catch (e: any) {
      apiError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="news-container py-12 text-center text-zinc-500 flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>

  return (
    <div className="news-container py-6 animate-fade-in">
      <button onClick={() => setView({ name: 'advertiser' })} className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-amber-600 mb-4">
        <ChevronLeft className="h-4 w-4" /> Voltar aos meus anúncios
      </button>

      <div className="mb-6">
        <h1 className="font-black text-3xl text-zinc-900">{listingId ? 'Editar anúncio' : 'Novo anúncio'}</h1>
        <p className="text-zinc-600 mt-1">
          Plano atual: <strong className="text-amber-600">{plan.name}</strong>
          {' · '}Fotos: até {plan.maxPhotosPerListing}
          {' · '}Serviços: até {plan.maxServicesPerListing === -1 ? '∞' : plan.maxServicesPerListing}
          {' · '}Contatos: {plan.allowWhatsApp ? '✓' : '✗'} WhatsApp, {plan.allowPhone ? '✓' : '✗'} Tel, {plan.allowEmail ? '✓' : '✗'} Email, {plan.allowMap ? '✓' : '✗'} Mapa
        </p>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="basic">Dados básicos</TabsTrigger>
          <TabsTrigger value="media">Fotos & Logo</TabsTrigger>
          <TabsTrigger value="contact">Contato & Localização</TabsTrigger>
          {plan.allowServices && <TabsTrigger value="services">Produtos/Serviços</TabsTrigger>}
        </TabsList>

        {/* Basic */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div>
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Honda Civic 2020 - único dono" className="mt-1" />
              </div>
              <div>
                <Label>Descrição *</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} placeholder="Descreva detalhes, condições, etc." className="mt-1" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Categoria *</Label>
                  <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Preço (R$)</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" className="mt-1" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <Switch checked={form.isNegotiable} onCheckedChange={(v) => setForm({ ...form, isNegotiable: v })} />
                    <span className="text-sm">Preço negociável</span>
                  </label>
                </div>
              </div>
              <div>
                <Label>Tipo de anunciante *</Label>
                <Select value={form.personType} onValueChange={(v) => setForm({ ...form, personType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PF" disabled={pfDisabled}><span className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> Pessoa Física (CPF)</span></SelectItem>
                    <SelectItem value="PJ" disabled={pjDisabled}><span className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Empresa / CNPJ</span></SelectItem>
                  </SelectContent>
                </Select>
                {personTypeHint && (
                  <p className="text-xs text-amber-700 mt-1">{personTypeHint}</p>
                )}
              </div>
              {form.personType === 'PJ' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>CNPJ</Label>
                    <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="00.000.000/0000-00" className="mt-1" />
                  </div>
                  <div>
                    <Label>Razão Social</Label>
                    <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="mt-1" />
                  </div>
                </div>
              )}
              {form.personType === 'PF' && (
                <div>
                  <Label>CPF (opcional)</Label>
                  <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="000.000.000-00" className="mt-1" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Media */}
        <TabsContent value="media" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Fotos do anúncio</span>
                <span className="text-xs font-normal text-zinc-500">{form.photos.length}/{plan.maxPhotosPerListing}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ImageTips context="classified" className="mb-3" />
              {form.photos.length < plan.maxPhotosPerListing && (
                <div className="mb-3">
                  <ImageUpload
                    value=""
                    onChange={(url) => {
                      if (url) setForm({ ...form, photos: [...form.photos, url] })
                    }}
                    label="Adicionar foto (URL ou upload)"
                    placeholder="URL da foto ou faça upload"
                  />
                </div>
              )}
              {form.photos.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">Nenhuma foto adicionada. Use URLs de imagens (Imgur, ImgBB, etc).</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {form.photos.map((url: string, i: number) => (
                    <div key={i} className="relative aspect-square">
                      <img src={url} alt="" className="w-full h-full object-cover rounded" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, photos: form.photos.filter((_: any, j: number) => j !== i) })}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center hover:bg-red-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {i === 0 && <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">Capa</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {plan.allowLogo && (
            <Card>
              <CardHeader><CardTitle className="text-base">Logo da empresa</CardTitle></CardHeader>
              <CardContent>
                <ImageUpload
                  value={form.logoUrl || ''}
                  onChange={(url) => setForm({ ...form, logoUrl: url })}
                  placeholder="URL do logo ou faça upload"
                />
                {form.logoUrl && <img src={form.logoUrl} alt="Logo" className="h-16 w-16 rounded mt-2" />}
              </CardContent>
            </Card>
          )}
          {!plan.allowLogo && (
            <FeatureLocked title="Logo da empresa" plan={plan.name} />
          )}
        </TabsContent>

        {/* Contact */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Contatos</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1 text-sm">
                  Telefone
                  {!plan.allowPhone && <Lock className="h-3 w-3 text-zinc-400" />}
                </Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!plan.allowPhone} placeholder="(66) 3000-0000" className="mt-1" />
              </div>
              <div>
                <Label className="flex items-center gap-1 text-sm">
                  WhatsApp (com DDI)
                  {!plan.allowWhatsApp && <Lock className="h-3 w-3 text-zinc-400" />}
                </Label>
                <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} disabled={!plan.allowWhatsApp} placeholder="5566996000000" className="mt-1" />
              </div>
              <div>
                <Label className="flex items-center gap-1 text-sm">
                  Email
                  {!plan.allowEmail && <Lock className="h-3 w-3 text-zinc-400" />}
                </Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!plan.allowEmail} placeholder="contato@empresa.com" className="mt-1" />
              </div>
              <div>
                <Label className="flex items-center gap-1 text-sm">
                  Website
                  {!plan.allowEmail && <Lock className="h-3 w-3 text-zinc-400" />}
                </Label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} disabled={!plan.allowEmail} placeholder="https://..." className="mt-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Localização
                {!plan.allowMap && <Lock className="h-3 w-3 text-zinc-400" />}
              </CardTitle>
            </CardHeader>
            <CardContent className={plan.allowMap ? '' : 'opacity-50 pointer-events-none'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-sm">Endereço</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Cidade</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Estado</Label>
                  <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">CEP</Label>
                  <Input value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} placeholder="00000-000" className="mt-1" />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" size="sm" onClick={handleGeocode} disabled={geoLoading || !plan.allowMap}>
                    {geoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
                    Buscar no mapa
                  </Button>
                </div>
              </div>
              {form.latitude && form.longitude && plan.allowMap && (
                <div className="mt-3 aspect-video bg-zinc-100 rounded overflow-hidden">
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${form.longitude - 0.01}%2C${form.latitude - 0.01}%2C${form.longitude + 0.01}%2C${form.latitude + 0.01}&layer=mapnik&marker=${form.latitude}%2C${form.longitude}`}
                    className="w-full h-full border-0"
                    title="Mapa"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services */}
        {plan.allowServices && (
          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><Package className="h-4 w-4" /> Produtos/Serviços</span>
                  <span className="text-xs font-normal text-zinc-500">{form.services.length}/{plan.maxServicesPerListing === -1 ? '∞' : plan.maxServicesPerListing}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(plan.maxServicesPerListing === -1 || form.services.length < plan.maxServicesPerListing) && (
                  <Button type="button" variant="outline" size="sm" className="mb-3" onClick={() => setForm({ ...form, services: [...form.services, { name: '', price: '', description: '', photo: '' }] })}>
                    <Plus className="h-4 w-4 mr-2" /> Adicionar item
                  </Button>
                )}
                {form.services.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">Nenhum produto/serviço. Adicione para mostrar um catálogo.</p>
                ) : (
                  <div className="space-y-3">
                    {form.services.map((s: any, i: number) => (
                      <div key={i} className="border border-zinc-200 rounded p-3 grid grid-cols-1 sm:grid-cols-[2fr_1fr_2fr_1fr_auto] gap-2 items-end">
                        <div>
                          <Label className="text-xs">Nome</Label>
                          <Input value={s.name} onChange={(e) => { const sv = [...form.services]; sv[i] = { ...sv[i], name: e.target.value }; setForm({ ...form, services: sv }) }} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Preço (R$)</Label>
                          <Input type="number" value={s.price} onChange={(e) => { const sv = [...form.services]; sv[i] = { ...sv[i], price: parseFloat(e.target.value) || 0 }; setForm({ ...form, services: sv }) }} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Descrição</Label>
                          <Input value={s.description} onChange={(e) => { const sv = [...form.services]; sv[i] = { ...sv[i], description: e.target.value }; setForm({ ...form, services: sv }) }} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Foto URL</Label>
                          <Input value={s.photo} onChange={(e) => { const sv = [...form.services]; sv[i] = { ...sv[i], photo: e.target.value }; setForm({ ...form, services: sv }) }} className="mt-1" />
                        </div>
                        <Button type="button" size="icon" variant="ghost" className="text-red-600" onClick={() => setForm({ ...form, services: form.services.filter((_: any, j: number) => j !== i) })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Action bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 bg-white border border-zinc-200 rounded-lg p-3 sticky bottom-4 shadow-lg">
        <div className="text-sm text-zinc-600">
          {subscription?.listingsUsedThisCycle || 0} / {plan.maxListings === -1 ? '∞' : plan.maxListings} anúncios usados no ciclo
        </div>
        <div className="flex items-center gap-2">
          {needPointsConfirm && (
            <div className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 text-amber-600" />
              <span>Use <strong>{plan.pointsPerListing} pontos</strong> para um anúncio extra</span>
            </div>
          )}
          <Button variant="outline" onClick={() => setView({ name: 'advertiser' })}>
            Cancelar
          </Button>
          <Button onClick={() => handleSave(needPointsConfirm)} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {needPointsConfirm ? `Publicar com ${plan.pointsPerListing} pts` : (listingId ? 'Salvar alterações' : 'Publicar anúncio')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function FeatureLocked({ title, plan }: { title: string; plan: string }) {
  const { setView } = useAppStore()
  return (
    <Card className="border-dashed border-zinc-300 bg-zinc-50">
      <CardContent className="pt-5 text-center">
        <Lock className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
        <div className="font-bold text-zinc-700">{title}</div>
        <p className="text-xs text-zinc-500 mb-3">Disponível em planos pagos. Seu plano atual: <strong>{plan}</strong></p>
        <Button size="sm" variant="outline" onClick={() => setView({ name: 'plans' })}>
          <Sparkles className="h-3 w-3 mr-1" /> Fazer upgrade
        </Button>
      </CardContent>
    </Card>
  )
}
