'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  ADMIN_NAVIGATION_GROUPS,
  type AdminGroupColor,
  type AdminSectionId,
} from '@/lib/admin-navigation'
import {
  BarChart3, Bot, CheckCircle, Cpu, CreditCard, Crown, ExternalLink,
  FolderTree, Globe, Layers, LayoutDashboard, LogOut, Megaphone,
  MessageCircle, Newspaper, Plus, ScrollText, Search, Share2, ShieldCheck,
  Star, Store, Tag, TrendingUp, UserCog, Users, X, type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3, Bot, CheckCircle, Cpu, CreditCard, Crown, FolderTree, Globe,
  Layers, LayoutDashboard, Megaphone, MessageCircle, Newspaper, Plus,
  ScrollText, Search, Share2, ShieldCheck, Star, Store, Tag, TrendingUp,
  UserCog, Users,
}

const COLOR_CLASSES: Record<AdminGroupColor, {
  bg: string
  text: string
  active: string
}> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', active: 'bg-blue-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', active: 'bg-amber-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', active: 'bg-purple-600' },
  zinc: { bg: 'bg-zinc-100', text: 'text-zinc-700', active: 'bg-zinc-700' },
}

const PANEL_WIDTH_BY_GROUP_COUNT = [420, 420, 720, 900, 1140]

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

function readStoredIds(key: string): string[] | null {
  try {
    const value = localStorage.getItem(key)
    if (!value) return null
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : null
  } catch {
    return null
  }
}

interface Props {
  section: AdminSectionId
  isMasterOrAdmin: boolean
  isMaster?: boolean
  allowedSections?: AdminSectionId[]
  onNavigate?: () => void
}

export function AdminDock({
  section,
  isMasterOrAdmin,
  isMaster = false,
  allowedSections = [],
  onNavigate,
}: Props) {
  const { setView, user, logout } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [favorites, setFavorites] = useState<AdminSectionId[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeResultIndex, setActiveResultIndex] = useState(0)
  const [panelGeometry, setPanelGeometry] = useState({ left: 16, width: 420 })
  const appsButtonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const visibleGroups = useMemo(() => ADMIN_NAVIGATION_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (isMaster) return true
        if (isMasterOrAdmin) return !('masterOnly' in item && item.masterOnly)
        return allowedSections.includes(item.id)
      }),
    }))
    .filter(group => group.items.length > 0), [allowedSections, isMaster, isMasterOrAdmin])

  const allItems = useMemo(() => visibleGroups.flatMap(group => group.items), [visibleGroups])
  const availableIds = useMemo(() => new Set(allItems.map(item => item.id)), [allItems])
  const availableIdsSignature = allItems.map(item => item.id).join('|')
  const favoritesStorageKey = `admin-favorites:${user?.id || user?.role || 'anonymous'}`

  useEffect(() => {
    Promise.resolve().then(() => {
      const stored = readStoredIds(favoritesStorageKey) ?? readStoredIds('admin-favorites') ?? []
      const sanitized = stored.filter((id): id is AdminSectionId => availableIds.has(id as AdminSectionId))
      setFavorites(sanitized)
      try {
        localStorage.setItem(favoritesStorageKey, JSON.stringify(sanitized))
      } catch {}
    })
  }, [availableIds, availableIdsSignature, favoritesStorageKey])

  const favoriteItems = useMemo(() => favorites
    .map(id => allItems.find(item => item.id === id))
    .filter((item): item is (typeof allItems)[number] => Boolean(item)), [allItems, favorites])
  const dockFavoriteItems = favoriteItems.filter(item => item.id !== section)

  const normalizedQuery = normalizeSearch(searchQuery)
  const filteredGroups = normalizedQuery
    ? visibleGroups.map(group => ({
        ...group,
        items: group.items.filter(item => normalizeSearch([
          group.label,
          item.label,
          item.hint,
          item.title,
          item.description,
          ...item.keywords,
        ].join(' ')).includes(normalizedQuery)),
      })).filter(group => group.items.length > 0)
    : visibleGroups
  const filteredItems = filteredGroups.flatMap(group => group.items)

  const idealPanelWidth = PANEL_WIDTH_BY_GROUP_COUNT[Math.min(visibleGroups.length, 4)] || 1140

  const updatePanelGeometry = useCallback(() => {
    const viewportWidth = window.innerWidth
    const margin = 16
    const width = Math.max(288, Math.min(idealPanelWidth, viewportWidth - margin * 2))
    const buttonLeft = appsButtonRef.current?.getBoundingClientRect().left ?? margin
    const left = Math.min(Math.max(buttonLeft, margin), viewportWidth - width - margin)
    setPanelGeometry({ left, width })
  }, [idealPanelWidth])

  const closePanel = useCallback((restoreFocus = true) => {
    setExpanded(false)
    setSearchQuery('')
    setActiveResultIndex(0)
    if (restoreFocus) requestAnimationFrame(() => appsButtonRef.current?.focus())
  }, [])

  const openPanel = useCallback(() => {
    updatePanelGeometry()
    setExpanded(true)
    setActiveResultIndex(0)
  }, [updatePanelGeometry])

  const navigate = useCallback((id: AdminSectionId) => {
    setView({ name: 'admin', section: id })
    onNavigate?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    closePanel(false)
  }, [closePanel, onNavigate, setView])

  const togglePanel = () => expanded ? closePanel() : openPanel()

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        if (expanded) closePanel()
        else openPanel()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [closePanel, expanded, openPanel])

  useEffect(() => {
    if (!expanded) return
    updatePanelGeometry()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handlePanelKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (searchQuery) {
          setSearchQuery('')
          setActiveResultIndex(0)
          searchInputRef.current?.focus()
        } else {
          closePanel()
        }
        return
      }

      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && filteredItems.length > 0) {
        event.preventDefault()
        setActiveResultIndex(current => {
          const direction = event.key === 'ArrowDown' ? 1 : -1
          const next = (current + direction + filteredItems.length) % filteredItems.length
          requestAnimationFrame(() => {
            panelRef.current?.querySelectorAll<HTMLElement>('[data-admin-menu-item]')[next]?.scrollIntoView({ block: 'nearest' })
          })
          return next
        })
        return
      }

      if (event.key === 'Enter' && document.activeElement === searchInputRef.current && filteredItems.length > 0) {
        event.preventDefault()
        navigate(filteredItems[Math.min(activeResultIndex, filteredItems.length - 1)].id)
        return
      }

      if (event.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('resize', updatePanelGeometry)
    window.addEventListener('keydown', handlePanelKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('resize', updatePanelGeometry)
      window.removeEventListener('keydown', handlePanelKeyDown)
    }
  }, [activeResultIndex, closePanel, expanded, filteredItems, navigate, searchQuery, updatePanelGeometry])

  const toggleFavorite = (id: AdminSectionId) => {
    const updated = favorites.includes(id)
      ? favorites.filter(favoriteId => favoriteId !== id)
      : [...favorites, id]
    setFavorites(updated)
    try {
      localStorage.setItem(favoritesStorageKey, JSON.stringify(updated))
    } catch {}
  }

  const currentItem = allItems.find(item => item.id === section)
  const CurrentIcon = currentItem ? ICON_MAP[currentItem.icon] : LayoutDashboard
  const gridColumns = panelGeometry.width >= 1040
    ? Math.min(4, filteredGroups.length)
    : panelGeometry.width >= 820
      ? Math.min(3, filteredGroups.length)
      : panelGeometry.width >= 600
        ? Math.min(2, filteredGroups.length)
        : 1

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-30 h-14 bg-zinc-900 border-t border-white/10 flex items-center gap-1.5">
        <div className="w-full max-w-7xl mx-auto px-4 flex items-center gap-1.5">
          <button
            ref={appsButtonRef}
            type="button"
            onClick={togglePanel}
            className={cn(
              'h-10 px-3 rounded-xl flex items-center gap-2 transition-all flex-shrink-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
              expanded ? 'bg-white text-zinc-900 shadow-lg' : 'bg-white/10 text-white hover:bg-white/20 hover:shadow-md',
            )}
            title="Abrir painel de acesso (Ctrl+Shift+P)"
            aria-label="Abrir painel de acesso"
            aria-haspopup="dialog"
            aria-expanded={expanded}
            aria-controls="admin-apps-panel"
            aria-keyshortcuts="Control+Shift+P"
          >
            <span className="grid grid-cols-3 gap-0.5 flex-shrink-0" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(index => (
                <span key={index} className={cn('w-1 h-1 rounded-full transition-colors', expanded ? 'bg-zinc-900' : 'bg-white/70')} />
              ))}
            </span>
            <span className="text-xs font-bold hidden sm:inline">Apps</span>
          </button>

          <div className="w-px h-7 bg-white/10 mx-1" />

          <button
            type="button"
            onClick={() => navigate(section)}
            className="h-10 px-3 rounded-xl flex items-center gap-2 bg-primary text-white flex-shrink-0 active:scale-95 transition-all shadow-md shadow-primary/20"
            title={currentItem?.label || 'Dashboard'}
            aria-current="page"
          >
            <CurrentIcon className="h-4 w-4" />
            <span className="text-xs font-semibold hidden md:inline truncate max-w-[120px]">{currentItem?.label || 'Dashboard'}</span>
          </button>

          {dockFavoriteItems.length > 0 && (
            <>
              <div className="w-px h-7 bg-white/10 mx-1 hidden sm:block" />
              <div className="flex items-center gap-1 overflow-x-auto min-w-0" aria-label="Atalhos favoritos">
                {dockFavoriteItems.map(item => {
                  const Icon = ICON_MAP[item.icon]
                  return (
                    <button
                      key={`favorite-${item.id}`}
                      type="button"
                      onClick={() => navigate(item.id)}
                      className="h-10 w-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      title={item.label}
                      aria-label={`Abrir ${item.label}`}
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="h-10 px-3 rounded-xl flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white transition-colors flex-shrink-0"
            title="Painel Admin"
          >
            <span className="bg-primary text-white text-xs rounded-md flex items-center justify-center flex-shrink-0 w-6 h-6 font-extrabold">PD</span>
            <span className="text-xs font-bold hidden lg:inline">Painel Admin</span>
          </button>

          <button
            type="button"
            onClick={() => { setView({ name: 'home' }); onNavigate?.() }}
            className="h-10 w-10 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            title="Ver site"
            aria-label="Ver site"
          >
            <ExternalLink className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={async () => { await logout(); setView({ name: 'home' }) }}
            className="h-10 w-10 rounded-xl flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex-shrink-0"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="fixed inset-0 z-40" onMouseDown={(event) => {
          if (!panelRef.current?.contains(event.target as Node)) closePanel()
        }}>
          <div className="absolute inset-0 bg-zinc-950/45 backdrop-blur-[2px]" aria-hidden="true" />

          <div
            id="admin-apps-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-apps-title"
            onMouseDown={event => event.stopPropagation()}
            className="absolute bottom-16 max-h-[calc(100dvh-80px)] bg-white rounded-2xl sm:rounded-3xl shadow-2xl shadow-zinc-950/25 ring-1 ring-zinc-200 flex flex-col overflow-hidden origin-bottom-left animate-in slide-in-from-bottom-4 fade-in zoom-in-95 duration-200"
            style={{ left: panelGeometry.left, width: panelGeometry.width }}
          >
            <header className="px-4 sm:px-5 pt-4 pb-3 border-b border-zinc-100 flex-shrink-0 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="bg-primary text-white text-xs rounded-xl flex items-center justify-center shadow-sm w-8 h-8 font-extrabold flex-shrink-0">PD</span>
                  <div className="min-w-0">
                    <h2 id="admin-apps-title" className="text-sm font-extrabold text-zinc-900 leading-tight">Apps e atalhos</h2>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5"><span className="text-zinc-700 font-medium">{user?.name}</span> · {user?.role}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => closePanel()}
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title="Fechar"
                  aria-label="Fechar painel de apps"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 bg-zinc-50 rounded-xl px-3.5 h-10 w-full sm:max-w-sm ring-1 ring-zinc-200 focus-within:bg-white focus-within:ring-zinc-300 focus-within:shadow-sm transition-all">
                <Search className="h-4 w-4 text-zinc-400 flex-shrink-0" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={event => { setSearchQuery(event.target.value); setActiveResultIndex(0) }}
                  placeholder="Buscar apps, ações ou configurações..."
                  autoFocus
                  aria-label="Buscar apps e atalhos"
                  aria-controls="admin-apps-results"
                  className="bg-transparent text-sm text-zinc-800 outline-none flex-1 min-w-0 placeholder:text-zinc-400"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setActiveResultIndex(0); searchInputRef.current?.focus() }}
                    className="text-zinc-400 hover:text-zinc-700 p-1 rounded"
                    aria-label="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex text-[10px] text-zinc-500 bg-white px-1.5 py-0.5 rounded border border-zinc-200 flex-shrink-0 font-mono">Esc</kbd>
                )}
              </div>
            </header>

            <div id="admin-apps-results" className="flex-1 overflow-y-auto overflow-x-hidden bg-zinc-50/60">
              {filteredGroups.length === 0 ? (
                <div className="p-10 text-center text-zinc-500" role="status">
                  <Search className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                  <div className="text-sm font-medium">Nenhum recurso encontrado</div>
                  <div className="text-xs text-zinc-400 mt-1">Tente outro nome ou ação.</div>
                </div>
              ) : (
                <div
                  className="grid gap-3 p-3 items-start"
                  style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
                >
                  {filteredGroups.map(group => {
                    const colors = COLOR_CLASSES[group.color]
                    const GroupIcon = ICON_MAP[group.icon]
                    return (
                      <section key={group.id} className="bg-white min-w-0 rounded-xl border border-zinc-200 overflow-hidden shadow-sm" aria-labelledby={`admin-group-${group.id}`}>
                        <div className="px-3 py-2.5 border-b border-zinc-100 flex items-center gap-2.5">
                          <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', colors.bg, colors.text)}>
                            {GroupIcon && <GroupIcon className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <h3 id={`admin-group-${group.id}`} className="text-xs font-bold uppercase tracking-wide text-zinc-800">{group.label}</h3>
                            <p className="text-[11px] text-zinc-500 mt-0.5">{group.items.length} recurso{group.items.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>

                        <ul className="p-1.5 space-y-0.5">
                          {group.items.map(item => {
                            const Icon = ICON_MAP[item.icon]
                            const isActive = section === item.id
                            const isFavorite = favorites.includes(item.id)
                            const resultIndex = filteredItems.findIndex(result => result.id === item.id)
                            const isKeyboardActive = resultIndex === activeResultIndex
                            return (
                              <li key={item.id} className={cn(
                                'group relative flex items-center rounded-lg transition-colors',
                                isActive ? colors.bg : isKeyboardActive && searchQuery ? 'bg-zinc-100' : 'hover:bg-zinc-50',
                              )}>
                                {isActive && <span className={cn('absolute left-0 top-2 bottom-2 w-0.5 rounded-full', colors.active)} aria-hidden="true" />}
                                <button
                                  type="button"
                                  data-admin-menu-item
                                  onClick={() => navigate(item.id)}
                                  onFocus={() => setActiveResultIndex(resultIndex)}
                                  className="min-w-0 flex-1 flex items-center gap-2.5 pl-2.5 pr-1 py-2 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70"
                                  aria-current={isActive ? 'page' : undefined}
                                >
                                  <span className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform',
                                    isActive ? cn(colors.active, 'text-white shadow-sm') : cn(colors.bg, colors.text, 'group-hover:scale-105'),
                                  )}>
                                    {Icon && <Icon className="h-4 w-4" />}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className={cn('block text-[13px] truncate leading-tight', isActive ? 'font-bold text-zinc-900' : 'font-semibold text-zinc-700')}>{item.label}</span>
                                    <span className="block text-[11px] text-zinc-500 truncate leading-tight mt-1">{item.hint}</span>
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleFavorite(item.id)}
                                  className={cn(
                                    'mr-1.5 p-1.5 rounded-md transition-all flex-shrink-0 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                                    isFavorite ? 'text-amber-500 opacity-100' : 'text-zinc-300 opacity-40 sm:opacity-0 sm:group-hover:opacity-100 hover:text-amber-500',
                                  )}
                                  title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                  aria-label={`${isFavorite ? 'Remover' : 'Adicionar'} ${item.label} ${isFavorite ? 'dos' : 'aos'} favoritos`}
                                  aria-pressed={isFavorite}
                                >
                                  <Star className={cn('h-3.5 w-3.5', isFavorite && 'fill-current')} />
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </section>
                    )
                  })}
                </div>
              )}
            </div>

            <footer className="px-4 sm:px-5 py-2.5 border-t border-zinc-100 flex items-center justify-between gap-3 text-[11px] text-zinc-500 flex-shrink-0 bg-white">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Star className="h-3 w-3 text-amber-500 fill-current" />
                  <strong className="text-zinc-700">{favoriteItems.length}</strong> favorito{favoriteItems.length !== 1 ? 's' : ''}
                </span>
                <span className="text-zinc-300">·</span>
                <span className="whitespace-nowrap"><strong className="text-zinc-700">{allItems.length}</strong> recursos</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 whitespace-nowrap">
                <kbd className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-[9px] font-mono">↑↓</kbd>
                <span>navegar</span>
                <kbd className="ml-1 px-1.5 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-[9px] font-mono">Esc</kbd>
                <span>fechar</span>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
