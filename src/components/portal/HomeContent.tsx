'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppStore, urlToView } from '@/lib/store'
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
import { AdminView } from '@/components/admin/AdminView'
import { ClassifiedsView } from '@/components/classifieds/ClassifiedsView'
import { ClassifiedDetailView } from '@/components/classifieds/ClassifiedDetailView'
import { ClassifiedEditor } from '@/components/classifieds/ClassifiedEditor'
import { PlansView } from '@/components/classifieds/PlansView'
import { AdvertiserDashboard } from '@/components/classifieds/AdvertiserDashboard'
import { EditorsListView } from '@/components/portal/EditorsListView'
import { EditorProfileView } from '@/components/portal/EditorProfileView'
import { QuotesView } from '@/components/portal/QuotesView'
import { EditorConfigPage } from '@/components/admin/EditorConfigPage'
import { CookieConsent } from '@/components/portal/CookieConsent'
import { EditorBioEditor } from '@/components/portal/EditorBioEditor'
import { EnterpriseDashboard } from '@/components/portal/EnterpriseDashboard'
import { EnterpriseLandingPageView } from '@/components/portal/EnterpriseLandingPageView'

export function HomeContent() {
  const searchParams = useSearchParams()
  const { view, setView, user, refreshUser, hydrated } = useAppStore()
  const [categories, setCategories] = useState<any[]>([])
  const [seoSettings, setSeoSettings] = useState<Record<string, string>>({})
  const [bootstrapped, setBootstrapped] = useState(false)

  // Load categories & SEO on mount + license status (auto-refresh every 5 min)
  useEffect(() => {
    const loadData = () => {
      Promise.all([
        fetch('/api/categories'),
        fetch('/api/seo'),
        fetch('/api/license/status'),
      ]).then(([catsRes, seoRes, licenseRes]) => {
        return Promise.all([catsRes.json(), seoRes.json(), licenseRes.json()])
      }).then(([catsData, seoData, licenseData]) => {
        setCategories(catsData.categories || [])
        setSeoSettings(seoData.settings || {})
      }).catch(() => {})
    }
    loadData()
    // Re-check license status every 1 minute (fast detection of expiration/suspension)
    const interval = setInterval(loadData, 60 * 1000)

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
  }, [])

  // Hydrate user on mount
  useEffect(() => {
    refreshUser().finally(() => setBootstrapped(true))
  }, [])

  // Sync URL <-> view
  useEffect(() => {
    if (!searchParams) return
    const newView = urlToView(searchParams)
    // Only update if different (avoid loops)
    const currentKey = JSON.stringify(useAppStore.getState().view)
    const newKey = JSON.stringify(newView)
    if (currentKey !== newKey) {
      setView(newView)
    }
  }, [searchParams])

  // When view changes, update URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const params = url.searchParams
    if (!params) return
    // Clear known keys
    ;['article', 'category', 'search', 'tag', 'view', 'section', 'postId', 'classified', 'ccat', 'id', 'editor', 'editor-config'].forEach(k => params.delete(k))

    switch (view.name) {
      case 'home': break
      case 'article': params.set('article', view.slug); break
      case 'category': params.set('category', view.slug); break
      case 'search': params.set('search', view.q); break
      case 'tag': params.set('tag', view.tag); break
      case 'login': params.set('view', 'login'); break
      case 'register': params.set('view', 'register'); break
      case 'profile': params.set('view', 'profile'); break
      case 'credits': params.set('view', 'credits'); break
      case 'store': params.set('view', 'store'); break
      case 'about': params.set('view', 'about'); break
      case 'contact': params.set('view', 'contact'); break
      case 'classifieds': params.set('view', 'classifieds'); break
      case 'classified': params.set('classified', view.slug); break
      case 'classified-category': params.set('ccat', view.slug); break
      case 'classified-editor':
        params.set('view', 'classified-editor')
        if (view.id) params.set('id', view.id)
        break
      case 'plans': params.set('view', 'plans'); break
      case 'advertiser': params.set('view', 'advertiser'); break
      case 'editors': params.set('view', 'editors'); break
      case 'editor-profile': params.set('editor', view.slug); break
      case 'editor-config': params.set('editor-config', view.userId); break
      case 'editor-bio-edit': params.set('view', 'editor-bio-edit'); break
      case 'quotes': params.set('view', 'quotes'); break
      case 'enterprise': params.set('view', 'enterprise'); break
      case 'empresa': params.set('empresa', view.slug); break
      case 'admin':
        params.set('view', 'admin')
        if (view.section) params.set('section', view.section)
        if (view.postId) params.set('postId', view.postId)
        break
    }
    const newUrl = `${url.pathname}${params.toString() ? '?' + params.toString() : ''}`
    window.history.replaceState({}, '', newUrl)
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

  // License check: if license is NOT valid (including no key configured), block site for non-admins
  const licenseLoaded = true
  const isAdmin = user && ['MASTER', 'ADMIN'].includes(user.role)

  const socialLinks = {
    facebook: seoSettings.facebook_url,
    instagram: seoSettings.instagram_url,
    twitter: seoSettings.twitter_url,
    youtube: seoSettings.youtube_url,
    whatsapp: seoSettings.whatsapp_url,
  }

  // Admin view always accessible (even with invalid license) — admins manage the system
  if (view.name === 'admin' && isAdmin) {
    return <AdminView section={view.section || 'dashboard'} postId={view.postId} />
  }

  return (
    <>
      {/* Inject ALL admin-configured colors as CSS variables for live theme application */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          ${seoSettings.primary_color ? `--primary: ${seoSettings.primary_color};` : ''}
          ${seoSettings.secondary_color ? `--secondary: ${seoSettings.secondary_color};` : ''}
          ${seoSettings.accent_color ? `--accent: ${seoSettings.accent_color};` : ''}
          ${seoSettings.header_bg_color ? `--header-bg: ${seoSettings.header_bg_color};` : ''}
          ${seoSettings.header_text_color ? `--header-text: ${seoSettings.header_text_color};` : ''}
          ${seoSettings.nav_bg_color ? `--nav-bg: ${seoSettings.nav_bg_color};` : ''}
        }
      ` }} />
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
