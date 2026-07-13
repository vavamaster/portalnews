'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Search, MapPin, Filter, X, Sparkles, Plus, Store, ChevronLeft, Loader2, Flame, BadgeCheck, Star } from 'lucide-react'

interface ClassifiedCategory {
  id: string; slug: string; name: string; icon: string; color: string; description?: string | null
  _count?: { listings: number }
}

interface Listing {
  id: string; slug: string; title: string; description: string; price: number | null; isNegotiable: boolean
  personType: string; businessName?: string | null; logoUrl?: string | null
  photos: string | null; city?: string | null; state?: string | null
  category: ClassifiedCategory; plan: { slug: string; name: string; allowLogo?: boolean }
  featured: boolean; boosted: boolean; boostedUntil?: string | null
  _count?: { reviews: number }
  views: number
}

interface Props {
  initialCategory?: string
}

export function ClassifiedsView({ initialCategory }: Props) {
  const { setView } = useAppStore()
  const [categories, setCategories] = useState<ClassifiedCategory[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    search: '',
    category: initialCategory || 'ALL',
    city: '',
    state: 'MT',
    personType: 'ALL',
    plan: 'ALL',
    minPrice: 0,
    maxPrice: 50000,
    sort: 'relevance',
    featured: false,
    boosted: false,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000])
  const [offset, setOffset] = useState(0)
  const limit = 12

  // Load categories once
  useEffect(() => {
    fetch('/api/classified-categories').then(r => r.json()).then(data => setCategories(data.categories || []))
  }, [])

  // Load listings when filters change
  useEffect(() => {
    setOffset(0)
    loadListings(0, true)
  }, [filters])

  const loadListings = async (off: number, replace: boolean) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('offset', String(off))
      if (filters.search) params.set('search', filters.search)
      if (filters.category !== 'ALL') params.set('category', filters.category)
      if (filters.city) params.set('city', filters.city)
      if (filters.state) params.set('state', filters.state)
      if (filters.personType !== 'ALL') params.set('personType', filters.personType)
      if (filters.plan !== 'ALL') params.set('plan', filters.plan)
      if (filters.minPrice > 0) params.set('minPrice', String(filters.minPrice))
      if (filters.maxPrice < 50000) params.set('maxPrice', String(filters.maxPrice))
      params.set('sort', filters.sort)
      if (filters.featured) params.set('featured', 'true')
      if (filters.boosted) params.set('boosted', 'true')
      const res = await fetch(`/api/classifieds?${params.toString()}`)
      const data = await res.json()
      setListings(replace ? (data.listings || []) : [...listings, ...(data.listings || [])])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleApplyPrice = () => {
    setFilters(prev => ({ ...prev, minPrice: priceRange[0], maxPrice: priceRange[1] }))
  }

  const clearFilters = () => {
    setFilters({
      search: '', category: 'ALL', city: '', state: 'MT', personType: 'ALL', plan: 'ALL',
      minPrice: 0, maxPrice: 50000, sort: 'relevance', featured: false, boosted: false,
    })
    setPriceRange([0, 50000])
  }

  const activeFiltersCount = [
    filters.search, filters.city, filters.personType !== 'ALL', filters.plan !== 'ALL',
    filters.minPrice > 0, filters.maxPrice < 50000, filters.featured, filters.boosted,
  ].filter(Boolean).length

  return (
    <div className="news-container py-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-zinc-200">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <button onClick={() => setView({ name: 'home' })} className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-primary mb-2">
              <ChevronLeft className="h-4 w-4" /> Voltar ao início
            </button>
            <h1 className="text-3xl sm:text-4xl text-zinc-900 flex items-center gap-3" style={{ fontWeight: 500 }}>
              <Store className="h-8 w-8 text-amber-600" /> Classificados
            </h1>
            <p className="text-zinc-600 mt-1">{total} anúncio(s) encontrado(s)</p>
          </div>
          <Button onClick={() => setView({ name: 'classified-editor' })} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="h-4 w-4 mr-2" /> Anunciar grátis
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="Buscar por palavra-chave (ex: Honda, geladeira, encanador)..."
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(s => !s)} className="sm:w-auto">
          <Filter className="h-4 w-4 mr-2" /> Filtros
          {activeFiltersCount > 0 && (
            <span className="ml-1 bg-amber-600 text-white text-xs rounded-full px-1.5 py-0.5">{activeFiltersCount}</span>
          )}
        </Button>
        <Select value={filters.sort} onValueChange={(v) => handleFilterChange('sort', v)}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Relevância</SelectItem>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="price_asc">Menor preço</SelectItem>
            <SelectItem value="price_desc">Maior preço</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <Card className="mb-4">
          <CardContent className="pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={filters.category} onValueChange={(v) => handleFilterChange('category', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas categorias</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input
                value={filters.city}
                onChange={(e) => handleFilterChange('city', e.target.value)}
                placeholder="Cidade"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo de anunciante</Label>
              <Select value={filters.personType} onValueChange={(v) => handleFilterChange('personType', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="PF">Pessoa Física</SelectItem>
                  <SelectItem value="PJ">Empresa / CNPJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Plano</Label>
              <Select value={filters.plan} onValueChange={(v) => handleFilterChange('plan', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os planos</SelectItem>
                  <SelectItem value="FREE">Grátis</SelectItem>
                  <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
                  <SelectItem value="COMPANY">Empresa</SelectItem>
                  <SelectItem value="PREMIUM">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Faixa de preço: R$ {priceRange[0].toLocaleString('pt-BR')} - R$ {priceRange[1].toLocaleString('pt-BR')}</Label>
              <Slider
                value={priceRange}
                onValueChange={(v) => setPriceRange(v as [number, number])}
                min={0}
                max={50000}
                step={100}
                className="mt-3"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" variant="outline" onClick={handleApplyPrice}>Aplicar preço</Button>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.featured}
                  onChange={(e) => handleFilterChange('featured', e.target.checked)}
                  className="rounded"
                />
                Destaques
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.boosted}
                  onChange={(e) => handleFilterChange('boosted', e.target.checked)}
                  className="rounded"
                />
                Impulsionados
              </label>
            </div>
            {activeFiltersCount > 0 && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" /> Limpar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Categories quick filter — creative grid cloud */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleFilterChange('category', 'ALL')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:scale-105',
              filters.category === 'ALL'
                ? 'bg-amber-600 text-white border-amber-600 shadow-soft'
                : 'bg-white border-zinc-200 hover:border-amber-400 hover:bg-amber-50'
            )}
          >
            <Store className="h-3.5 w-3.5" />
            Todas
          </button>
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.icon] || Store
            const isActive = filters.category === c.slug
            const catColors = getCategoryColors(c.color)
            return (
              <button
                key={c.id}
                onClick={() => handleFilterChange('category', c.slug)}
                className={cn(
                  'group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:scale-105',
                  isActive
                    ? cn(catColors.bgSolid, 'text-white', catColors.border, 'shadow-soft')
                    : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                )}
                title={c.description || c.name}
              >
                <Icon className={cn('h-3.5 w-3.5 transition-transform group-hover:rotate-6', !isActive && catColors.text)} />
                {c.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Listings grid */}
      {loading && listings.length === 0 ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
          <p className="text-zinc-500 mt-2">Carregando anúncios...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12">
          <Store className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-lg text-zinc-900 mb-1" style={{ fontWeight: 500 }}>Nenhum anúncio encontrado</h3>
          <p className="text-zinc-600 mb-4">Tente ajustar os filtros ou seja o primeiro a anunciar nesta categoria.</p>
          <Button onClick={() => setView({ name: 'classified-editor' })} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="h-4 w-4 mr-2" /> Criar anúncio
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
          {listings.length < total && (
            <div className="text-center mt-8">
              <Button
                variant="outline"
                size="lg"
                onClick={() => { const o = offset + limit; setOffset(o); loadListings(o, false) }}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Carregar mais anúncios
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ListingCard({ listing: l }: { listing: Listing }) {
  const { setView } = useAppStore()
  const photos: string[] = l.photos ? (() => { try { return JSON.parse(l.photos) } catch { return [] } })() : []
  const cover = photos[0] || FALLBACK_IMAGE
  const Icon = CATEGORY_ICONS[l.category.icon] || Store
  const isBoosted = l.boosted && l.boostedUntil && new Date(l.boostedUntil) > new Date()
  const catColors = getCategoryColors(l.category.color)

  return (
    <article
      onClick={() => setView({ name: 'classified', slug: l.slug })}
      className="bg-white border border-zinc-200 rounded-lg overflow-hidden hover-lift cursor-pointer group relative"
    >
      {(l.featured || isBoosted) && (
        <div className="absolute top-2 left-2 z-10 flex gap-1">
          {l.featured && (
            <span className="bg-amber-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-0.5" style={{ fontWeight: 500 }}>
              <Star className="h-2.5 w-2.5" /> Destaque
            </span>
          )}
          {isBoosted && (
            <span className="bg-purple-600 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-0.5" style={{ fontWeight: 500 }}>
              <Flame className="h-2.5 w-2.5" /> Boost
            </span>
          )}
        </div>
      )}
      <div className="aspect-[4/3] bg-zinc-100 overflow-hidden relative">
        <img src={cover} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        <span className={cn('absolute top-2 right-2 px-2 py-0.5 rounded text-xs flex items-center gap-1', catColors.bg, catColors.text)} style={{ fontWeight: 500 }}>
          <Icon className="h-3 w-3" /> {l.category.name}
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-1 mb-1">
          {l.plan.slug !== 'FREE' && (
            <span className="text-[10px] uppercase text-amber-600 flex items-center gap-0.5" style={{ fontWeight: 500 }}>
              <BadgeCheck className="h-3 w-3" /> {l.plan.name}
            </span>
          )}
          {l.personType === 'PJ' && l.businessName && (
            <span className="text-[10px] text-zinc-500 ml-auto">CNPJ</span>
          )}
        </div>
        <h3 className="text-sm text-zinc-900 line-clamp-2 group-hover:text-amber-700 transition-colors" style={{ fontWeight: 500 }}>
          {l.title}
        </h3>
        <div className="flex items-baseline gap-1 mt-1">
          {l.price !== null ? (
            <span className="text-lg text-zinc-900 font-numeric" style={{ fontWeight: 500 }}>
              R$ {l.price.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </span>
          ) : (
            <span className="text-sm text-zinc-500">Consulte</span>
          )}
          {l.isNegotiable && <span className="text-[10px] text-zinc-500">(negociável)</span>}
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {l.city || 'Não informada'}{l.state ? `/${l.state}` : ''}
          </span>
          <span>{l.views} views</span>
        </div>
      </div>
    </article>
  )
}

// Map of category icons (kept here for client-side use)
import {
  Home, Car, Briefcase, Wrench, ShoppingBag, PawPrint, Smartphone, Sofa,
  Scissors, Stethoscope, GraduationCap, PartyPopper, Dumbbell, Tractor, HardHat
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, any> = {
  Home, Car, Briefcase, Wrench, ShoppingBag, PawPrint, Smartphone, Sofa,
  Scissors, Stethoscope, GraduationCap, PartyPopper, Dumbbell, Tractor, HardHat,
  Store,
}

// Static color class map — Tailwind JIT can't see dynamic `bg-${color}-100` patterns
export const CATEGORY_COLOR_CLASSES: Record<string, { bg: string; text: string; bgSolid: string; bgSolidHover: string; border: string }> = {
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-800',    bgSolid: 'bg-blue-600',    bgSolidHover: 'hover:bg-blue-700',    border: 'border-blue-600' },
  red:     { bg: 'bg-red-100',     text: 'text-red-800',     bgSolid: 'bg-red-600',     bgSolidHover: 'hover:bg-red-700',     border: 'border-red-600' },
  green:   { bg: 'bg-green-100',   text: 'text-green-800',   bgSolid: 'bg-green-600',   bgSolidHover: 'hover:bg-green-700',   border: 'border-green-600' },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-800',   bgSolid: 'bg-amber-600',   bgSolidHover: 'hover:bg-amber-700',   border: 'border-amber-600' },
  purple:  { bg: 'bg-purple-100',  text: 'text-purple-800',  bgSolid: 'bg-purple-600',  bgSolidHover: 'hover:bg-purple-700',  border: 'border-purple-600' },
  pink:    { bg: 'bg-pink-100',    text: 'text-pink-800',    bgSolid: 'bg-pink-600',    bgSolidHover: 'hover:bg-pink-700',    border: 'border-pink-600' },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-800',    bgSolid: 'bg-rose-600',    bgSolidHover: 'hover:bg-rose-700',    border: 'border-rose-600' },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-800',  bgSolid: 'bg-orange-600',  bgSolidHover: 'hover:bg-orange-700',  border: 'border-orange-600' },
  teal:    { bg: 'bg-teal-100',    text: 'text-teal-800',    bgSolid: 'bg-teal-600',    bgSolidHover: 'hover:bg-teal-700',    border: 'border-teal-600' },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-800',    bgSolid: 'bg-cyan-600',    bgSolidHover: 'hover:bg-cyan-700',    border: 'border-cyan-600' },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-800',  bgSolid: 'bg-indigo-600',  bgSolidHover: 'hover:bg-indigo-700',  border: 'border-indigo-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', bgSolid: 'bg-emerald-600', bgSolidHover: 'hover:bg-emerald-700', border: 'border-emerald-600' },
  slate:   { bg: 'bg-slate-100',   text: 'text-slate-800',   bgSolid: 'bg-slate-600',   bgSolidHover: 'hover:bg-slate-700',   border: 'border-slate-600' },
  zinc:    { bg: 'bg-zinc-100',    text: 'text-zinc-800',    bgSolid: 'bg-zinc-600',    bgSolidHover: 'hover:bg-zinc-700',    border: 'border-zinc-600' },
}

export function getCategoryColors(color: string) {
  return CATEGORY_COLOR_CLASSES[color] || CATEGORY_COLOR_CLASSES.zinc
}

// Local fallback image (data URI) — no external dependency
const FALLBACK_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="600" height="400" fill="#f4f4f5"/>
  <g fill="#d4d4d8">
    <rect x="250" y="160" width="100" height="70" rx="6"/>
    <circle cx="300" cy="140" r="22"/>
    <path d="M 200 280 L 270 200 L 330 260 L 380 220 L 440 280 Z"/>
  </g>
  <text x="300" y="340" font-family="system-ui, sans-serif" font-size="18" fill="#a1a1aa" text-anchor="middle">Sem foto</text>
</svg>
`)}`
