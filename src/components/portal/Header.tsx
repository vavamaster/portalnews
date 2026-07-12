'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore, type View } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  Search, Menu, ChevronDown, User as UserIcon, LogOut, LayoutDashboard,
  Coins, Award, ShoppingBag, Flame, Sparkles, Store, Megaphone,
  Users, Home as HomeIcon, Crown, X,
} from 'lucide-react'
import { NotificationsBell } from './NotificationsBell'
import { CheckInButton } from './CheckInButton'
import { QuoteMiniCards } from './QuoteMiniCards'
import { WeatherWidget } from './WeatherWidget'
import { UserAvatar } from './UserAvatar'
import { HeaderAdSlot } from './HeaderAdSlot'
import { ThemeToggle } from './ThemeToggle'
import { MegaMenu } from './MegaMenu'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'

interface Category {
  id: string
  slug: string
  name: string
  color: string | null
  icon: string | null
  description?: string | null
}

export function Header({ categories, seoSettings }: { categories: Category[]; seoSettings?: Record<string, string> }) {
  const headerTemplate = seoSettings?.header_template || 'classic'
  if (headerTemplate === 'modern') return <ModernHeader categories={categories} seoSettings={seoSettings} />
  if (headerTemplate === 'minimal') return <MinimalHeader categories={categories} seoSettings={seoSettings} />
  return <ClassicHeader categories={categories} seoSettings={seoSettings} />
}

// ============================================================
// Shared helpers
// ============================================================

function useHeaderState(seoSettings?: Record<string, string>, categories: Category[] = []) {
  const [searchValue, setSearchValue] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [now, setNow] = useState<string>('')
  const { user, setView, view, logout, refreshUser } = useAppStore()
  const { toast } = useToast()
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      try { await refreshUser() } catch {}
    })()
    const interval = setInterval(() => { refreshUser().catch(() => {}) }, 60 * 1000)
    return () => clearInterval(interval)
  }, [refreshUser])

  const siteName = seoSettings?.site_name || 'Portal de Notícias'
  const siteInitials = siteName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  const siteTagline = seoSettings?.site_tagline || 'Jornalismo & Verdade'
  const siteLogo = seoSettings?.site_logo || ''
  const cityState = [seoSettings?.site_city, seoSettings?.site_state].filter(Boolean).join(', ')
  const socials = {
    facebook: seoSettings?.facebook_url || 'https://facebook.com',
    instagram: seoSettings?.instagram_url || 'https://instagram.com',
    youtube: seoSettings?.youtube_url || 'https://youtube.com',
    twitter: seoSettings?.twitter_url || 'https://twitter.com',
  }

  // Logo config
  // If site_logo is set but logo_style is 'text', upgrade to 'logo-text' automatically
  // so the uploaded logo is shown alongside the site name
  let logoStyle = seoSettings?.logo_style || 'logo-text'
  if (seoSettings?.site_logo && logoStyle === 'text') {
    logoStyle = 'logo-text'
  }
  const logoSize = seoSettings?.logo_size || 'md'
  const logoHeights: Record<string, string> = { sm: 'h-7', md: 'h-10', lg: 'h-14', xl: 'h-20' }
  const logoHeight = logoHeights[logoSize] || 'h-10'

  // Theme colors
  const headerBg = seoSettings?.header_bg_color || '#ffffff'
  const headerText = seoSettings?.header_text_color || '#18181b'
  const navBg = seoSettings?.nav_bg_color || '#fafafa'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const update = () => {
      const d = new Date()
      const fmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
      setNow(fmt.format(d).replace(/^\w/, c => c.toUpperCase()))
    }
    update()
    const t = setInterval(update, 60_000)
    return () => clearInterval(t)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchValue.trim()) {
      setView({ name: 'search', q: searchValue.trim() })
      setSearchValue('')
    }
  }

  const handleNav = (v: View) => {
    setView(v)
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLogout = async () => {
    await logout()
    toast({ title: 'Logout realizado' })
  }

  const isAdmin = user && ['MASTER', 'ADMIN', 'EDITOR'].includes(user.role)
  const navCats = categories.slice(0, 7)
  const extraCats = categories.slice(7)

  return {
    searchValue, setSearchValue, mobileOpen, setMobileOpen, scrolled, now,
    user, setView, view, logout, toast, searchInputRef,
    siteName, siteInitials, siteTagline, siteLogo, cityState, socials,
    logoStyle, logoHeight,
    headerBg, headerText, navBg,
    handleSearch, handleNav, handleLogout,
    isAdmin, navCats, extraCats,
  }
}

// Shared Logo component
function Logo({ state, onClick }: { state: ReturnType<typeof useHeaderState>; onClick: () => void }) {
  const { siteLogo, siteName, siteInitials, siteTagline, logoStyle, logoHeight } = state
  // Determine if logo image should be shown
  const showLogo = (logoStyle === 'logo' || logoStyle === 'logo-text' || logoStyle === 'logo-text-subtitle') && siteLogo
  const showFallback = (logoStyle === 'logo' || logoStyle === 'logo-text' || logoStyle === 'logo-text-subtitle') && !siteLogo
  const showText = (logoStyle === 'text' || logoStyle === 'logo-text' || logoStyle === 'logo-text-subtitle')

  return (
    <button onClick={onClick} className="flex items-center gap-2.5 group flex-shrink-0">
      {showLogo && (
        <img
          src={siteLogo}
          alt={siteName}
          className={cn(logoHeight, 'w-auto max-w-[200px] object-contain rounded-lg transition-shadow group-hover:shadow-md')}
          onError={(e) => {
            // Hide broken image and show fallback
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      {showFallback && (
        <div
          className={cn('bg-primary text-white rounded-lg flex items-center justify-center transition-shadow group-hover:shadow-md text-sm', logoHeight)}
          style={{ fontWeight: 800, minWidth: '2.5rem', aspectRatio: '2 / 1' }}
        >
          {siteInitials}
        </div>
      )}
      {showText && (
        <div className="hidden sm:block leading-tight">
          <div className="text-zinc-900 dark:text-zinc-100 text-lg" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            {siteName}
          </div>
          {logoStyle === 'logo-text-subtitle' && (
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
              {siteTagline}
            </div>
          )}
        </div>
      )}
    </button>
  )
}

// Shared Search component
function SearchBar({ state, className }: { state: ReturnType<typeof useHeaderState>; className?: string }) {
  return (
    <form onSubmit={state.handleSearch} className={cn('hidden md:flex flex-1 max-w-lg mx-6 relative', className)}>
      <Input
        ref={state.searchInputRef}
        value={state.searchValue}
        onChange={(e) => state.setSearchValue(e.target.value)}
        placeholder="Buscar notícias..."
        className="h-10 pr-10 bg-zinc-50 border-zinc-200 rounded-full text-sm focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
      />
      <button type="submit" className="absolute right-0 top-0 h-10 px-3 flex items-center">
        <Search className="h-4 w-4 text-zinc-400" />
      </button>
    </form>
  )
}

// Shared UserActions component
function UserActions({ state }: { state: ReturnType<typeof useHeaderState> }) {
  const { user, setView, handleNav, handleLogout, isAdmin } = state
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="icon" className="md:hidden h-10 w-10" onClick={() => state.searchInputRef.current?.focus()}>
        <Search className="h-5 w-5" />
      </Button>
      {/* Dark mode toggle — visible on all screens */}
      <ThemeToggle />
      {user && <CheckInButton />}
      {user && <NotificationsBell />}
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2 h-10 hover:bg-zinc-100 rounded-full">
              <UserAvatar name={user.name} avatar={user.avatar} size="sm" />
              <div className="hidden lg:flex items-center gap-2.5">
                <span className="text-sm text-zinc-900" style={{ fontWeight: 500 }}>{user.name.split(' ')[0]}</span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="flex items-center gap-0.5 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600 }}>
                    <Award className="h-3 w-3" />{user.points}
                  </span>
                  <span className="flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600 }}>
                    <Coins className="h-3 w-3" />{user.credits}
                  </span>
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm" style={{ fontWeight: 500 }}>{user.name}</span>
                <span className="text-xs text-zinc-500">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNav({ name: 'profile' })}><UserIcon className="h-4 w-4 mr-2" /> Perfil</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNav({ name: 'credits' })}><Award className="h-4 w-4 mr-2" /> Pontos & Créditos</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNav({ name: 'classifieds' })}><Store className="h-4 w-4 mr-2" /> Classificados</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNav({ name: 'advertiser' })}><LayoutDashboard className="h-4 w-4 mr-2" /> Meus Anúncios</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNav({ name: 'plans' })}><Sparkles className="h-4 w-4 mr-2" /> Planos</DropdownMenuItem>
            {user.hasEnterpriseAccess && (
              <DropdownMenuItem onClick={() => handleNav({ name: 'enterprise' })} className="text-amber-700">
                <Crown className="h-4 w-4 mr-2" /> Anúncio Enterprise
              </DropdownMenuItem>
            )}
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNav({ name: 'admin', section: 'dashboard' })} className="text-primary">
                  <LayoutDashboard className="h-4 w-4 mr-2" /> Admin
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-zinc-500"><LogOut className="h-4 w-4 mr-2" /> Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleNav({ name: 'login' })} className="h-10 text-sm hidden sm:inline-flex">Entrar</Button>
          <Button size="sm" onClick={() => handleNav({ name: 'register' })} className="bg-primary h-10 text-sm px-4">
            <Sparkles className="h-4 w-4 mr-1" /> Criar Conta
          </Button>
        </div>
      )}
    </div>
  )
}

// Shared MobileMenu
function MobileMenu({ state, categories }: { state: ReturnType<typeof useHeaderState>; categories: Category[] }) {
  const { mobileOpen, setMobileOpen, siteLogo, siteName, siteInitials, handleNav, user, isAdmin, handleLogout } = state
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden -ml-2" aria-label="Menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {siteLogo ? (
              <img src={siteLogo} alt={siteName} className="h-8 w-auto rounded" />
            ) : (
              <span className="bg-primary text-white text-lg px-2.5 py-0.5 rounded" style={{ fontWeight: 700 }}>{siteInitials}</span>
            )}
            <span style={{ fontWeight: 600 }}>{siteName}</span>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-0.5">
          <MobileLink icon={HomeIcon} label="Início" onClick={() => handleNav({ name: 'home' })} active={state.view.name === 'home'} />
          {categories.map(c => (
            <MobileLink key={c.id} label={c.name} onClick={() => handleNav({ name: 'category', slug: c.slug })} active={state.view.name === 'category' && state.view.slug === c.slug} dotColor={c.color} />
          ))}
          <div className="my-3 border-t" />
          <MobileLink icon={Store} label="Classificados" onClick={() => handleNav({ name: 'classifieds' })} active={state.view.name === 'classifieds'} />
          <MobileLink icon={Users} label="Editores" onClick={() => handleNav({ name: 'editors' })} active={state.view.name === 'editors'} />
          <MobileLink icon={ShoppingBag} label="Anuncie Grátis" onClick={() => handleNav({ name: 'store' })} active={state.view.name === 'store'} />
          {user ? (
            <>
              <div className="my-3 border-t" />
              <MobileLink icon={UserIcon} label="Meu Perfil" onClick={() => handleNav({ name: 'profile' })} />
              <MobileLink icon={Award} label="Pontos & Créditos" onClick={() => handleNav({ name: 'credits' })} />
              <MobileLink icon={LayoutDashboard} label="Meus Anúncios" onClick={() => handleNav({ name: 'advertiser' })} />
              <MobileLink icon={Sparkles} label="Planos & Assinatura" onClick={() => handleNav({ name: 'plans' })} />
              {user.hasEnterpriseAccess && <MobileLink icon={Crown} label="Anúncio Enterprise" onClick={() => handleNav({ name: 'enterprise' })} className="text-amber-700" />}
              {isAdmin && <MobileLink icon={LayoutDashboard} label="Painel Admin" onClick={() => handleNav({ name: 'admin', section: 'dashboard' })} className="text-primary" />}
              <MobileLink icon={LogOut} label="Sair" onClick={handleLogout} className="text-zinc-500" />
            </>
          ) : (
            <>
              <div className="my-3 border-t" />
              <MobileLink icon={UserIcon} label="Entrar" onClick={() => handleNav({ name: 'login' })} />
              <button onClick={() => handleNav({ name: 'register' })} className="flex w-full items-center gap-2 rounded px-3 py-2.5 bg-primary text-white" style={{ fontWeight: 600 }}>
                <Sparkles className="h-4 w-4" /> Criar Conta
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Shared Navigation row
function Navigation({ state }: { state: ReturnType<typeof useHeaderState> }) {
  const { view, handleNav, navCats, extraCats } = state
  // First 5 categories get mega-menu on hover, the rest stay as plain buttons
  const megaCats = navCats.slice(0, 5)
  const plainCats = navCats.slice(5)
  return (
    <nav className="hidden md:block border-t border-zinc-100 dark:border-zinc-800">
      <div className="news-container flex items-center h-11">
        <button
          onClick={() => handleNav({ name: 'home' })}
          className={cn('px-4 h-full text-sm transition-colors flex items-center gap-1.5', view.name === 'home' ? 'text-primary' : 'hover:text-primary')}
          style={{ fontWeight: 600, color: view.name === 'home' ? undefined : 'var(--header-text)' }}
        >
          <HomeIcon className="h-4 w-4" /> Início
        </button>
        {megaCats.map(c => (
          <MegaMenu key={c.id} category={c}>
            <button
              onClick={() => handleNav({ name: 'category', slug: c.slug })}
              className={cn('px-4 h-full text-sm transition-colors relative flex items-center gap-1', view.name === 'category' && view.slug === c.slug ? 'text-primary' : 'hover:text-zinc-900 dark:hover:text-zinc-100')}
              style={{ fontWeight: 600, color: (view.name === 'category' && view.slug === c.slug) ? undefined : 'var(--header-text)' }}
            >
              {c.name}
              <ChevronDown className="h-3 w-3 opacity-50" />
              <span className={cn('absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary transition-all rounded-full', view.name === 'category' && view.slug === c.slug ? 'w-6' : 'w-0')} />
            </button>
          </MegaMenu>
        ))}
        {plainCats.map(c => (
          <button
            key={c.id}
            onClick={() => handleNav({ name: 'category', slug: c.slug })}
            className={cn('px-4 h-full text-sm transition-colors relative', view.name === 'category' && view.slug === c.slug ? 'text-primary' : 'hover:text-zinc-900 dark:hover:text-zinc-100')}
            style={{ fontWeight: 600, color: (view.name === 'category' && view.slug === c.slug) ? undefined : 'var(--header-text)' }}
          >
            {c.name}
            <span className={cn('absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary transition-all rounded-full', view.name === 'category' && view.slug === c.slug ? 'w-6' : 'w-0')} />
          </button>
        ))}
        {extraCats.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-4 h-full text-sm flex items-center gap-1" style={{ fontWeight: 600, color: 'var(--header-text)' }}>
                Mais <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {extraCats.map(c => (
                <DropdownMenuItem key={c.id} onClick={() => handleNav({ name: 'category', slug: c.slug })}>
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => handleNav({ name: 'classifieds' })} className="px-4 h-full text-sm text-amber-700 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-400 flex items-center gap-1.5 transition-colors" style={{ fontWeight: 600 }}>
            <Store className="h-4 w-4" /> Classificados
          </button>
          <button onClick={() => handleNav({ name: 'store' })} className="px-4 h-full text-sm text-primary hover:opacity-80 flex items-center gap-1.5 transition-colors" style={{ fontWeight: 600 }}>
            <Megaphone className="h-4 w-4" /> Anuncie Grátis
          </button>
        </div>
      </div>
    </nav>
  )
}

// Shared BreakingTicker
function BreakingTicker() {
  const [breaking, setBreaking] = useState<any[]>([])
  const { setView } = useAppStore()
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/posts?breaking=true&limit=5')
        const data = await r.json()
        setBreaking(data.posts || [])
      } catch {}
    })()
  }, [])

  if (breaking.length === 0) return null

  const marqueeBreaking = [...breaking, ...breaking]

  return (
    <div className="bg-primary text-white h-9 overflow-hidden">
      <div className="news-container flex items-center h-full">
        <div className="flex items-center gap-1.5 text-xs flex-shrink-0 pr-4 border-r border-white/20 mr-4" style={{ fontWeight: 700 }}>
          <Flame className="h-3.5 w-3.5" />
          URGENTE
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="quote-marquee" style={{ animationDuration: '60s' }}>
            {marqueeBreaking.map((p, idx) => (
              <span
                key={`${p.id}-${idx}`}
                className="cursor-pointer hover:underline text-xs opacity-90 hover:opacity-100 transition-opacity"
                onClick={() => setView({ name: 'article', slug: p.slug })}
              >
                {p.title}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Shared UtilityBar (used in Classic)
function UtilityBar({ state }: { state: ReturnType<typeof useHeaderState> }) {
  const { now, cityState, socials, handleNav } = state
  return (
    <div className="bg-zinc-900 text-zinc-300 hidden md:block">
      <div className="news-container flex items-center justify-between h-8">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-400">{now}</span>
          {cityState && (
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-1 h-1 rounded-full bg-blue-500" />
              {cityState}
            </span>
          )}
        </div>
        <div className="flex items-center gap-5 text-xs">
          <button onClick={() => handleNav({ name: 'about' })} className="hover:text-white transition-colors">Sobre</button>
          <button onClick={() => handleNav({ name: 'contact' })} className="hover:text-white transition-colors">Contato</button>
          <button onClick={() => handleNav({ name: 'store' })} className="hover:text-white transition-colors font-medium text-blue-400">Anuncie</button>
          <span className="w-px h-3.5 bg-zinc-700" />
          <div className="flex items-center gap-2.5">
            {(['facebook', 'instagram', 'youtube', 'twitter'] as const).map(s => (
              <a key={s} href={socials[s]} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" aria-label={s}>
                <SocialIcon name={s} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Shared QuotesWeatherRow (used in Classic)
function QuotesWeatherRow() {
  return (
    <div className="bg-zinc-100 border-b border-zinc-200 hidden md:block">
      <div className="news-container flex items-center h-8">
        <div className="flex-1 min-w-0">
          <QuoteMiniCards />
        </div>
        <div className="flex-shrink-0 pl-3 border-l border-zinc-300">
          <WeatherWidget />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// TEMPLATE 1: CLASSIC — utility bar + quotes + brand+search+user + nav + ticker
// ============================================================
function ClassicHeader({ categories, seoSettings }: { categories: Category[]; seoSettings?: Record<string, string> }) {
  const state = useHeaderState(seoSettings, categories)
  return (
    <header className="sticky top-0 z-50 w-full">
      <UtilityBar state={state} />
      <QuotesWeatherRow />
      <HeaderAdSlot position="above-brand" />
      <div className={cn('bg-white transition-all', state.scrolled ? 'shadow-md' : 'border-b border-zinc-100')} style={{ backgroundColor: 'var(--header-bg)' }}>
        <div className="news-container">
          <div className="flex items-center justify-between gap-4 h-16">
            <MobileMenu state={state} categories={categories} />
            <Logo state={state} onClick={() => state.handleNav({ name: 'home' })} />
            <SearchBar state={state} />
            <UserActions state={state} />
          </div>
        </div>
        <Navigation state={state} />
      </div>
      <HeaderAdSlot position="below-nav" />
      <BreakingTicker />
    </header>
  )
}

// ============================================================
// TEMPLATE 2: MODERN — single row brand+search+user + nav + ticker (no utility bar, no quotes)
// ============================================================
function ModernHeader({ categories, seoSettings }: { categories: Category[]; seoSettings?: Record<string, string> }) {
  const state = useHeaderState(seoSettings, categories)
  return (
    <header className="sticky top-0 z-50 w-full">
      <HeaderAdSlot position="above-brand" />
      <div className={cn('bg-white transition-all', state.scrolled ? 'shadow-md' : 'border-b border-zinc-100')} style={{ backgroundColor: 'var(--header-bg)' }}>
        <div className="news-container">
          <div className="flex items-center justify-between gap-4 h-16">
            <MobileMenu state={state} categories={categories} />
            <Logo state={state} onClick={() => state.handleNav({ name: 'home' })} />
            <SearchBar state={state} />
            <UserActions state={state} />
          </div>
        </div>
        <Navigation state={state} />
      </div>
      <HeaderAdSlot position="below-nav" />
      <BreakingTicker />
    </header>
  )
}

// ============================================================
// TEMPLATE 3: MINIMAL — centered logo + hamburger + search reveal + nav inline
// ============================================================
function MinimalHeader({ categories, seoSettings }: { categories: Category[]; seoSettings?: Record<string, string> }) {
  const state = useHeaderState(seoSettings, categories)
  const [searchOpen, setSearchOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 w-full">
      <HeaderAdSlot position="above-brand" />
      <div className={cn('bg-white transition-all', state.scrolled ? 'shadow-md' : 'border-b border-zinc-100')} style={{ backgroundColor: 'var(--header-bg)' }}>
        <div className="news-container">
          {/* Single row: hamburger | logo centered | search+user */}
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-2 flex-1">
              <MobileMenu state={state} categories={categories} />
              <Button variant="ghost" size="icon" className="md:hidden h-10 w-10" onClick={() => setSearchOpen(!searchOpen)}>
                <Search className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-shrink-0">
              <Logo state={state} onClick={() => state.handleNav({ name: 'home' })} />
            </div>
            <div className="flex items-center gap-2 flex-1 justify-end">
              <SearchBar state={state} className="max-w-xs mx-0" />
              <UserActions state={state} />
            </div>
          </div>
          {/* Mobile search reveal */}
          {searchOpen && (
            <div className="md:hidden pb-3">
              <form onSubmit={state.handleSearch} className="relative">
                <Input
                  ref={state.searchInputRef}
                  value={state.searchValue}
                  onChange={(e) => state.setSearchValue(e.target.value)}
                  placeholder="Buscar notícias..."
                  className="h-10 pr-10 bg-zinc-50 border-zinc-200 rounded-full text-sm"
                  autoFocus
                />
                <button type="submit" className="absolute right-0 top-0 h-10 px-3 flex items-center">
                  <Search className="h-4 w-4 text-zinc-400" />
                </button>
                <button type="button" onClick={() => setSearchOpen(false)} className="absolute right-10 top-0 h-10 px-2 flex items-center">
                  <X className="h-4 w-4 text-zinc-400" />
                </button>
              </form>
            </div>
          )}
        </div>
        <Navigation state={state} />
      </div>
      <HeaderAdSlot position="below-nav" />
      <BreakingTicker />
    </header>
  )
}

// ============================================================
// Sub-components
// ============================================================

function MobileLink({ icon: Icon, label, onClick, active, dotColor, className }: {
  icon?: any; label: string; onClick: () => void; active?: boolean; dotColor?: string | null; className?: string
}) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-accent transition-colors', active && 'text-primary', className)} style={{ fontWeight: active ? 600 : 400 }}>
      {Icon && <Icon className="h-4 w-4" />}
      {!Icon && dotColor && <span className={cn('h-2 w-2 rounded-full', `bg-${dotColor}-500`)} />}
      {label}
    </button>
  )
}

function SocialIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactElement> = {
    facebook: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    instagram: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z"/></svg>,
    youtube: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    twitter: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  }
  return icons[name] || null
}
