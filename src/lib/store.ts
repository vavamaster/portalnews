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
  | { name: 'admin'; section?: 'dashboard' | 'posts' | 'editor' | 'ads' | 'users' | 'seo' | 'categories' | 'classifieds' | 'editors' | 'review' | 'quotes' | 'slides' | 'ai' | 'gateways' | 'verifications' | 'home-config' | 'sponsored' | 'coupons' | 'wordpress' | 'social' | 'ai-autonews' | 'whatsapp' | 'header-ads' | 'analytics' | 'audit'; postId?: string }

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
  const segment = (value: string) => encodeURIComponent(value.trim())
  switch (view.name) {
    case 'home': return '/'
    case 'article': return `/noticias/${segment(view.slug)}`
    case 'category': return `/categoria/${segment(view.slug)}`
    case 'search': return `/buscar?q=${encodeURIComponent(view.q.trim())}`
    case 'tag': return `/tag/${segment(view.tag)}`
    case 'login': return '/entrar'
    case 'register': return '/cadastro'
    case 'profile': return '/minha-conta'
    case 'credits': return '/meus-creditos'
    case 'store': return '/anuncie'
    case 'about': return '/sobre'
    case 'contact': return '/contato'
    case 'classifieds': return '/classificados'
    case 'classified': return `/classificados/anuncio/${segment(view.slug)}`
    case 'classified-category': return `/classificados/categoria/${segment(view.slug)}`
    case 'classified-editor': {
      return view.id ? `/classificados/editar/${segment(view.id)}` : '/classificados/anunciar'
    }
    case 'plans': return '/planos'
    case 'advertiser': return '/painel-anunciante'
    case 'editors': return '/editores'
    case 'editor-profile': return `/editores/${segment(view.slug)}`
    case 'editor-config': return `/?editor-config=${encodeURIComponent(view.userId)}`
    case 'editor-bio-edit': return '/editores/meu-perfil/editar'
    case 'quotes': return '/cotacoes'
    case 'enterprise': return '/empresa/painel'
    case 'empresa': return `/empresa/${segment(view.slug)}`
    case 'admin':
      if (view.section) params.set('section', view.section)
      if (view.postId) params.set('postId', view.postId)
      return params.size ? `/admin?${params.toString()}` : '/admin'
  }
}

function decodePathSegment(value: string) {
  try { return decodeURIComponent(value) } catch { return value }
}

export function urlToView(searchParams: URLSearchParams, pathname = '/'): View {
  const segments = pathname.split('/').filter(Boolean).map(decodePathSegment)
  const [first, second, third] = segments

  if (first === 'admin') {
    const section = searchParams.get('section') as Extract<View, { name: 'admin' }>['section']
    const postId = searchParams.get('postId') || undefined
    return { name: 'admin', section: section || 'dashboard', postId }
  }
  if (first === 'noticias' && second) return { name: 'article', slug: second }
  if (first === 'categoria' && second) return { name: 'category', slug: second }
  if (first === 'buscar') return { name: 'search', q: searchParams.get('q') || '' }
  if (first === 'tag' && second) return { name: 'tag', tag: second }
  if (first === 'entrar') return { name: 'login' }
  if (first === 'cadastro') return { name: 'register' }
  if (first === 'minha-conta') return { name: 'profile' }
  if (first === 'meus-creditos') return { name: 'credits' }
  if (first === 'anuncie') return { name: 'store' }
  if (first === 'sobre') return { name: 'about' }
  if (first === 'contato') return { name: 'contact' }
  if (first === 'planos') return { name: 'plans' }
  if (first === 'painel-anunciante') return { name: 'advertiser' }
  if (first === 'cotacoes') return { name: 'quotes' }
  if (first === 'classificados' && second === 'anuncio' && third) return { name: 'classified', slug: third }
  if (first === 'classificados' && second === 'categoria' && third) return { name: 'classified-category', slug: third }
  if (first === 'classificados' && second === 'editar' && third) return { name: 'classified-editor', id: third }
  if (first === 'classificados' && second === 'anunciar') return { name: 'classified-editor' }
  if (first === 'classificados' && !second) return { name: 'classifieds' }
  if (first === 'editores' && second === 'meu-perfil' && third === 'editar') return { name: 'editor-bio-edit' }
  if (first === 'editores' && second) return { name: 'editor-profile', slug: second }
  if (first === 'editores') return { name: 'editors' }
  if (first === 'empresa' && second === 'painel') return { name: 'enterprise' }
  if (first === 'empresa' && second) return { name: 'empresa', slug: second }

  // Legacy query-string routes remain readable during migration.
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
