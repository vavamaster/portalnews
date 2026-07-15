'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAppStore, urlToView, viewToUrl } from '@/lib/store'
import { Header } from '@/components/portal/Header'
import { Footer } from '@/components/portal/Footer'
import { HomeView } from '@/components/portal/HomeView'
import { ArticleView } from '@/components/article/ArticleView'
import { ListingView } from '@/components/portal/ListingView'
import { AuthView } from '@/components/portal/AuthView'
import { ProfileView } from '@/components/portal/ProfileView'
import { CreditsView } from '@/components/portal/CreditsView'
import { StoreView } from '@/components/portal/StoreView'
import { StaticView } from '@/components/portal/StaticView'
import { ClassifiedsView } from '@/components/classifieds/ClassifiedsView'
import { ClassifiedDetailView } from '@/components/classifieds/ClassifiedDetailView'
import { ClassifiedEditor } from '@/components/classifieds/ClassifiedEditor'
import { PlansView } from '@/components/classifieds/PlansView'
import { AdvertiserDashboard } from '@/components/classifieds/AdvertiserDashboard'
import { EditorsListView } from '@/components/portal/EditorsListView'
import { EditorProfileView } from '@/components/portal/EditorProfileView'
import { QuotesView } from '@/components/portal/QuotesView'
import { CookieConsent } from '@/components/portal/CookieConsent'
import { EditorBioEditor } from '@/components/portal/EditorBioEditor'
import { EnterpriseDashboard } from '@/components/portal/EnterpriseDashboard'
import { EnterpriseLandingPageView } from '@/components/portal/EnterpriseLandingPageView'
import { getThemeCssVariables } from '@/lib/theme-config'
import { LicenseScreen } from '@/components/portal/LicenseScreen'
import type { PublicLicenseStatus } from '@/lib/license'

const AdminView = dynamic(() => import('@/components/admin/AdminView').then(module => module.AdminView), {
  loading: () => <div className="min-h-screen flex items-center justify-center text-zinc-500">Carregando painel...</div>,
})
const EditorConfigPage = dynamic(() => import('@/components/admin/EditorConfigPage').then(module => module.EditorConfigPage))

interface HomeContentProps {
  initialLicenseStatus: PublicLicenseStatus
}

export function HomeContent({ initialLicenseStatus }: HomeContentProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { view, setView, user, refreshUser, hydrated } = useAppStore()
  const [categories, setCategories] = useState<any[]>([])
  const [seoSettings, setSeoSettings] = useState<Record<string, string>>({})
  const [licenseStatus, setLicenseStatus] = useState<PublicLicenseStatus>(initialLicenseStatus)
  const [bootstrapped, setBootstrapped] = useState(false)
  const routeReady = useRef(false)
  const syncingFromUrl = useRef(false)

  // Apply validated theme variables without injecting arbitrary CSS. The
  // server-rendered values remain active until /api/seo finishes loading.
  useEffect(() => {
    if (Object.keys(seoSettings).length === 0) return
    const root = document.documentElement
    const variables = getThemeCssVariables(seoSettings)
    for (const [name, value] of Object.entries(variables)) {
      root.style.setProperty(name, value)
    }
  }, [seoSettings])

  // Load categories & SEO on mount. Admin saves also trigger an immediate
  // portal-update event, while this interval covers changes from other clients.
  useEffect(() => {
    const loadData = () => {
      Promise.all([
        fetch('/api/categories'),
        fetch('/api/seo', { cache: 'no-store' }),
        fetch('/api/license/status', { cache: 'no-store' }),
      ]).then(async ([catsRes, seoRes, licenseRes]) => {
        if (!licenseRes.ok) throw new Error('Falha ao consultar a licença')
        return Promise.all([catsRes.json(), seoRes.json(), licenseRes.json()])
      }).then(([catsData, seoData, licenseData]) => {
        setCategories(catsData.categories || [])
        setSeoSettings(seoData.settings || {})
        setLicenseStatus(licenseData)
      }).catch(() => {
        // Fail closed: a licensing outage must never expose the public portal.
        setLicenseStatus({
          hasKey: initialLicenseStatus.hasKey,
          valid: false,
          status: 'status_unavailable',
          message: 'Não foi possível confirmar a licença do portal.',
          checkedAt: initialLicenseStatus.checkedAt,
          stale: true,
        })
      })
    }
    loadData()
    const interval = setInterval(loadData, 5 * 60 * 1000)

    // Listen for SEO/category/sponsored updates from admin panel (cross-tab sync via localStorage)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'seo-updated' || e.key === 'categories-updated' || e.key === 'sponsored-updated') {
        loadData() // reload immediately when admin saves
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // Also listen for custom event (more reliable for same-tab SPA navigation)
    const handlePortalUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.type === 'seo' || detail?.type === 'categories' || detail?.type === 'sponsored') {
        loadData()
      }
    }
    window.addEventListener('portal-update', handlePortalUpdate)

    // Also reload when window regains focus (admin saves in same tab, then switches back)
    const handleFocus = () => loadData()
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('portal-update', handlePortalUpdate)
      window.removeEventListener('focus', handleFocus)
    }
  }, [initialLicenseStatus])

  // Hydrate user on mount
  useEffect(() => {
    refreshUser().finally(() => setBootstrapped(true))
  }, [])

  // Sync URL <-> view
  useEffect(() => {
    if (!searchParams) return
    const newView = urlToView(searchParams, pathname)
    // Only update if different (avoid loops)
    const currentKey = JSON.stringify(useAppStore.getState().view)
    const newKey = JSON.stringify(newView)
    if (currentKey !== newKey) {
      syncingFromUrl.current = true
      setView(newView)
    }
    routeReady.current = true

    // Normalize legacy query-string links without adding another history entry.
    const friendlyUrl = viewToUrl(newView)
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (pathname === '/' && friendlyUrl !== currentUrl && [...searchParams.keys()].some(key => [
      'article', 'category', 'search', 'tag', 'view', 'classified', 'ccat', 'editor', 'empresa',
    ].includes(key))) {
      window.history.replaceState({}, '', friendlyUrl)
    }
  }, [pathname, searchParams, setView])

  // When view changes, update URL
  useEffect(() => {
    if (typeof window === 'undefined' || !routeReady.current) return
    if (syncingFromUrl.current) {
      syncingFromUrl.current = false
      return
    }
    const newUrl = viewToUrl(view)
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (newUrl !== currentUrl) window.history.pushState({}, '', newUrl)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [view])

  if (!bootstrapped) {
    const siteName = seoSettings.site_name || 'Portal'
    const siteLogo = seoSettings.site_logo || ''
    const siteInitials = siteName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          {siteLogo ? (
            <img src={siteLogo} alt={siteName} className="h-12 w-auto rounded mx-auto mb-3 animate-pulse" />
          ) : (
            <div className="bg-primary text-white font-black text-2xl px-4 py-2 rounded inline-block mb-3">{siteInitials}</div>
          )}
          <div className="inline-block">
            <div className="h-1.5 w-32 bg-zinc-200 rounded-full overflow-hidden mx-auto">
              <div className="h-full bg-primary rounded-full animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '40%' }}></div>
            </div>
          </div>
          <div className="text-zinc-400 text-sm mt-2">Carregando...</div>
        </div>
      </div>
    )
  }

  const isAdmin = user && ['MASTER', 'ADMIN'].includes(user.role)
  const canAccessPanel = user && ['MASTER', 'ADMIN', 'EDITOR'].includes(user.role)

  const socialLinks = {
    facebook: seoSettings.facebook_url,
    instagram: seoSettings.instagram_url,
    twitter: seoSettings.twitter_url,
    youtube: seoSettings.youtube_url,
    whatsapp: seoSettings.whatsapp_url,
  }

  // Admin view always accessible (even with invalid license) — admins manage the system
  if (view.name === 'admin' && canAccessPanel) {
    return <AdminView section={view.section || 'dashboard'} postId={view.postId} />
  }

  if (!licenseStatus.valid) {
    // An authenticated administrator is sent directly to the license settings
    // after login, while every public/editor/reader view stays blocked.
    if (isAdmin) return <AdminView section="seo" />
    return <LicenseScreen siteName={seoSettings.site_name} siteLogo={seoSettings.site_logo} />
  }

  return (
    <>
      <Header categories={categories} seoSettings={seoSettings} />
      <main className="flex-1">
        {view.name === 'home' && <HomeView categories={categories} />}
        {view.name === 'article' && <ArticleView slug={view.slug} seoSettings={seoSettings} />}
        {view.name === 'category' && <ListingView type="category" slug={view.slug} categories={categories} />}
        {view.name === 'search' && <ListingView type="search" q={view.q} categories={categories} />}
        {view.name === 'tag' && <ListingView type="tag" tag={view.tag} categories={categories} />}
        {view.name === 'login' && <AuthView mode="login" />}
        {view.name === 'register' && <AuthView mode="register" />}
        {view.name === 'profile' && <ProfileView />}
        {view.name === 'credits' && <CreditsView />}
        {view.name === 'store' && <StoreView />}
        {view.name === 'about' && <StaticView type="about" seoSettings={seoSettings} />}
        {view.name === 'contact' && <StaticView type="contact" seoSettings={seoSettings} />}
        {view.name === 'classifieds' && <ClassifiedsView />}
        {view.name === 'classified' && <ClassifiedDetailView slug={view.slug} />}
        {view.name === 'classified-category' && <ClassifiedsView initialCategory={view.slug} />}
        {view.name === 'classified-editor' && <ClassifiedEditor listingId={view.id} />}
        {view.name === 'plans' && <PlansView />}
        {view.name === 'advertiser' && <AdvertiserDashboard />}
        {view.name === 'editors' && <EditorsListView />}
        {view.name === 'editor-profile' && <EditorProfileView slug={view.slug} />}
        {view.name === 'editor-config' && <EditorConfigPage userId={view.userId} />}
        {view.name === 'editor-bio-edit' && <EditorBioEditor />}
        {view.name === 'quotes' && <QuotesView />}
        {view.name === 'enterprise' && <EnterpriseDashboard />}
        {view.name === 'empresa' && <EnterpriseLandingPageView slug={view.slug} />}
      </main>
      <Footer categories={categories} socialLinks={socialLinks} siteName={seoSettings.site_name} seoSettings={seoSettings} />
      <CookieConsent />
    </>
  )
}
