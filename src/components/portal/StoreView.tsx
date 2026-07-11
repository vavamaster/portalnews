'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { ImageTips } from '@/components/ui/image-tips'
import { ShoppingBag, Coins, Flame, CheckCircle2, Clock, Megaphone } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const PLACEMENTS = [
  { value: 'HOME_SIDEBAR', label: 'Sidebar da Home' },
  { value: 'HOME_MIDDLE', label: 'Meio da Home' },
  { value: 'ARTICLE_SIDEBAR', label: 'Sidebar de Artigos' },
  { value: 'FOOTER_BANNER', label: 'Banner do Rodapé' },
]

export function StoreView() {
  const { user, setView, refreshUser } = useAppStore()
  const { toast } = useToast()
  const [config, setConfig] = useState<any>({})
  const [myAds, setMyAds] = useState<any[]>([])
  const [siteName, setSiteName] = useState('Portal de Notícias')
  const [form, setForm] = useState({
    title: '', content: '', imageUrl: '', linkUrl: '', placement: 'HOME_SIDEBAR', durationDays: '7',
  })
  const [submitting, setSubmitting] = useState(false)

  // Load site name from SEO settings
  useEffect(() => {
    fetch('/api/seo').then(r => r.json()).then(d => {
      if (d.settings?.site_name) setSiteName(d.settings.site_name)
    }).catch(() => {})
  }, [])

  const load = async () => {
    if (!user) return
    try {
      const creditsRes = await fetch('/api/credits')
      const creditsData = await creditsRes.json()
      setConfig(creditsData.config || {})
      const adsRes = await fetch('/api/ads?ownerOnly=true')
      const adsData = await adsRes.json()
      setMyAds(adsData.ads || [])
    } catch {}
  }

  useEffect(() => { load() }, [user])

  if (!user) {
    return (
      <div className="news-container py-16 text-center">
        <ShoppingBag className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Faça login para anunciar</h1>
        <p className="text-zinc-600 mb-6">Crie sua conta gratuita, ganhe pontos e troque por anúncios grátis.</p>
        <Button onClick={() => setView({ name: 'register' })} className="bg-primary">Criar conta</Button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (user.credits < (config.freeAdCostCredits || 20)) {
      toast({
        title: 'Créditos insuficientes',
        description: `Você precisa de ${config.freeAdCostCredits || 20} créditos. Você tem ${user.credits}.`,
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/store/free-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        toast({
          title: 'Anúncio enviado!',
          description: `${data.creditsSpent} créditos gastos. Aguarde aprovação do administrador.`,
        })
        setForm({ title: '', content: '', imageUrl: '', linkUrl: '', placement: 'HOME_SIDEBAR', durationDays: '7' })
        await refreshUser()
        load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="news-container py-8 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
            <Flame className="h-3 w-3" /> Anúncio Grátis com Créditos
          </div>
          <h1 className="font-black text-3xl sm:text-4xl text-zinc-900 mb-2">Anuncie no {siteName}</h1>
          <p className="text-zinc-600 max-w-2xl mx-auto">
            Use seus créditos para publicar anúncios no portal. Alcance milhares de leitores diários.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Megaphone className="h-5 w-5 text-primary" /> Criar Anúncio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Coins className="h-5 w-5 text-emerald-600" />
                  <span>Seus créditos: <strong className="text-zinc-900">{user.credits}</strong></span>
                </div>
                <div className="text-sm text-emerald-700 font-medium">
                  Custo: {config.freeAdCostCredits || 20} créditos
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="title" className="text-sm">Título do anúncio *</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    placeholder="Ex: Promoção de Inverno - 30% OFF"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="content" className="text-sm">Conteúdo/Descrição *</Label>
                  <Textarea
                    id="content"
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    required
                    placeholder="Descrição do seu anúncio. Suporta HTML básico (<strong>, <em>)."
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <div>
                  <Label className="text-sm">Imagem do anúncio (opcional)</Label>
                  <ImageTips context="store" className="mb-2" />
                  <ImageUpload
                    value={form.imageUrl}
                    onChange={(url) => setForm({ ...form, imageUrl: url })}
                    placeholder="URL da imagem ou faça upload"
                  />
                </div>
                <div>
                  <Label htmlFor="linkUrl" className="text-sm">Link de destino (opcional)</Label>
                  <Input
                    id="linkUrl"
                    type="url"
                    value={form.linkUrl}
                    onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                    placeholder="https://seusite.com.br"
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="placement" className="text-sm">Posicionamento *</Label>
                    <Select value={form.placement} onValueChange={(v) => setForm({ ...form, placement: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLACEMENTS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="duration" className="text-sm">Duração</Label>
                    <Select value={form.durationDays} onValueChange={(v) => setForm({ ...form, durationDays: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 dias</SelectItem>
                        <SelectItem value="15">15 dias</SelectItem>
                        <SelectItem value="30">30 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-blue-700" disabled={submitting || user.credits < (config.freeAdCostCredits || 20)}>
                  {submitting ? 'Enviando...' : (
                    <>
                      <Flame className="h-4 w-4 mr-2" />
                      Publicar Anúncio ({config.freeAdCostCredits || 20} créditos)
                    </>
                  )}
                </Button>
                {user.credits < (config.freeAdCostCredits || 20) && (
                  <p className="text-xs text-amber-700 text-center">
                    Créditos insuficientes. <button type="button" onClick={() => setView({ name: 'credits' })} className="underline font-medium">Converter pontos</button>
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          {/* My ads + Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Como funciona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
                  <p>Leia notícias e reaja para ganhar pontos (limitado por post).</p>
                </div>
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
                  <p>Troque pontos por créditos (10 pts = 1 crédito).</p>
                </div>
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</div>
                  <p>Use créditos para publicar anúncios grátis no portal.</p>
                </div>
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">4</div>
                  <p>Seu anúncio entra em moderação. Após aprovação, vai ao ar!</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Meus Anúncios</CardTitle>
              </CardHeader>
              <CardContent>
                {myAds.length === 0 ? (
                  <div className="text-sm text-zinc-500 text-center py-6">
                    Você ainda não criou anúncios.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                    {myAds.map((ad) => (
                      <div key={ad.id} className="border border-zinc-200 rounded-md p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm text-zinc-900 line-clamp-1">{ad.title}</div>
                          <StatusBadge status={ad.status} />
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {ad.placement} · {ad.isFreeAd ? 'Grátis (créditos)' : 'Pago'}
                        </div>
                        {ad.startAt && ad.endAt && (
                          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(ad.startAt).toLocaleDateString('pt-BR')} - {new Date(ad.endAt).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-100">
                          <span>{ad.impressions} impressões</span>
                          <span>{ad.clicks} cliques</span>
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
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    ACTIVE: 'bg-emerald-100 text-emerald-800',
    PAUSED: 'bg-zinc-100 text-zinc-700',
    EXPIRED: 'bg-zinc-100 text-zinc-700',
    REJECTED: 'bg-red-100 text-red-800',
  }
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    ACTIVE: 'Ativo',
    PAUSED: 'Pausado',
    EXPIRED: 'Expirado',
    REJECTED: 'Rejeitado',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles[status] || 'bg-zinc-100'}`}>
      {labels[status] || status}
    </span>
  )
}
