'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn, safeJsonArray, getColorClasses, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  MapPin, Phone, MessageCircle, Mail, Globe, Eye, Clock, ChevronLeft, ChevronRight,
  BadgeCheck, Star, Flame, Lock, ShieldCheck, ExternalLink, Send, Award, Sparkles, Store, Building2, User as UserIcon, Bookmark
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { CATEGORY_ICONS } from './ClassifiedsView'
import { UserAvatar } from '@/components/portal/UserAvatar'
import { useApiError } from '@/hooks/use-api-error'

const FALLBACK_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#f4f4f5"/><g fill="#d4d4d8"><rect x="350" y="220" width="100" height="80" rx="6"/><circle cx="400" cy="200" r="22"/><path d="M 280 380 L 350 290 L 420 360 L 470 320 L 540 380 Z"/></g><text x="400" y="450" font-family="system-ui, sans-serif" font-size="20" fill="#a1a1aa" text-anchor="middle">Sem foto</text></svg>')}`

interface Review {
  id: string; rating: number; comment?: string | null; createdAt: string
  reviewer: { id: string; name: string; avatar?: string | null }
}

interface Listing {
  id: string; slug: string; title: string; description: string; price: number | null; isNegotiable: boolean
  personType: string; document?: string | null; businessName?: string | null
  phone?: string | null; whatsapp?: string | null; email?: string | null; website?: string | null
  address?: string | null; city?: string | null; state?: string | null; zipCode?: string | null
  latitude?: number | null; longitude?: number | null
  photos?: string | null; logoUrl?: string | null; services?: string | null
  featured: boolean; boosted: boolean; boostedUntil?: string | null; views: number
  publishedAt?: string | null; createdAt: string; status: string
  category: { id: string; slug: string; name: string; icon: string; color: string }
  owner: { id: string; name: string; avatar?: string | null; email: string }
  plan: {
    slug: string; name: string; badgeColor?: string | null
    allowWhatsApp: boolean; allowPanelMessage: boolean; allowPhone: boolean; allowEmail: boolean
    allowMap: boolean; allowLogo: boolean; allowReviews: boolean; allowServices: boolean
    allowBoost: boolean; allowVerified?: boolean; allowFeatured?: boolean
    allowAnalytics?: boolean; allowPoints?: boolean
    pointsPerBoost3d: number; pointsPerBoost7d: number; pointsPerBoost15d: number
  }
  reviews: Review[]
  _count?: { reviews: number; leads: number }
}

export function ClassifiedDetailView({ slug }: { slug: string }) {
  const { user, setView, refreshUser } = useAppStore()
  const { toast } = useToast()
  const apiError = useApiError()
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [galleryOpen, setGalleryOpen] = useState<number | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [leadForm, setLeadForm] = useState({ senderName: '', senderEmail: '', senderPhone: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [boostOpen, setBoostOpen] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true)
    fetch(`/api/classifieds?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(data => { setListing(data.listing || null) })
      .finally(() => setLoading(false))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [slug])

  // Check favorite after listing loads
  useEffect(() => {
    if (!listing || !user) return
    fetch('/api/favorites')
      .then(r => r.json())
      .then(data => {
        const fav = (data.favorites || []).find((f: any) => f.listingId === listing.id)
        setIsFavorite(!!fav)
      })
      .catch(() => {})
  }, [listing?.id, user])

  if (loading) {
    return (
      <div className="news-container py-12 text-center text-zinc-500">
        <div className="animate-pulse">Carregando anúncio...</div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="news-container py-16 text-center">
        <Store className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Anúncio não encontrado</h1>
        <Button onClick={() => setView({ name: 'classifieds' })} className="bg-amber-600 hover:bg-amber-700 mt-3">
          Ver classificados
        </Button>
      </div>
    )
  }

  const photos: string[] = safeJsonArray<string>(listing.photos, [])
  const services: { name: string; price: number; description?: string; photo?: string }[] = safeJsonArray<any>(listing.services, [])
  const Icon = CATEGORY_ICONS[listing.category.icon] || Store
  const isOwner = user?.id === listing.owner.id
  const isBoosted = listing.boosted && listing.boostedUntil && new Date(listing.boostedUntil) > new Date()
  const avgRating = listing.reviews.length > 0 ? listing.reviews.reduce((a, r) => a + r.rating, 0) / listing.reviews.length : 0
  const dateStr = formatDate(listing.publishedAt || listing.createdAt, 'long')
  const catColors = getColorClasses(listing.category.color)
  const wa = listing.whatsapp?.replace(/\D/g, '')
  const tel = listing.phone?.replace(/\D/g, '')

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!listing) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/classifieds/${listing.id}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leadForm, channel: 'PANEL' }),
      })
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        toast({ title: 'Mensagem enviada!', description: 'O anunciante receberá sua mensagem no painel.' })
        setContactOpen(false)
        setLeadForm({ senderName: '', senderEmail: '', senderPhone: '', message: '' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleBoost = async (tierId: '3d' | '7d' | '15d') => {
    if (!listing) return
    try {
      const res = await fetch(`/api/classifieds/${listing.id}/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId }),
      })
      if (!res.ok) {
        apiError('Falha ao impulsionar')
        return
      }
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        toast({ title: 'Anúncio impulsionado!', description: `${data.pointsSpent} pontos gastos. Válido até ${formatDate(data.boostedUntil, 'short')}` })
        setBoostOpen(false)
        await refreshUser()
        // reload listing
        const r = await fetch(`/api/classifieds?slug=${slug}`)
        const d = await r.json()
        setListing(d.listing)
      }
    } catch {
      apiError('Falha ao impulsionar')
    }
  }

  const handleActivate = async () => {
    if (!listing) return
    try {
      const res = await fetch(`/api/classifieds/${listing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && !data.error) {
        toast({ title: 'Anúncio ativado!' })
        const r = await fetch(`/api/classifieds?slug=${slug}`)
        const d = await r.json()
        setListing(d.listing)
      } else {
        apiError(data.error || 'Falha ao ativar')
      }
    } catch {
      apiError('Falha ao ativar')
    }
  }

  const handleToggleFavorite = async () => {
    if (!listing) return
    if (!user) {
      toast({ title: 'Faça login para favoritar', variant: 'destructive' })
      setView({ name: 'login' })
      return
    }
    setFavoriteLoading(true)
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id }),
      })
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        setIsFavorite(data.action === 'added')
        toast({ title: data.action === 'added' ? 'Adicionado aos favoritos!' : 'Removido dos favoritos' })
      }
    } finally {
      setFavoriteLoading(false)
    }
  }

  return (
    <div className="news-container py-6 animate-fade-in">
      {/* Breadcrumb */}
      <button onClick={() => setView({ name: 'classifieds' })} className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-amber-600 mb-4">
        <ChevronLeft className="h-4 w-4" /> Voltar aos classificados
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* Gallery */}
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video bg-zinc-100 overflow-hidden rounded-t-lg">
                <img src={photos[0] || FALLBACK_IMAGE} alt={listing.title} className="w-full h-full object-cover" />
              </div>
              {photos.length > 1 && (
                <div className="p-3 grid grid-cols-5 gap-2">
                  {photos.slice(0, 5).map((p, i) => (
                    <button key={i} onClick={() => setGalleryOpen(i)} className="aspect-square overflow-hidden rounded bg-zinc-100">
                      <img src={p} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Title + price */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold', catColors.bg, catColors.text)}>
                  <Icon className="h-3 w-3" /> {listing.category.name}
                </span>
                {listing.featured && (
                  <span className="inline-flex items-center gap-0.5 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                    <Star className="h-3 w-3" /> Destaque
                  </span>
                )}
                {isBoosted && (
                  <span className="inline-flex items-center gap-0.5 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                    <Flame className="h-3 w-3" /> Boost ativo
                  </span>
                )}
                <span className="text-xs text-zinc-500 ml-auto flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {listing.views} visualizações
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <h1 className="font-black text-2xl sm:text-3xl text-zinc-900 flex-1">{listing.title}</h1>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleToggleFavorite}
                  disabled={favoriteLoading}
                  className={cn('flex-shrink-0', isFavorite && 'border-pink-400 bg-pink-50 text-pink-600')}
                  title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <Bookmark className={cn('h-4 w-4', isFavorite && 'fill-pink-500 text-pink-500')} />
                </Button>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                {listing.price !== null ? (
                  <span className="font-black text-3xl text-amber-700">
                    R$ {listing.price.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span className="text-zinc-500">Preço a combinar</span>
                )}
                {listing.isNegotiable && <span className="text-sm text-zinc-500">(negociável)</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500 mt-2">
                <Clock className="h-3 w-3" /> Publicado em {dateStr}
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader><CardTitle className="text-base">Descrição</CardTitle></CardHeader>
            <CardContent>
              <p className="text-zinc-700 whitespace-pre-wrap">{listing.description}</p>
            </CardContent>
          </Card>

          {/* Services / Products */}
          {services.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  {listing.personType === 'PJ' ? 'Produtos/Serviços' : 'Serviços'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((s, i) => (
                    <div key={i} className="border border-zinc-200 rounded-md p-3 flex gap-3">
                      {s.photo && (
                        <img src={s.photo} alt={s.name} className="h-16 w-16 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-zinc-900">{s.name}</div>
                        {s.description && <div className="text-xs text-zinc-600 mt-0.5">{s.description}</div>}
                        <div className="font-bold text-amber-700 mt-1">R$ {s.price.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Map */}
          {listing.plan.allowMap && listing.latitude && listing.longitude && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-amber-600" /> Localização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-zinc-100 rounded overflow-hidden">
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.longitude - 0.01}%2C${listing.latitude - 0.01}%2C${listing.longitude + 0.01}%2C${listing.latitude + 0.01}&layer=mapnik&marker=${listing.latitude}%2C${listing.longitude}`}
                    className="w-full h-full border-0"
                    title="Mapa da localização"
                  />
                </div>
                {listing.address && (
                  <p className="text-sm text-zinc-600 mt-2 flex items-start gap-1">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {listing.address}{listing.city && `, ${listing.city}`}{listing.state && ` - ${listing.state}`}{listing.zipCode && ` · CEP ${listing.zipCode}`}
                  </p>
                )}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${listing.latitude}&mlon=${listing.longitude}#map=16/${listing.latitude}/${listing.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-600 hover:underline mt-2 inline-flex items-center gap-1"
                >
                  Ver mapa ampliado <ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>
          )}

          {/* Reviews */}
          {listing.plan.allowReviews && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" /> Avaliações ({listing.reviews.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {listing.reviews.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 pb-3 border-b border-zinc-100">
                      <div className="text-3xl font-black text-amber-600">{avgRating.toFixed(1)}</div>
                      <div className="flex flex-col">
                        <div className="flex">
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} className={cn('h-4 w-4', n <= Math.round(avgRating) ? 'fill-amber-500 text-amber-500' : 'text-zinc-300')} />
                          ))}
                        </div>
                        <div className="text-xs text-zinc-500">{listing.reviews.length} avaliação(ões)</div>
                      </div>
                    </div>
                    {listing.reviews.map((r) => (
                      <div key={r.id} className="border-b border-zinc-100 last:border-0 pb-3 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <UserAvatar name={r.reviewer.name} avatar={r.reviewer.avatar} size="xs" />
                          <div className="font-medium text-sm">{r.reviewer.name}</div>
                          <div className="flex ml-1">
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} className={cn('h-3 w-3', n <= r.rating ? 'fill-amber-500 text-amber-500' : 'text-zinc-300')} />
                            ))}
                          </div>
                          <div className="text-xs text-zinc-500 ml-auto">{formatDate(r.createdAt, 'short')}</div>
                        </div>
                        {r.comment && <p className="text-sm text-zinc-700">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Ainda não há avaliações. Seja o primeiro a avaliar!</p>
                )}
                {/* Review form would be here - omitted for brevity */}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Contact */}
        <aside className="space-y-4">
          {/* Advertiser card */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3 mb-4">
                {listing.plan.allowLogo && listing.logoUrl ? (
                  <img src={listing.logoUrl} alt={listing.businessName || listing.owner.name} className="h-14 w-14 rounded-full border border-zinc-200" />
                ) : (
                  <div className={cn('h-14 w-14 rounded-full flex items-center justify-center', listing.personType === 'PJ' ? 'bg-amber-100' : 'bg-blue-100')}>
                    {listing.personType === 'PJ' ? <Building2 className="h-7 w-7 text-amber-700" /> : <UserIcon className="h-7 w-7 text-blue-700" />}
                  </div>
                )}
                <div>
                  <div className="font-bold text-zinc-900">{listing.businessName || listing.owner.name}</div>
                  <div className="text-xs text-zinc-500 flex items-center gap-1">
                    {listing.personType === 'PJ' ? 'CNPJ' : 'Pessoa Física'}
                    {listing.plan.allowVerified && (
                      <span className="text-emerald-600 flex items-center gap-0.5 ml-1">
                        <ShieldCheck className="h-3 w-3" /> Verificado
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-amber-600 font-bold mt-0.5">Plano {listing.plan.name}</div>
                </div>
              </div>

              {/* Contact buttons - gated by plan (hidden for owner) */}
              {isOwner ? (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center text-sm text-amber-800">
                  Este é o seu anúncio
                </div>
              ) : (
              <div className="space-y-2">
                {/* Panel message */}
                {listing.plan.allowPanelMessage ? (
                  <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-amber-600 hover:bg-amber-700">
                        <MessageCircle className="h-4 w-4 mr-2" /> Enviar mensagem
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Enviar mensagem para {listing.businessName || listing.owner.name}</DialogTitle></DialogHeader>
                      <form onSubmit={handleContact} className="space-y-3">
                        <div>
                          <Label className="text-sm">Seu nome *</Label>
                          <Input value={leadForm.senderName} onChange={(e) => setLeadForm({ ...leadForm, senderName: e.target.value })} required className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-sm">Email</Label>
                            <Input type="email" value={leadForm.senderEmail} onChange={(e) => setLeadForm({ ...leadForm, senderEmail: e.target.value })} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-sm">Telefone</Label>
                            <Input value={leadForm.senderPhone} onChange={(e) => setLeadForm({ ...leadForm, senderPhone: e.target.value })} className="mt-1" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm">Mensagem *</Label>
                          <Textarea value={leadForm.message} onChange={(e) => setLeadForm({ ...leadForm, message: e.target.value })} required rows={4} className="mt-1" placeholder="Olá, tenho interesse no seu anúncio..." />
                        </div>
                        <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={submitting}>
                          {submitting ? 'Enviando...' : <><Send className="h-4 w-4 mr-2" /> Enviar mensagem</>}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded p-3 text-center">
                    <Lock className="h-4 w-4 mx-auto mb-1 text-zinc-400" />
                    <p className="text-xs text-zinc-500">Mensagens pelo painel não disponíveis neste plano.</p>
                  </div>
                )}

                {/* WhatsApp */}
                {listing.plan.allowWhatsApp && wa ? (
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1eb558] text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                ) : (
                  <ContactLocked label="WhatsApp" />
                )}

                {/* Phone */}
                {listing.plan.allowPhone && tel ? (
                  <a href={`tel:${tel}`} className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium">
                    <Phone className="h-4 w-4" /> {listing.phone}
                  </a>
                ) : (
                  <ContactLocked label="Telefone" />
                )}

                {/* Email */}
                {listing.plan.allowEmail && listing.email ? (
                  <a href={`mailto:${listing.email}`} className="flex items-center justify-center gap-2 w-full border border-zinc-300 hover:bg-zinc-50 text-zinc-700 px-4 py-2 rounded text-sm font-medium">
                    <Mail className="h-4 w-4" /> Email
                  </a>
                ) : (
                  <ContactLocked label="Email" />
                )}

                {/* Website */}
                {listing.plan.allowEmail && listing.website && (
                  <a href={listing.website} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full border border-zinc-300 hover:bg-zinc-50 text-zinc-700 px-4 py-2 rounded text-sm font-medium">
                    <Globe className="h-4 w-4" /> Website
                  </a>
                )}
              </div>
              )}

              {/* Upgrade CTA for free plan viewers */}
              {listing.plan.slug === 'FREE' && (
                <div className="mt-4 pt-4 border-t border-zinc-100 bg-amber-50 -mx-5 -mb-5 px-5 py-4 rounded-b-lg">
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Anunciante Grátis</div>
                  <p className="text-xs text-amber-700 mb-2">Os contatos (WhatsApp, telefone) estão bloqueados neste plano.</p>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setView({ name: 'plans' })}>
                    {isOwner ? 'Fazer upgrade do plano' : 'Saiba mais sobre planos'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Boost CTA for owner */}
          {isOwner && listing.plan.allowBoost && listing.status === 'ACTIVE' && (
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-5 w-5 text-purple-600" />
                  <div className="font-bold text-purple-900">Impulsionar anúncio</div>
                </div>
                <p className="text-xs text-purple-700 mb-3">Use seus pontos para destacar este anúncio por mais dias no topo das buscas.</p>
                <Dialog open={boostOpen} onOpenChange={setBoostOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700">
                      <Flame className="h-4 w-4 mr-2" /> Impulsionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Impulsionar anúncio</DialogTitle></DialogHeader>
                    <div className="space-y-2">
                      <div className="text-xs text-zinc-500 mb-2">Seus pontos: <strong className="text-zinc-900">{user?.points || 0}</strong></div>
                      {[
                        { id: '3d' as const, label: '3 dias', cost: listing.plan.pointsPerBoost3d },
                        { id: '7d' as const, label: '7 dias', cost: listing.plan.pointsPerBoost7d },
                        { id: '15d' as const, label: '15 dias', cost: listing.plan.pointsPerBoost15d },
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleBoost(t.id)}
                          disabled={(user?.points || 0) < t.cost}
                          className="w-full flex items-center justify-between p-3 border border-zinc-200 rounded hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="text-left">
                            <div className="font-bold text-sm">{t.label} de destaque</div>
                            <div className="text-xs text-zinc-500">Anúncio no topo das buscas</div>
                          </div>
                          <div className="text-purple-700 font-bold flex items-center gap-1">
                            <Award className="h-4 w-4" /> {t.cost} pts
                          </div>
                        </button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
          {isOwner && listing.plan.allowBoost && listing.status !== 'ACTIVE' && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-5 w-5 text-amber-600" />
                  <div className="font-bold text-amber-900">Ative o anúncio para impulsionar</div>
                </div>
                <p className="text-xs text-amber-700 mb-3">Anúncios pausados não podem ser impulsionados. Reative para usar boost.</p>
                <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700" onClick={handleActivate}>
                  Ativar
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Safety tips */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <div className="font-bold text-sm text-zinc-900">Dicas de segurança</div>
              </div>
              <ul className="text-xs text-zinc-600 space-y-1.5">
                <li>• Encontre o vendedor em local público.</li>
                <li>• Verifique o produto antes de pagar.</li>
                <li>• Nunca pague antecipado a desconhecidos.</li>
                <li>• Desconfie de preços muito abaixo do mercado.</li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Gallery lightbox */}
      {galleryOpen !== null && photos[galleryOpen] && (
        <Dialog open={galleryOpen !== null} onOpenChange={(o) => !o && setGalleryOpen(null)}>
          <DialogContent className="max-w-4xl p-0 bg-black border-none overflow-hidden">
            <div className="relative">
              <img src={photos[galleryOpen]} alt="" className="w-full h-auto max-h-[80vh] object-contain" />
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{galleryOpen + 1} / {photos.length}</div>
              {galleryOpen > 0 && (
                <button onClick={() => setGalleryOpen(galleryOpen - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {galleryOpen < photos.length - 1 && (
                <button onClick={() => setGalleryOpen(galleryOpen + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80">
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function ContactLocked({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between w-full bg-zinc-50 border border-dashed border-zinc-300 px-4 py-2 rounded text-sm">
      <span className="text-zinc-500 flex items-center gap-2">
        <Lock className="h-4 w-4" /> {label}
      </span>
      <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Plano restrito</span>
    </div>
  )
}
