'use client'
import { useEffect, useState, Fragment, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { ArticleCard } from './ArticleCard'
import { AdBanner } from './AdBanner'
import { HeroSlideshow } from './HeroSlideshow'
import { WhatsAppSubscribeWidget } from './WhatsAppSubscribeWidget'
import { ScrollFadeIn } from '@/lib/use-scroll-animation'
import { cn, getColorClasses } from '@/lib/utils'
import { Eye, ArrowRight, Sparkles, Flame, Newspaper, ChevronRight, Megaphone, Mail, CheckCircle2 } from 'lucide-react'

interface HomeData {
  slide: { config: any; posts: any[] }
  hero: any | null
  subHero: any[]
  latest: any[]
  mostRead: any[]
  byCategory: Record<string, any[]>
  categories: Array<{ id: string; slug: string; name: string; color: string; description?: string }>
}

export function HomeView({ categories: propCategories }: { categories: any[] }) {
  const { setView, user } = useAppStore()
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/home')
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) console.error('Home load error:', e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Sophisticated loading skeletons that mimic the real layout
  if (loading) return <HomeSkeleton />

  if (!data) return (
    <div className="news-container py-12 text-center text-zinc-500">
      Erro ao carregar notícias. <button onClick={() => window.location.reload()} className="text-primary underline">Recarregar</button>
    </div>
  )

  const { slide, hero: heroPost, subHero: subHeroPosts, latest, mostRead, byCategory } = data
  const categories = data.categories?.length ? data.categories : propCategories

  // Variant pattern for category blocks — creates visual rhythm
  const variantPatterns = ['standard', 'featured', 'compact', 'list'] as const

  return (
    <div className="animate-fade-in">
      {/* === SLIDE BANNER NO TOPO === */}
      {slide?.posts && slide.posts.length > 0 && (
        <div className="news-container pt-4">
          <HeroSlideshow config={slide.config} posts={slide.posts} />
        </div>
      )}

      {/* === HERO + 4 SUB-HERO (magazine layout) === */}
      {heroPost && (
        <section className="news-container py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
            <div className="lg:col-span-2">
              <ArticleCard post={heroPost} variant="hero" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {subHeroPosts.slice(0, 4).map(p => (
                <ArticleCard key={p.id} post={p} variant="compact" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* === AD HOME_MIDDLE === */}
      <section className="news-container pb-2">
        <AdBanner placement="HOME_MIDDLE" variant="full" />
      </section>

      {/* === ÚLTIMAS NOTÍCIAS + SIDEBAR STICKY (consolidado) === */}
      <section className="news-container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna principal (2/3) */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6 pb-3 border-b-2 border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary text-white flex items-center justify-center">
                  <Newspaper className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-zinc-900 dark:text-zinc-100 text-xl sm:text-2xl" style={{ fontWeight: 600 }}>Últimas Notícias</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Atualizado em tempo real</p>
                </div>
              </div>
              <button
                onClick={() => setView({ name: 'home' })}
                className="hidden sm:flex items-center gap-1 text-xs text-primary hover:opacity-80 transition-opacity"
                style={{ fontWeight: 500 }}
              >
                Ver arquivo <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {latest.slice(0, 8).map((p, i) => (
                <Fragment key={p.id}>
                  <ArticleCard post={p} variant="standard" showExcerpt />
                  {(i + 1) % 4 === 0 && i < 7 && (
                    <div className="sm:col-span-2">
                      <AdBanner placement="HOME_INFEED" variant="full" />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          {/* === SIDEBAR STICKY (1/3) — consolidado de 6 → 3 cards === */}
          <aside className="lg:col-span-1">
            <div className="sticky top-32 space-y-5">
              {/* 1. Mais Lidas */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="h-5 w-1 rounded-full bg-primary" />
                  <h3 className="text-zinc-900 dark:text-zinc-100 text-base" style={{ fontWeight: 600 }}>Mais Lidas</h3>
                  <Flame className="h-4 w-4 text-orange-500 ml-auto" />
                </div>
                <div className="space-y-3">
                  {mostRead.slice(0, 5).map((p, i) => (
                    <div
                      key={p.id}
                      className="flex gap-3 items-start group cursor-pointer"
                      onClick={() => { setView({ name: 'article', slug: p.slug }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    >
                      <div className="text-2xl text-zinc-200 dark:text-zinc-700 leading-none w-8 group-hover:text-primary transition-colors font-numeric flex-shrink-0" style={{ fontWeight: 300 }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-zinc-900 dark:text-zinc-100 text-xs leading-snug line-clamp-3 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>
                          {p.title}
                        </h4>
                        <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5">
                          <span>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(p.publishedAt || p.createdAt))}</span>
                          <span>·</span>
                          <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" /> {p.views}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. WhatsApp subscribe widget */}
              <WhatsAppSubscribeWidget variant="compact" />

              {/* 3. Ad Sidebar */}
              <AdBanner placement="HOME_SIDEBAR" variant="sidebar" />

              {/* 4. CTA Consolidado (Anuncie + Premium + Pontos) */}
              <div className="bg-gradient-to-br from-primary to-blue-700 text-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Megaphone className="h-5 w-5" />
                  <h3 className="text-base" style={{ fontWeight: 600 }}>Anuncie no Portal</h3>
                </div>
                <p className="text-xs text-white/90 mb-3 font-light">
                  {user
                    ? 'Use seus créditos para anúncios grátis ou faça upgrade para Premium.'
                    : 'Cadastre-se grátis, acumule pontos lendo e anuncie. Ou assine o Premium para anúncios ilimitados.'}
                </p>
                <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
                  <div className="bg-white/10 rounded p-1.5">
                    <div className="text-amber-300 text-xs font-numeric" style={{ fontWeight: 700 }}>+10</div>
                    <div className="text-[8px] text-blue-100">por notícia</div>
                  </div>
                  <div className="bg-white/10 rounded p-1.5">
                    <div className="text-amber-300 text-xs font-numeric" style={{ fontWeight: 700 }}>+5</div>
                    <div className="text-[8px] text-blue-100">por reação</div>
                  </div>
                  <div className="bg-white/10 rounded p-1.5">
                    <div className="text-amber-300 text-xs font-numeric" style={{ fontWeight: 700 }}>+30</div>
                    <div className="text-[8px] text-blue-100">check-in</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {!user && (
                    <button
                      onClick={() => setView({ name: 'register' })}
                      className="bg-white text-primary px-3 py-2 rounded-lg text-xs hover:bg-blue-50 w-full transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      <Sparkles className="h-3 w-3 inline mr-1" /> Criar conta grátis
                    </button>
                  )}
                  <button
                    onClick={() => setView({ name: 'plans' })}
                    className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-xs w-full transition-colors flex items-center justify-center gap-1"
                    style={{ fontWeight: 600 }}
                  >
                    Ver Planos <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* 5. Newsletter mini */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-zinc-900 dark:text-zinc-100 text-sm" style={{ fontWeight: 600 }}>Receba notícias</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">No seu email, todo dia</p>
                  </div>
                </div>
                {newsletterSubmitted ? (
                  <div className="text-center py-3 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400 rounded-lg flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Inscrição confirmada!
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault()
                    const form = e.target as HTMLFormElement
                    const email = (form.elements.namedItem('email') as HTMLInputElement).value
                    if (!email) return
                    try {
                      await fetch('/api/newsletter', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, source: 'home_sidebar' }),
                      })
                      setNewsletterSubmitted(true)
                      ;(form.elements.namedItem('email') as HTMLInputElement).value = ''
                    } catch {}
                  }} className="space-y-2">
                    <input name="email" type="email" placeholder="seu@email.com" className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:border-primary focus:outline-none" required />
                    <button type="submit" className="w-full bg-primary text-white text-xs py-2 rounded-lg hover:opacity-90 transition-opacity" style={{ fontWeight: 600 }}>
                      Quero Receber
                    </button>
                  </form>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* === BLOCOS POR CATEGORIA (com variants variados para ritmo visual) === */}
      {categories.slice(0, 6).map((cat, idx) => {
        const posts = byCategory[cat.slug] || []
        if (posts.length === 0) return null
        const variant = variantPatterns[idx % variantPatterns.length]
        const catColors = getColorClasses(cat.color)

        return (
          <ScrollFadeIn key={cat.id} className="news-container pb-12">
          <section className="pb-0">
            <div className="flex items-center justify-between mb-6 pb-3 border-b-2 border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center text-white', catColors.bgMedium)}>
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-zinc-900 dark:text-zinc-100 text-xl sm:text-2xl" style={{ fontWeight: 600 }}>{cat.name}</h2>
                  {cat.description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{cat.description}</p>}
                </div>
              </div>
              <button
                onClick={() => setView({ name: 'category', slug: cat.slug })}
                className="flex items-center gap-1 text-xs sm:text-sm text-primary hover:opacity-80 transition-opacity flex-shrink-0"
                style={{ fontWeight: 500 }}
              >
                Ver mais <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* Variant layouts — creates visual rhythm */}
            {variant === 'featured' && posts[0] && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ArticleCard post={posts[0]} variant="featured" showExcerpt />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {posts.slice(1, 5).map(p => (
                    <ArticleCard key={p.id} post={p} variant="compact" />
                  ))}
                </div>
              </div>
            )}

            {variant === 'compact' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {posts.slice(0, 4).map((p, i) => (
                  <Fragment key={p.id}>
                    <ArticleCard post={p} variant="compact" />
                    {i === 1 && <AdBanner placement="HOME_INFEED" variant="full" />}
                  </Fragment>
                ))}
              </div>
            )}

            {variant === 'list' && (
              <div className="space-y-4">
                {posts.slice(0, 5).map((p, i) => (
                  <ArticleCard key={p.id} post={p} variant="list" />
                ))}
              </div>
            )}

            {variant === 'standard' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {posts.slice(0, 4).map((p, i) => (
                  <Fragment key={p.id}>
                    <ArticleCard post={p} variant="standard" />
                    {i === 1 && <AdBanner placement="HOME_INFEED" variant="full" />}
                  </Fragment>
                ))}
              </div>
            )}

            {(idx === 1 || idx === 3) && (
              <div className="mt-6">
                <AdBanner placement="HOME_MIDDLE" variant="full" />
              </div>
            )}
          </section>
          </ScrollFadeIn>
        )
      })}

      {/* === CTA FINAL ÚNICO (consolidado de 2 → 1) === */}
      <ScrollFadeIn className="news-container pb-12">
      <section className="pb-0">
        <div className="bg-gradient-to-br from-primary to-blue-700 text-white rounded-2xl p-6 sm:p-8 text-center">
          <Megaphone className="h-8 w-8 mx-auto mb-3" />
          <h3 className="text-lg sm:text-xl mb-2" style={{ fontWeight: 600 }}>Faça seu anúncio no portal</h3>
          <p className="text-sm text-white/90 mb-4 max-w-md mx-auto">
            Profissionais liberais e empresas: alcance milhares de leitores com anúncios grátis (via créditos) ou planos Premium a partir de R$ 29/mês.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setView({ name: 'store' })}
              className="bg-white text-primary px-5 py-2.5 rounded-lg text-sm hover:bg-blue-50 transition-colors"
              style={{ fontWeight: 600 }}
            >
              Anunciar Grátis
            </button>
            <button
              onClick={() => setView({ name: 'plans' })}
              className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg text-sm transition-colors"
              style={{ fontWeight: 600 }}
            >
              Ver Planos Premium
            </button>
          </div>
        </div>
      </section>
      </ScrollFadeIn>
    </div>
  )
}

// ============================================================
// Sophisticated loading skeleton that mimics the real layout
// ============================================================
function HomeSkeleton() {
  return (
    <div className="news-container py-4 animate-pulse">
      {/* Hero skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        <div className="lg:col-span-2">
          <div className="aspect-[16/9] bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-3">
              <div className="h-16 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section header skeleton */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b-2 border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          <div className="space-y-1">
            <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-32" />
            <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-24" />
          </div>
        </div>
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-3">
              <div className="aspect-video bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
              <div className="flex gap-2">
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-16" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-12" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-5">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5">
            <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-24 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex gap-3">
                  <div className="h-6 w-6 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
                    <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
