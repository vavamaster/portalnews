'use client'

import { useEffect, useState, Fragment } from 'react'
import { useAppStore } from '@/lib/store'
import { ArticleCard } from './ArticleCard'
import { AdBanner } from './AdBanner'
import { HeroSlideshow } from './HeroSlideshow'
import { SponsoredCategoryBanner } from './SponsoredCategoryBanner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft, Loader2, Search as SearchIcon, Tag, Flame, Eye,
  ArrowRight, Sparkles, Megaphone, Mail, ChevronRight, Home as HomeIcon,
  Bookmark,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  type: 'category' | 'search' | 'tag'
  slug?: string
  q?: string
  tag?: string
  categories?: any[]
}

export function ListingView({ type, slug, q, tag, categories = [] }: Props) {
  const { setView, user } = useAppStore()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [slideConfig, setSlideConfig] = useState<any>(null)
  const [slidePosts, setSlidePosts] = useState<any[]>([])
  const [mostRead, setMostRead] = useState<any[]>([])
  const limit = 12

  const category = categories.find(c => c.slug === slug)

  useEffect(() => {
    setLoading(true)
    setPosts([])
    setOffset(0)
    setTotal(0)
    setSlideConfig(null)
    setSlidePosts([])
    setMostRead([])
    if (type === 'category' && slug) {
      const cat = categories.find(c => c.slug === slug)
      if (cat) {
        fetch(`/api/slide-config?categoryId=${cat.id}`).then(r => r.json()).then(async (data) => {
          const cfg = data.config
          if (cfg && cfg.isEnabled) {
            setSlideConfig(cfg)
            let url = `/api/posts?category=${slug}&limit=${cfg.postCount || 5}`
            // Unified filterType vocabulary: featured / latest / breaking / all
            // (back-compat: 'views'→all, 'recent'→latest)
            const ft = String(cfg.filterType || 'featured').toLowerCase()
            if (ft === 'featured') url += '&featured=true'
            else if (ft === 'breaking') url += '&breaking=true'
            else if (ft === 'all' || ft === 'views') url += '&sortBy=views'
            else url += '&sortBy=recent' // 'latest' / 'recent' / unknown
            const slideRes = await fetch(url)
            const slideData = await slideRes.json()
            setSlidePosts(slideData.posts || [])
          }
        }).catch(() => {})
        // Load most read for this category
        fetch(`/api/posts?category=${slug}&sortBy=views&limit=5`).then(r => r.json()).then(d => setMostRead(d.posts || [])).catch(() => {})
      }
    }
  }, [slug, q, tag])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('limit', String(limit))
        params.set('offset', String(offset))
        if (type === 'category' && slug) params.set('category', slug)
        else if (type === 'search' && q) params.set('search', q)
        else if (type === 'tag' && tag) params.set('tag', tag)
        const res = await fetch(`/api/posts?${params.toString()}`)
        const data = await res.json()
        setPosts(prev => offset === 0 ? (data.posts || []) : [...prev, ...(data.posts || [])])
        setTotal(data.total || 0)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [type, slug, q, tag, offset])

  const title = type === 'category'
    ? (category?.name || 'Categoria')
    : type === 'search'
    ? `Resultados para "${q}"`
    : `Tag: #${tag}`

  const description = type === 'category' && category?.description ? category.description : undefined

  // Magazine layout: first post as hero, next 2 as overlay, rest in grid
  const heroPost = offset === 0 ? posts[0] : null
  const secondaryPosts = offset === 0 ? posts.slice(1, 3) : []
  const gridPosts = offset === 0 ? posts.slice(3) : posts

  return (
    <div className="news-container py-6 animate-fade-in">
      {/* === BREADCRUMB (path, not back button) === */}
      <nav className="flex items-center gap-2 text-xs text-zinc-500 mb-4">
        <button onClick={() => setView({ name: 'home' })} className="hover:text-primary flex items-center gap-1">
          <HomeIcon className="h-3 w-3" /> Início
        </button>
        <span>/</span>
        <span className="text-zinc-900" style={{ fontWeight: 500 }}>{title}</span>
      </nav>

      {/* === HEADER DA CATEGORIA — título | anúncio | contador (mesma linha) === */}
      <div className="mb-6 pb-4 border-b-2 border-zinc-100">
        <div className="flex items-center gap-3">
          {/* Coluna 1: ícone + título + subtítulo */}
          {category && (
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-white flex-shrink-0', `bg-${category.color || 'slate'}-500`)}>
              {type === 'tag' ? <Tag className="h-5 w-5" /> : type === 'search' ? <SearchIcon className="h-5 w-5" /> : <Flame className="h-5 w-5" />}
            </div>
          )}
          <div className="flex-shrink-0 min-w-0">
            <h1 className="text-2xl sm:text-3xl text-zinc-900" style={{ fontWeight: 600 }}>{title}</h1>
            {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
          </div>

          {/* Coluna 2: anúncio Enterprise (ocupa espaço restante) */}
          {type === 'category' && category?.id && (
            <div className="flex-1 min-w-0 h-14">
              <SponsoredCategoryBanner categoryId={category.id} variant="inline" />
            </div>
          )}

          {/* Coluna 3: contador de notícias */}
          <div className="text-right text-xs text-zinc-500 hidden sm:block flex-shrink-0">
            <div className="font-numeric text-zinc-900 text-lg" style={{ fontWeight: 700 }}>{total}</div>
            <div>notícia{total !== 1 ? 's' : ''}</div>
          </div>
          {type === 'search' && q && <SaveSearchButton q={q} />}
        </div>
      </div>

      {/* === SLIDE BANNER (abaixo do header) === */}
      {type === 'category' && slideConfig && slidePosts.length > 0 && (
        <div className="mb-6">
          <HeroSlideshow config={slideConfig} posts={slidePosts} categoryId={category?.id} />
        </div>
      )}

      {loading && posts.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <SearchIcon className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-lg text-zinc-900 mb-1" style={{ fontWeight: 500 }}>Nenhuma notícia encontrada</h3>
          <p className="text-zinc-600 mb-4">Tente buscar por outro termo ou explore outras editorias.</p>
          <Button onClick={() => setView({ name: 'home' })}>Voltar ao início</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* === COLUNA PRINCIPAL (2/3) === */}
          <div className="lg:col-span-2">
            {/* Hero da categoria (só página 1) */}
            {heroPost && (
              <div className="mb-6">
                <ArticleCard post={heroPost} variant="hero" />
              </div>
            )}

            {/* 2 posts médios overlay (só página 1) */}
            {secondaryPosts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                {secondaryPosts.map(p => (
                  <ArticleCard key={p.id} post={p} variant="standard" showExcerpt />
                ))}
              </div>
            )}

            {/* Infeed ad entre blocos */}
            {offset === 0 && gridPosts.length > 0 && (
              <div className="mb-6">
                <AdBanner placement="ARTICLE_INFEED" variant="full" />
              </div>
            )}

            {/* Grid 3 colunas com infeed a cada 3 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {gridPosts.map((p, i) => (
                <Fragment key={p.id}>
                  <ArticleCard post={p} variant="standard" />
                  {(i + 1) % 3 === 0 && i < gridPosts.length - 1 && (
                    <AdBanner placement="ARTICLE_INFEED" variant="full" />
                  )}
                </Fragment>
              ))}
            </div>

            {/* Ad CATEGORY_BOTTOM */}
            <div className="mt-6">
              <AdBanner placement="CATEGORY_BOTTOM" variant="full" />
            </div>

            {/* Carregar mais */}
            {posts.length < total && (
              <div className="text-center mt-8">
                <Button
                  onClick={() => setOffset(o => o + limit)}
                  disabled={loading}
                  variant="outline"
                  size="lg"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Carregar mais notícias
                </Button>
              </div>
            )}
          </div>

          {/* === SIDEBAR ATIVO (1/3) — sticky === */}
          <aside className="lg:col-span-1">
            <div className="sticky top-32 space-y-5">
              {/* Ad CATEGORY_SIDEBAR */}
              <AdBanner placement="CATEGORY_SIDEBAR" variant="sidebar" />

              {/* Mais Lidas da Categoria */}
              {mostRead.length > 0 && (
                <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="h-5 w-1 rounded-full bg-primary" />
                    <h3 className="text-zinc-900 text-base" style={{ fontWeight: 600 }}>Mais Lidas</h3>
                    {slug && (
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider ml-auto truncate max-w-[80px]">{slug}</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {mostRead.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex gap-3 items-start group cursor-pointer"
                        onClick={() => { setView({ name: 'article', slug: p.slug }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      >
                        <div className="text-2xl text-zinc-200 leading-none w-8 group-hover:text-primary transition-colors font-numeric flex-shrink-0" style={{ fontWeight: 300 }}>
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-zinc-900 text-xs leading-snug line-clamp-3 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>
                            {p.title}
                          </h4>
                          <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-0.5">
                            <Eye className="h-2.5 w-2.5" /> {p.views}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ad HOME_SIDEBAR (segundo anúncio) */}
              <AdBanner placement="HOME_SIDEBAR" variant="sidebar" />

              {/* CTA Anuncie nesta editoria */}
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-2xl p-5 text-center">
                <div className="bg-emerald-500 text-white h-9 w-9 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Megaphone className="h-4 w-4" />
                </div>
                <h3 className="text-zinc-900 text-sm mb-1" style={{ fontWeight: 600 }}>Anuncie nesta editoria</h3>
                <p className="text-xs text-zinc-500 mb-3">Seus anúncios contextualizados com a audiência certa.</p>
                <button
                  onClick={() => setView({ name: 'store' })}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                  style={{ fontWeight: 600 }}
                >
                  <Sparkles className="h-3 w-3" /> Quero Anunciar <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {/* CTA Plano Premium */}
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-2xl p-5 text-center">
                <div className="text-xl mb-1">👑</div>
                <h3 className="text-sm mb-1" style={{ fontWeight: 600 }}>Plano Premium</h3>
                <p className="text-xs text-blue-100 mb-3">Anúncios ilimitados, badge verificado.</p>
                <button
                  onClick={() => setView({ name: 'plans' })}
                  className="w-full bg-white text-purple-700 text-xs py-2 rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-center gap-1"
                  style={{ fontWeight: 600 }}
                >
                  Ver Planos <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {/* CTA Criar conta (se não logado) */}
              {!user && (
                <div className="bg-gradient-to-br from-primary to-blue-700 text-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5" />
                    <h3 className="text-sm" style={{ fontWeight: 600 }}>Ganhe pontos lendo!</h3>
                  </div>
                  <p className="text-xs text-white/90 mb-3 font-light">
                    Cadastre-se grátis e acumule pontos para anúncios grátis.
                  </p>
                  <button
                    onClick={() => setView({ name: 'register' })}
                    className="bg-white text-primary px-3 py-2 rounded-lg text-xs hover:bg-blue-50 w-full transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    Criar conta grátis
                  </button>
                </div>
              )}

              {/* Newsletter mini */}
              <div className="bg-white border border-zinc-100 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-zinc-900 text-sm" style={{ fontWeight: 600 }}>Receba notícias</h3>
                    <p className="text-[10px] text-zinc-500">No seu email, todo dia</p>
                  </div>
                </div>
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  const form = e.target as HTMLFormElement
                  const email = (form.elements.namedItem('email') as HTMLInputElement).value
                  if (!email) return
                  await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
                  ;(form.elements.namedItem('email') as HTMLInputElement).value = ''
                }} className="space-y-2">
                  <input name="email" type="email" placeholder="seu@email.com" className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 focus:border-primary focus:outline-none" required />
                  <button type="submit" className="w-full bg-primary text-white text-xs py-2 rounded-lg hover:bg-blue-700 transition-colors" style={{ fontWeight: 600 }}>
                    Quero Receber
                  </button>
                </form>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function SaveSearchButton({ q }: { q: string }) {
  const { user } = useAppStore()
  const { toast } = useToast()
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!user) {
      toast({ title: 'Faça login para salvar buscas', variant: 'destructive' })
      return
    }
    const res = await fetch('/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Busca: "${q}"`,
        filters: JSON.stringify({ search: q, q }),
      }),
    })
    const data = await res.json()
    if (data.error) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    } else {
      setSaved(true)
      toast({ title: 'Busca salva!', description: 'Acesse pelo seu perfil.' })
    }
  }

  if (saved) {
    return (
      <Button size="sm" variant="outline" disabled className="text-emerald-600 border-emerald-300">
        <Bookmark className="h-3.5 w-3.5 mr-1" /> Salva
      </Button>
    )
  }

  return (
    <Button size="sm" variant="outline" onClick={handleSave}>
      <Bookmark className="h-3.5 w-3.5 mr-1" /> Salvar busca
    </Button>
  )
}
