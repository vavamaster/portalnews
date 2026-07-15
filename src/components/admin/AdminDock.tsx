'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  AlertCircle, ExternalLink, LayoutDashboard, Newspaper, Plus, CheckCircle,
  Megaphone, Store, TrendingUp, Layers, Cpu, Users, UserCog, Search,
  FolderTree, LogOut, CreditCard, ShieldCheck, Crown, Tag, Globe, Share2, Bot, MessageCircle,
  type LucideIcon, Star, Home, X, BarChart3,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Newspaper, Plus, CheckCircle, Megaphone, Store,
  TrendingUp, Layers, Cpu, Users, UserCog, Search, FolderTree, CreditCard, ShieldCheck, Crown, Tag, Globe, Share2, Bot, MessageCircle,
  Home, Star, BarChart3,
}

interface NavItem {
  id: string
  label: string
  icon: string
  hint?: string
  metric?: string
  metricColor?: string
}

interface NavGroup {
  label: string
  color: string
  icon: any
  items: NavItem[]
}

export function AdminDock({ section, isMasterOrAdmin, onNavigate }: {
  section: string
  isMasterOrAdmin: boolean
  onNavigate?: () => void
}) {
  const { setView, user, logout } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  // Load favorites from localStorage on client-side only (avoids SSR crash)
  // Use async IIFE so setState is in microtask callback, not in effect body
  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem('admin-favorites')
        if (stored) setFavorites(JSON.parse(stored))
      } catch {}
    })()
  }, [])

  const groups: NavGroup[] = [
    {
      label: 'Conteúdo', color: 'blue', icon: Newspaper,
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', hint: 'Visão geral' },
        { id: 'posts', label: 'Notícias', icon: 'Newspaper', hint: 'Gerenciar matérias' },
        { id: 'editor', label: 'Nova Notícia', icon: 'Plus', hint: 'Criar matéria' },
        { id: 'review', label: 'Revisão', icon: 'CheckCircle', hint: 'Fila de aprovação' },
        { id: 'home-config', label: 'Home Layout', icon: 'LayoutDashboard', hint: 'Configurar home' },
      ],
    },
    {
      label: 'Monetização', color: 'amber', icon: Megaphone,
      items: [
        { id: 'ads', label: 'Anúncios', icon: 'Megaphone', hint: 'Anúncios do portal' },
        { id: 'sponsored', label: 'Patrocinadas', icon: 'Crown', hint: 'Categorias Enterprise' },
        { id: 'coupons', label: 'Cupons', icon: 'Tag', hint: 'Cupons de desconto' },
        { id: 'classifieds', label: 'Classificados', icon: 'Store', hint: 'Anúncios classificados' },
        { id: 'gateways', label: 'Pagamentos', icon: 'CreditCard', hint: 'Gateways' },
      ],
    },
    {
      label: 'Integrações', color: 'purple', icon: Globe,
      items: [
        { id: 'wordpress', label: 'WordPress', icon: 'Globe', hint: 'Importar matérias' },
        { id: 'social', label: 'Redes Sociais', icon: 'Share2', hint: 'Publicação automática' },
        { id: 'ai-autonews', label: 'IA Auto-News', icon: 'Bot', hint: 'Geração automática' },
        { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', hint: 'Baileys + notificações' },
        { id: 'header-ads', label: 'Anúncios Header', icon: 'Megaphone', hint: 'Banners no topo' },
      ],
    },
    {
      label: 'Sistema', color: 'zinc', icon: Cpu,
      items: [
        { id: 'analytics', label: 'Analytics', icon: 'BarChart3', hint: 'Métricas e relatórios' },
        { id: 'quotes', label: 'Cotações', icon: 'TrendingUp', hint: 'Cotações agro' },
        { id: 'slides', label: 'Slides', icon: 'Layers', hint: 'Slideshow' },
        { id: 'ai', label: 'IA & Chat', icon: 'Cpu', hint: 'Providers de IA' },
        { id: 'users', label: 'Usuários', icon: 'Users', hint: 'Gerenciar usuários' },
        { id: 'editors', label: 'Editores', icon: 'UserCog', hint: 'Permissões' },
        { id: 'verifications', label: 'Verificações', icon: 'ShieldCheck', hint: 'CPF/CNPJ' },
        { id: 'seo', label: 'SEO & Site', icon: 'Search', hint: 'Configurações globais' },
        { id: 'categories', label: 'Categorias', icon: 'FolderTree', hint: 'Editorias' },
      ],
    },
  ]

  const visibleGroups = isMasterOrAdmin ? groups : [groups[0]]
  const allItems = visibleGroups.flatMap(g => g.items)
  const favItems = allItems.filter(i => favorites.includes(i.id))

  const toggleFavorite = (id: string) => {
    const newFavs = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id]
    setFavorites(newFavs)
    localStorage.setItem('admin-favorites', JSON.stringify(newFavs))
  }

  const navigate = (id: string) => {
    setView({ name: 'admin', section: id as any })
    onNavigate?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setExpanded(false)
    setSearchQuery('')
  }

  // Close panel on Escape
  useEffect(() => {
    if (!expanded) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setExpanded(false); setSearchQuery('') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expanded])

  const colorClasses: Record<string, { dot: string; bg: string; text: string; border: string; hover: string; active: string; ring: string }> = {
    blue:  { dot: 'bg-blue-500',  bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200',  hover: 'hover:bg-blue-50',  active: 'bg-blue-500',  ring: 'ring-blue-300' },
    amber: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hover: 'hover:bg-amber-50', active: 'bg-amber-500', ring: 'ring-amber-300' },
    purple:{ dot: 'bg-purple-500',bg: 'bg-purple-50',text: 'text-purple-700',border: 'border-purple-200',hover: 'hover:bg-purple-50',active: 'bg-purple-500',ring: 'ring-purple-300' },
    zinc:  { dot: 'bg-zinc-500',  bg: 'bg-zinc-50',  text: 'text-zinc-700',  border: 'border-zinc-200',  hover: 'hover:bg-zinc-50',  active: 'bg-zinc-600',  ring: 'ring-zinc-300' },
  }

  // Filter items by search query
  const filteredGroups = searchQuery.trim()
    ? visibleGroups.map(g => ({
        ...g,
        items: g.items.filter(i =>
          i.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (i.hint || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(g => g.items.length > 0)
    : visibleGroups

  const currentItem = allItems.find(i => i.id === section)
  const CurrentIcon = currentItem ? ICON_MAP[currentItem.icon] : LayoutDashboard

  return (
    <>
      {/* === Bottom Dock (taskbar) — aligned with main container === */}
      <div className="fixed bottom-0 left-0 right-0 z-30 h-14 bg-zinc-900 border-t border-white/10 flex items-center gap-1.5">
        {/* Inner wrapper aligned with main content (max-w-7xl + px-4) */}
        <div className="w-full max-w-7xl mx-auto px-4 flex items-center gap-1.5">
        {/* Apps button (Start) — aligned with container left edge */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'h-10 px-3 rounded-xl flex items-center gap-2 transition-all flex-shrink-0 active:scale-95',
            expanded
              ? 'bg-white text-zinc-900 shadow-lg'
              : 'bg-white/10 text-white hover:bg-white/20 hover:shadow-md'
          )}
          title="Abrir painel de acesso"
        >
          <div className="grid grid-cols-3 gap-0.5 flex-shrink-0">
            {[0,1,2,3,4,5,6,7,8].map(i => (
              <span key={i} className={cn(
                'w-1 h-1 rounded-full transition-colors',
                expanded ? 'bg-zinc-900' : 'bg-white/70'
              )} />
            ))}
          </div>
          <span className="text-xs font-bold hidden sm:inline">Apps</span>
        </button>

        <div className="w-px h-7 bg-white/10 mx-1" />

        {/* Current section indicator (always visible) */}
        <button
          onClick={() => navigate(section)}
          className="h-10 px-3 rounded-xl flex items-center gap-2 bg-primary text-white flex-shrink-0 active:scale-95 transition-all shadow-md shadow-primary/20"
          title={currentItem?.label || 'Dashboard'}
        >
          <CurrentIcon className="h-4 w-4" />
          <span className="text-xs font-semibold hidden md:inline truncate max-w-[120px]">
            {currentItem?.label || 'Dashboard'}
          </span>
        </button>

        {/* Favorites quick-launch */}
        {favItems.length > 0 && (
          <>
            <div className="w-px h-7 bg-white/10 mx-1 hidden sm:block" />
            <div className="flex items-center gap-1 overflow-x-auto">
              {favItems.map(item => {
                const Icon = ICON_MAP[item.icon]
                const isActive = section === item.id
                return (
                  <button
                    key={`fav-${item.id}`}
                    onClick={() => navigate(item.id)}
                    className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
                      isActive ? 'bg-white/20 text-white' : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                    )}
                    title={item.label}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side: brand + user + actions */}
        <button
          onClick={() => navigate('dashboard')}
          className="h-10 px-3 rounded-xl flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white transition-colors flex-shrink-0"
          title="Painel Admin"
        >
          <div
            className="bg-primary text-white text-xs rounded-md flex items-center justify-center flex-shrink-0"
            style={{ width: 24, height: 24, fontWeight: 800 }}
          >
            PD
          </div>
          <span className="text-xs font-bold hidden lg:inline">Painel Admin</span>
        </button>

        <button
          onClick={() => { setView({ name: 'home' }); onNavigate?.() }}
          className="h-10 w-10 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          title="Ver site"
        >
          <ExternalLink className="h-4 w-4" />
        </button>

        <button
          onClick={async () => { await logout(); setView({ name: 'home' }) }}
          className="h-10 w-10 rounded-xl flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex-shrink-0"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
        </div>{/* end inner wrapper */}
      </div>

      {/* === Floating Apps Panel (pops UP from bottom-left) === */}
      {expanded && (
        <div className="fixed inset-0 z-40" onClick={() => { setExpanded(false); setSearchQuery('') }}>
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[3px]" />

          {/* Panel anchored to bottom-left, above the dock */}
          <div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-4 bottom-16 w-[min(1140px,calc(100vw-32px))] max-h-[calc(100vh-80px)] bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-zinc-900/20 ring-1 ring-zinc-200/70 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 fade-in zoom-in-95 duration-250"
          >
            {/* Header: title + search + close */}
            <div className="px-5 pt-4 pb-3 border-b border-zinc-100 flex-shrink-0 bg-gradient-to-b from-zinc-50/80 to-transparent">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="bg-primary text-white text-xs rounded-xl flex items-center justify-center shadow-md shadow-primary/30"
                    style={{ width: 30, height: 30, fontWeight: 800 }}
                  >
                    PD
                  </div>
                  <div>
                    <div className="text-sm font-black text-zinc-900 leading-tight tracking-tight">Painel de Acesso</div>
                    <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                      <span className="text-zinc-700 font-medium">{user?.name}</span> · {user?.role}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setExpanded(false); setSearchQuery('') }}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
                  title="Fechar (Esc)"
                >
                  <X className="h-4 w-4 text-zinc-500" />
                </button>
              </div>

              {/* Search bar — compact, not full-width */}
              <div className="flex justify-start">
                <div className="flex items-center gap-2 bg-white rounded-xl px-3.5 py-2 w-full max-w-xs ring-1 ring-zinc-200 transition-all shadow-sm">
                  <Search className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar recurso..."
                    autoFocus
                    className="bg-transparent text-xs text-zinc-700 outline-none flex-1 min-w-0 placeholder:text-zinc-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-zinc-400 hover:text-zinc-600 flex-shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {!searchQuery && (
                    <kbd className="text-[9px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 flex-shrink-0 font-mono">Esc</kbd>
                  )}
                </div>
              </div>
            </div>

            {/* Body: 4 columns (one per group) — with proper spacing */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-zinc-50/40">
              {filteredGroups.length === 0 ? (
                <div className="p-10 text-center text-zinc-400">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <div className="text-sm">Nenhum recurso encontrado para "{searchQuery}"</div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-3 p-3">
                  {filteredGroups.map(group => {
                    const c = colorClasses[group.color]
                    const GroupIcon = group.icon
                    return (
                      <div key={group.label} className="bg-white flex-1 min-w-0 md:min-w-[230px] rounded-2xl ring-1 ring-zinc-200/70 overflow-hidden flex flex-col shadow-sm">
                        {/* Column header — with color accent background */}
                        <div className={cn('sticky top-0 px-3 py-2.5 border-b border-zinc-100 z-10', c.bg)}>
                          <div className="flex items-center gap-2">
                            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shadow-sm', c.active, 'text-white')}>
                              <GroupIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={cn('text-[11px] font-bold uppercase tracking-wider leading-tight', c.text)}>
                                {group.label}
                              </div>
                              <div className="text-[9px] text-zinc-500 leading-tight mt-0.5">
                                {group.items.length} recurso{group.items.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Column body: vertical stack of cards (compact) */}
                        <div className="p-1.5 space-y-0.5 flex-1">
                          {group.items.map(item => {
                            const Icon = ICON_MAP[item.icon]
                            const isActive = section === item.id
                            const isFav = favorites.includes(item.id)
                            return (
                              <div
                                key={item.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => navigate(item.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    navigate(item.id)
                                  }
                                }}
                                className={cn(
                                  'group relative w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all cursor-pointer',
                                  isActive
                                    ? cn(c.bg, 'shadow-sm')
                                    : 'hover:bg-zinc-50 active:scale-[0.98]'
                                )}
                              >
                                {/* Active left-bar indicator */}
                                {isActive && (
                                  <span className={cn('absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full', c.active)} />
                                )}

                                {/* Icon */}
                                <div className={cn(
                                  'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                                  isActive ? cn(c.active, 'text-white shadow-sm') : cn(c.bg, c.text, 'group-hover:scale-105')
                                )}>
                                  {Icon && <Icon className="h-3.5 w-3.5" />}
                                </div>

                                {/* Text */}
                                <div className="min-w-0 flex-1">
                                  <div className={cn(
                                    'text-[11px] truncate leading-tight',
                                    isActive ? 'font-bold text-zinc-900' : 'font-semibold text-zinc-700'
                                  )}>
                                    {item.label}
                                  </div>
                                  {item.hint && (
                                    <div className="text-[9px] text-zinc-400 truncate leading-tight mt-0.5">{item.hint}</div>
                                  )}
                                </div>

                                {/* Favorite star — discoverable on hover */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id) }}
                                  className={cn(
                                    'p-1 rounded transition-all flex-shrink-0 hover:scale-110',
                                    isFav
                                      ? 'text-amber-400 opacity-100'
                                      : 'text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                                  )}
                                  title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                >
                                  <Star className={cn('h-3 w-3', isFav && 'fill-current')} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-2 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400 flex-shrink-0 bg-gradient-to-b from-transparent to-zinc-50/50">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-400 fill-current" />
                  <strong className="text-zinc-700">{favorites.length}</strong> favorito(s)
                </span>
                <span className="text-zinc-300">·</span>
                <span><strong className="text-zinc-700">{allItems.length}</strong> recursos</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded text-[9px] font-mono shadow-sm">Esc</kbd>
                <span>fechar</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
