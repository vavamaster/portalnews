import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type View =
  | { name: 'home' }
  | { name: 'article'; slug: string }
  | { name: 'category'; slug: string }
  | { name: 'search'; q: string }
  | { name: 'tag'; tag: string }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'profile' }
  | { name: 'credits' }
  | { name: 'store' }
  | { name: 'about' }
  | { name: 'contact' }
  | { name: 'classifieds' }
  | { name: 'classified'; slug: string }
  | { name: 'classified-category'; slug: string }
  | { name: 'classified-editor'; id?: string }
  | { name: 'plans' }
  | { name: 'advertiser' }
  | { name: 'editors' }
  | { name: 'editor-profile'; slug: string }
  | { name: 'editor-config'; userId: string }
  | { name: 'editor-bio-edit' }
  | { name: 'quotes' }
  | { name: 'enterprise' }
  | { name: 'empresa'; slug: string }
  | { name: 'admin'; section?: 'dashboard' | 'posts' | 'editor' | 'ads' | 'users' | 'seo' | 'categories' | 'classifieds' | 'editors' | 'review' | 'quotes' | 'slides' | 'ai' | 'gateways' | 'verifications' | 'home-config' | 'sponsored' | 'coupons' | 'wordpress' | 'social' | 'ai-autonews' | 'whatsapp' | 'analytics'; postId?: string }

export type CurrentUser = {
  id: string
  email: string
  name: string
  role: 'MASTER' | 'ADMIN' | 'EDITOR' | 'READER'
  avatar?: string | null
  points: number
  credits: number
  bio?: string | null
  checkInStreak?: number
  verificationStatus?: string
  hasEnterpriseAccess?: boolean
  enterpriseCompanyName?: string | null
}

type AppState = {
  user: CurrentUser | null
  view: View
  hydrated: boolean
  setUser: (user: CurrentUser | null) => void
  setView: (view: View) => void
  logout: () => void
  refreshUser: () => Promise<void>
  setHydrated: (v: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      view: { name: 'home' },
      hydrated: false,
      setUser: (user) => set({ user }),
      setView: (view) => set({ view }),
      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' })
        } catch {}
        set({ user: null, view: { name: 'home' } })
      },
      refreshUser: async () => {
        try {
          const res = await fetch('/api/auth/me')
          const data = await res.json()
          set({ user: data.user })
        } catch {
          set({ user: null })
        }
      },
      setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: 'portal-app',
      partialize: (state) => ({ user: state.user, view: state.view }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)

// Helper to get URL params from view
export function viewToUrl(view: View): string {
  const params = new URLSearchParams()
  switch (view.name) {
    case 'home': return '/'
    case 'article': return `/?article=${encodeURIComponent(view.slug)}`
    case 'category': return `/?category=${encodeURIComponent(view.slug)}`
    case 'search': return `/?search=${encodeURIComponent(view.q)}`
    case 'tag': return `/?tag=${encodeURIComponent(view.tag)}`
    case 'login': return '/?view=login'
    case 'register': return '/?view=register'
    case 'profile': return '/?view=profile'
    case 'credits': return '/?view=credits'
    case 'store': return '/?view=store'
    case 'about': return '/?view=about'
    case 'contact': return '/?view=contact'
    case 'classifieds': return '/?view=classifieds'
    case 'classified': return `/?classified=${encodeURIComponent(view.slug)}`
    case 'classified-category': return `/?ccat=${encodeURIComponent(view.slug)}`
    case 'classified-editor': {
      params.set('view', 'classified-editor')
      if (view.id) params.set('id', view.id)
      return `/?${params.toString()}`
    }
    case 'plans': return '/?view=plans'
    case 'advertiser': return '/?view=advertiser'
    case 'editors': return '/?view=editors'
    case 'editor-profile': return `/?editor=${encodeURIComponent(view.slug)}`
    case 'editor-config': return `/?editor-config=${encodeURIComponent(view.userId)}`
    case 'editor-bio-edit': return '/?view=editor-bio-edit'
    case 'quotes': return '/?view=quotes'
    case 'enterprise': return '/?view=enterprise'
    case 'empresa': return `/?empresa=${encodeURIComponent(view.slug)}`
    case 'admin':
      params.set('view', 'admin')
      if (view.section) params.set('section', view.section)
      if (view.postId) params.set('postId', view.postId)
      return `/?${params.toString()}`
  }
}

export function urlToView(searchParams: URLSearchParams): View {
  const article = searchParams.get('article')
  if (article) return { name: 'article', slug: article }
  const classified = searchParams.get('classified')
  if (classified) return { name: 'classified', slug: classified }
  const ccat = searchParams.get('ccat')
  if (ccat) return { name: 'classified-category', slug: ccat }
  const category = searchParams.get('category')
  if (category) return { name: 'category', slug: category }
  const search = searchParams.get('search')
  if (search) return { name: 'search', q: search }
  const tag = searchParams.get('tag')
  if (tag) return { name: 'tag', tag }
  const view = searchParams.get('view')
  const editor = searchParams.get('editor')
  if (editor) return { name: 'editor-profile', slug: editor }
  const editorConfig = searchParams.get('editor-config')
  if (editorConfig) return { name: 'editor-config', userId: editorConfig }
  if (view === 'login') return { name: 'login' }
  if (view === 'register') return { name: 'register' }
  if (view === 'profile') return { name: 'profile' }
  if (view === 'credits') return { name: 'credits' }
  if (view === 'store') return { name: 'store' }
  if (view === 'about') return { name: 'about' }
  if (view === 'contact') return { name: 'contact' }
  if (view === 'classifieds') return { name: 'classifieds' }
  if (view === 'classified-editor') {
    const id = searchParams.get('id') || undefined
    return { name: 'classified-editor', id }
  }
  if (view === 'plans') return { name: 'plans' }
  if (view === 'advertiser') return { name: 'advertiser' }
  if (view === 'editors') return { name: 'editors' }
  if (view === 'editor-bio-edit') return { name: 'editor-bio-edit' }
  if (view === 'quotes') return { name: 'quotes' }
  if (view === 'enterprise') return { name: 'enterprise' }
  if (view === 'admin') {
    const section = searchParams.get('section') as any
    const postId = searchParams.get('postId') || undefined
    return { name: 'admin', section: section || 'dashboard', postId }
  }
  const empresa = searchParams.get('empresa')
  if (empresa) return { name: 'empresa', slug: empresa }
  return { name: 'home' }
}
