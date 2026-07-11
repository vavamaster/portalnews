'use client'

import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { ReactionsBar } from './ReactionsBar'
import { AdBanner } from '@/components/portal/AdBanner'
import { ArticleCard } from '@/components/portal/ArticleCard'
import { ContinueReadingToast } from '@/components/portal/ContinueReadingToast'
import { Clock, Eye, User, ChevronRight, Home as HomeIcon, Play, ImageIcon, ExternalLink, Award, AlertCircle } from 'lucide-react'
import { cn, safeJsonArray } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/portal/UserAvatar'
import { SmartImage } from '@/components/ui/smart-image'

interface Props {
  slug: string
  seoSettings?: Record<string, string>
}

// Inject Article SEO: JSON-LD + OG meta tags + Twitter cards + title
// This overrides the global layout metadata with article-specific data.
function injectArticleSeo(post: any, siteName: string) {
  if (typeof document === 'undefined') return

  // === 1. JSON-LD structured data ===
  const existingJsonLd = document.getElementById('article-jsonld')
  if (existingJsonLd) existingJsonLd.remove()

  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    description: post.excerpt || post.subtitle || '',
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    url: window.location.href,
    mainEntityOfPage: { '@type': 'WebPage', '@id': window.location.href },
    author: { '@type': 'Person', name: post.author?.name || 'Redação' },
    publisher: { '@type': 'Organization', name: siteName || 'Portal' },
    inLanguage: 'pt-BR',
  }
  if (post.coverImage) jsonLd.image = post.coverImage
  if (post.category) jsonLd.articleSection = post.category.name
  if (post.tags) jsonLd.keywords = post.tags

  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.id = 'article-jsonld'
  script.textContent = JSON.stringify(jsonLd)
  document.head.appendChild(script)

  // === 2. Update <title> ===
  document.title = `${post.title} | ${siteName}`

  // === 3. Update meta tags ===
  const setMeta = (selector: string, attr: string, value: string) => {
    let el = document.head.querySelector(selector) as HTMLElement | null
    if (!el) {
      el = document.createElement('meta')
      const [k, v] = selector.match(/\[(.+?)="(.+?)"\]/)?.slice(1) || []
      if (k && v) el.setAttribute(k, v)
      document.head.appendChild(el)
    }
    el.setAttribute(attr, value)
  }

  const description = post.excerpt || post.subtitle || post.seoDescription || ''
  const ogImage = post.coverImage || post.ogImage || ''
  const ogTitle = post.seoTitle || post.title
  const ogDescription = post.seoDescription || description

  setMeta('meta[property="og:title"]', 'content', ogTitle)
  setMeta('meta[property="og:description"]', 'content', ogDescription)
  setMeta('meta[property="og:type"]', 'content', 'article')
  setMeta('meta[property="og:url"]', 'content', window.location.href)
  if (ogImage) {
    setMeta('meta[property="og:image"]', 'content', ogImage)
    setMeta('meta[property="og:image:alt"]', 'content', post.title)
  }
  setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image')
  setMeta('meta[name="twitter:title"]', 'content', ogTitle)
  setMeta('meta[name="twitter:description"]', 'content', ogDescription)
  if (ogImage) setMeta('meta[name="twitter:image"]', 'content', ogImage)
  setMeta('meta[name="description"]', 'content', description)
}

// Cleanup article SEO when navigating away — restore the original layout title.
function cleanupArticleSeo(originalTitle?: string) {
  if (typeof document === 'undefined') return
  const jsonLd = document.getElementById('article-jsonld')
  if (jsonLd) jsonLd.remove()
  document.head.querySelectorAll('meta[property^="article:"]').forEach(el => el.remove())
  if (originalTitle) document.title = originalTitle
}

export function ArticleView({ slug, seoSettings }: Props) {
  const { setView, user } = useAppStore()
  const [state, setState] = useState<{
    post: any | null
    loading: boolean
    related: any[]
    earnedPoints: number
    readTracked: boolean
  }>({ post: null, loading: true, related: [], earnedPoints: 0, readTracked: false })
  const [galleryOpen, setGalleryOpen] = useState<number | null>(null)
  const [showEarnedToast, setShowEarnedToast] = useState(false)
  const articleRef = useRef<HTMLDivElement>(null)
  const lastReadPctRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ post: null, loading: true, related: [], earnedPoints: 0, readTracked: false })
    // Capture the original layout title so we can restore it when navigating away.
    const originalTitle = typeof document !== 'undefined' ? document.title : ''
    // Resolve the SEO site name from props (preferred) or fall back to a generic value.
    const siteName = seoSettings?.site_name || 'Portal de Notícias'
    fetch(`/api/posts?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(async (data) => {
        if (cancelled) return
        if (data.post) {
          // load related
          let related: any[] = []
          try {
            const r = await fetch(`/api/posts?category=${data.post.category.slug}&limit=4`)
            const d = await r.json()
            related = (d.posts || []).filter((p: any) => p.id !== data.post.id).slice(0, 3)
          } catch {}
          if (!cancelled) {
            setState({ post: data.post, loading: false, related, earnedPoints: 0, readTracked: false })
            injectArticleSeo(data.post, siteName)
          }
        } else if (!cancelled) {
          setState(s => ({ ...s, loading: false }))
        }
      })
      .catch(() => { if (!cancelled) setState(s => ({ ...s, loading: false })) })
    return () => {
      cancelled = true
      cleanupArticleSeo(originalTitle)
    }
  }, [slug, seoSettings])

  const { post, loading, related, earnedPoints, readTracked } = state

  // Track reading progress and award points
  useEffect(() => {
    if (!post || !user || readTracked) return

    const trackReading = async (readPct: number, duration: number) => {
      try {
        const res = await fetch('/api/reading', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: post.id, readPct, duration }),
        })
        const data = await res.json()
        if (data.awarded > 0) {
          setState(s => ({ ...s, earnedPoints: s.earnedPoints + data.awarded }))
          setShowEarnedToast(true)
          setTimeout(() => setShowEarnedToast(false), 4000)
          // refresh user
          const meRes = await fetch('/api/auth/me')
          const meData = await meRes.json()
          if (meData.user) useAppStore.getState().setUser(meData.user)
        }
      } catch {}
    }

    const onScroll = () => {
      if (!articleRef.current) return
      const el = articleRef.current
      const rect = el.getBoundingClientRect()
      const winH = window.innerHeight
      const totalH = el.offsetHeight
      const startFromTop = -rect.top + winH * 0.3 // 30% from top triggers 100%
      const pct = Math.max(0, Math.min(100, Math.round((startFromTop / totalH) * 100)))

      // Only track when crossing 25% thresholds
      const milestone = Math.floor(pct / 25)
      const lastMilestone = Math.floor(lastReadPctRef.current / 25)
      if (milestone > lastMilestone) {
        trackReading(pct, 30)
        lastReadPctRef.current = pct
      } else {
        lastReadPctRef.current = pct
      }
    }

    window.addEventListener('scroll', onScroll)
    // initial check after 3 seconds (gives some duration credit)
    const initialTimer = setTimeout(() => {
      trackReading(25, 3)
      lastReadPctRef.current = 25
    }, 3000)

    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(initialTimer)
    }
  }, [post, user, readTracked])

  if (loading) {
    return (
      <div className="news-container py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-200 rounded w-3/4" />
          <div className="h-4 bg-zinc-200 rounded w-1/2" />
          <div className="h-72 bg-zinc-200 rounded" />
          <div className="h-4 bg-zinc-200 rounded" />
          <div className="h-4 bg-zinc-200 rounded w-5/6" />
          <div className="h-4 bg-zinc-200 rounded w-4/6" />
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="news-container py-16 text-center">
        <AlertCircle className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-2xl text-zinc-900 mb-2" style={{ fontWeight: 500 }}>Notícia não encontrada</h1>
        <p className="text-zinc-600 mb-6">A notícia que você procura não existe ou foi removida.</p>
        <button onClick={() => setView({ name: 'home' })} className="bg-primary text-white px-6 py-2 rounded hover:bg-blue-700">
          Voltar ao início
        </button>
      </div>
    )
  }

  const gallery: string[] = safeJsonArray<string>(post.gallery, [])
  const videos: { url: string; type: string; caption?: string }[] = safeJsonArray<any>(post.videos, [])
  const customFields: { label: string; value: string; link?: string }[] = safeJsonArray<any>(post.customFields, [])
  const date = post.publishedAt ? new Date(post.publishedAt) : new Date(post.createdAt)
  const dateStr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)

  return (
    <>
    <article className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="news-container py-3 text-sm">
        <nav className="flex items-center gap-2 text-zinc-500">
          <button onClick={() => setView({ name: 'home' })} className="hover:text-primary flex items-center gap-1">
            <HomeIcon className="h-3 w-3" /> Início
          </button>
          <ChevronRight className="h-3 w-3" />
          <button onClick={() => setView({ name: 'category', slug: post.category.slug })} className="hover:text-primary">
            {post.category.name}
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-900 line-clamp-1">{post.title}</span>
        </nav>
      </div>

      {/* Earned points toast */}
      {showEarnedToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <Award className="h-5 w-5" />
          <div>
            <div className="font-bold">+{earnedPoints} pontos!</div>
            <div className="text-xs opacity-90">Continue lendo para ganhar mais</div>
          </div>
        </div>
      )}

      <div className="news-container pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Article main */}
          <div className="lg:col-span-8" ref={articleRef}>
            {/* Category + Breaking + Sponsored */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={cn('inline-block text-xs font-bold uppercase tracking-wider px-2 py-1 rounded', `cat-${post.category.color || 'slate'}`)}>
                {post.category.name}
              </span>
              {post.breaking && (
                <span className="inline-flex items-center gap-1 bg-primary text-white text-xs font-bold uppercase tracking-wider px-2 py-1 rounded">
                  <AlertCircle className="h-3 w-3" /> Urgente
                </span>
              )}
              {post.isSponsored && (
                <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-bold uppercase tracking-wider px-2 py-1 rounded">
                  PATROCINADO
                </span>
              )}
            </div>

            {/* Sponsor info banner */}
            {post.isSponsored && post.sponsorName && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                {post.sponsorLogo && (
                  <img src={post.sponsorLogo} alt={post.sponsorName} className="h-8 w-8 rounded object-cover flex-shrink-0" />
                )}
                <div className="text-xs text-amber-800">
                  Conteúdo patrocinado por <strong>{post.sponsorName}</strong>
                  {post.sponsorUrl && (
                    <a href={post.sponsorUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-primary hover:underline">
                      Visitar site →
                    </a>
                  )}
                </div>
              </div>
            )}

            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.15] text-zinc-900 mb-3" style={{ fontWeight: 500, letterSpacing: '-0.02em' }}>
              {post.title}
            </h1>
            {post.subtitle && (
              <p className="text-lg sm:text-xl text-zinc-500 leading-relaxed mb-5 font-light">{post.subtitle}</p>
            )}

            {/* Author + meta */}
            <div className="flex items-center gap-4 py-3 border-y border-zinc-200 mb-6 text-sm">
              {post.author && (
                <button
                  onClick={() => {
                    if (post.author.editorProfile?.bioSlug && post.author.editorProfile?.showEditorName) {
                      setView({ name: 'editor-profile', slug: post.author.editorProfile.bioSlug } as any)
                    }
                  }}
                  className="flex items-center gap-2 group"
                  disabled={!post.author.editorProfile?.bioSlug || !post.author.editorProfile?.showEditorName}
                >
                <div className="flex items-center gap-2">
                  <UserAvatar name={post.author.name} avatar={post.author.avatar} size="sm" />
                  <div className="text-left">
                    <div className="font-medium text-zinc-900 group-hover:text-primary transition-colors flex items-center gap-1">
                      {post.author.name}
                      {post.author.editorProfile?.level && (
                        <span className={cn(
                          'inline-block px-1.5 py-0.5 rounded text-[10px] font-bold',
                          post.author.editorProfile.level === 'MASTER' ? 'bg-purple-100 text-purple-800'
                          : post.author.editorProfile.level === 'SENIOR' ? 'bg-amber-100 text-amber-800'
                          : post.author.editorProfile.level === 'PLENO' ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                        )}>
                          {post.author.editorProfile.level}
                        </span>
                      )}
                    </div>
                    {post.author.editorProfile?.bioTitle && (
                      <div className="text-xs text-zinc-500">{post.author.editorProfile.bioTitle}</div>
                    )}
                    {!post.author.editorProfile?.bioTitle && (
                      <div className="text-xs text-zinc-500">Redação {post.category.name}</div>
                    )}
                  </div>
                </div>
                </button>
              )}
              <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {dateStr}</span>
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {post.views} visualizações</span>
              </div>
            </div>

            {/* Cover image */}
            {post.coverImage && (
              <div className="mb-6 overflow-hidden rounded-lg">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-auto"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}

            {/* Top ad */}
            <AdBanner placement="ARTICLE_TOP" variant="full" className="mb-6" />

            {/* Article content */}
            <div className="prose-news max-w-none">
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>

            {/* Videos */}
            {videos.length > 0 && (
              <section className="my-8">
                <h3 className="font-bold text-lg text-zinc-900 mb-3 flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" /> Vídeos
                </h3>
                <div className="space-y-4">
                  {videos.map((v, i) => (
                    <div key={i} className="bg-black rounded-lg overflow-hidden">
                      <div className="aspect-video">
                        <iframe
                          src={v.url}
                          title={v.caption || `Vídeo ${i + 1}`}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      {v.caption && (
                        <div className="p-3 text-sm text-white bg-zinc-900">{v.caption}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Middle ad */}
            <AdBanner placement="ARTICLE_MIDDLE" variant="full" className="my-6" />

            {/* Gallery */}
            {gallery.length > 0 && (
              <section className="my-8">
                <h3 className="font-bold text-lg text-zinc-900 mb-3 flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" /> Galeria de Imagens ({gallery.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {gallery.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setGalleryOpen(i)}
                      className="aspect-square overflow-hidden rounded-md bg-zinc-100 group relative"
                    >
                      <SmartImage src={img} alt={`Imagem ${i + 1}`} containerClassName="w-full h-full" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Custom fields */}
            {customFields.length > 0 && (
              <section className="my-8 bg-zinc-50 border border-zinc-200 rounded-lg p-5">
                <h3 className="font-bold text-lg text-zinc-900 mb-3">Detalhes & Links</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customFields.map((f, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <dt className="text-xs uppercase tracking-wider text-zinc-500 font-medium">{f.label}</dt>
                      <dd>
                        {f.link && f.link !== '#' ? (
                          <a
                            href={f.link}
                            target={f.link.startsWith('http') ? '_blank' : undefined}
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                          >
                            {f.value}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="font-medium text-zinc-900">{f.value}</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {/* Tags */}
            {post.tags && (
              <div className="flex flex-wrap gap-2 my-6">
                {post.tags.split(',').map((tag: string) => (
                  <button
                    key={tag}
                    onClick={() => setView({ name: 'tag', tag: tag.trim() })}
                    className="px-3 py-1 text-xs bg-zinc-100 hover:bg-accent hover:text-accent-foreground rounded-full text-zinc-700 transition-colors"
                  >
                    #{tag.trim()}
                  </button>
                ))}
              </div>
            )}

            {/* Reactions & Share */}
            <ReactionsBar post={{ id: post.id, slug: post.slug, title: post.title, coverImage: post.coverImage }} />

            {/* Author bio */}
            {post.author && (
              <div
                className="mt-8 bg-zinc-50 border border-zinc-200 rounded-lg p-5 flex gap-4 cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  if (post.author.editorProfile?.bioSlug && post.author.editorProfile?.showEditorName) {
                    setView({ name: 'editor-profile', slug: post.author.editorProfile.bioSlug } as any)
                  }
                }}
              >
                <UserAvatar name={post.author.name} avatar={post.author.avatar} size="lg" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Escrito por</div>
                  <div className="font-bold text-zinc-900 text-lg flex items-center gap-2">
                    {post.author.name}
                    {post.author.editorProfile?.level && (
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded text-xs font-bold',
                        post.author.editorProfile.level === 'MASTER' ? 'bg-purple-100 text-purple-800'
                        : post.author.editorProfile.level === 'SENIOR' ? 'bg-amber-100 text-amber-800'
                        : post.author.editorProfile.level === 'PLENO' ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                      )}>
                        {post.author.editorProfile.level}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-zinc-600 mt-1">
                    {post.author.editorProfile?.bioTitle || `Redator do portal cobrindo ${post.category.name}.`}
                  </div>
                  {post.author.editorProfile?.bioSlug && post.author.editorProfile?.showEditorName && (
                    <div className="text-xs text-primary mt-2 hover:underline">Ver perfil completo →</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            <AdBanner placement="ARTICLE_SIDEBAR" variant="sidebar" />

            {/* Related */}
            {related.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-lg p-4">
                <h3 className="font-bold text-zinc-900 mb-3 pb-2 border-b border-zinc-200">Leia também</h3>
                <div className="space-y-3">
                  {related.map((p) => (
                    <ArticleCard key={p.id} post={p} variant="compact" />
                  ))}
                </div>
              </div>
            )}

            {/* Points reminder */}
            {!user && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-5">
                <Award className="h-8 w-8 text-amber-500 mb-2" />
                <h3 className="font-bold text-zinc-900 mb-1">Ganhe pontos lendo!</h3>
                <p className="text-sm text-zinc-700 mb-3">
                  Crie sua conta gratuita, leia e reaja às notícias para acumular pontos e trocar por créditos.
                </p>
                <button
                  onClick={() => setView({ name: 'register' })}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded text-sm w-full transition-colors"
                >
                  Criar conta grátis
                </button>
              </div>
            )}

            <AdBanner placement="HOME_SIDEBAR" variant="sidebar" />
          </aside>
        </div>
      </div>

      {/* Gallery lightbox */}
      {galleryOpen !== null && (
        <Dialog open={galleryOpen !== null} onOpenChange={(o) => !o && setGalleryOpen(null)}>
          <DialogContent className="max-w-4xl p-0 bg-black border-none overflow-hidden">
            <div className="relative">
              <SmartImage src={gallery[galleryOpen]} alt="" containerClassName="w-full" className="w-full h-auto max-h-[80vh] object-contain" loading="eager" />
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {galleryOpen + 1} / {gallery.length}
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white flex justify-between items-center">
                <button
                  onClick={() => setGalleryOpen((i) => i === null ? null : Math.max(0, i - 1))}
                  disabled={galleryOpen === 0}
                  className="bg-white/20 hover:bg-white/30 disabled:opacity-30 px-3 py-1 rounded text-sm"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setGalleryOpen((i) => i === null ? null : Math.min(gallery.length - 1, i + 1))}
                  disabled={galleryOpen === gallery.length - 1}
                  className="bg-white/20 hover:bg-white/30 disabled:opacity-30 px-3 py-1 rounded text-sm"
                >
                  Próxima →
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </article>
    {/* Continue reading toast — appears after 30s of reading */}
    <ContinueReadingToast slug={slug} category={state.post?.category?.slug} />
    </>
  )
}
