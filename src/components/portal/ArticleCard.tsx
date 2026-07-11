'use client'

import { useAppStore } from '@/lib/store'
import { Clock, Eye, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SmartImage } from '@/components/ui/smart-image'

interface ArticleCardProps {
  post: any
  variant?: 'hero' | 'featured' | 'standard' | 'compact' | 'list' | 'minimal'
  showCategory?: boolean
  showExcerpt?: boolean
  className?: string
}

export function ArticleCard({ post, variant = 'standard', showCategory = true, showExcerpt = false, className }: ArticleCardProps) {
  const { setView } = useAppStore()
  const open = () => {
    setView({ name: 'article', slug: post.slug })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const date = post.publishedAt ? new Date(post.publishedAt) : new Date(post.createdAt)
  const dateStr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
  const cat = post.category

  if (variant === 'hero') {
    return (
      <article
        onClick={open}
        className={cn('relative cursor-pointer group overflow-hidden rounded-2xl bg-zinc-900 hover-lift', className)}
      >
        <div className="aspect-[16/10] sm:aspect-[16/9] overflow-hidden">
          <SmartImage
            src={post.coverImage}
            alt={post.title}
            containerClassName="w-full h-full"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7 lg:p-9">
          <div className="flex items-center gap-2 mb-3">
            {showCategory && cat && (
              <div className={cn('inline-block text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full', `cat-${cat.color || 'slate'}`)}>
                {cat.name}
              </div>
            )}
            {post.breaking && (
              <div className="inline-flex items-center gap-1 bg-primary text-white text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full">
                <Flame className="h-3 w-3" /> Urgente
              </div>
            )}
          </div>
          <h2 className="text-white text-2xl sm:text-3xl lg:text-[2.5rem] leading-tight line-clamp-3 group-hover:text-blue-100 transition-colors" style={{ fontWeight: 600 }}>
            {post.title}
          </h2>
          {post.subtitle && (
            <p className="text-zinc-300 mt-2 line-clamp-2 text-sm sm:text-base font-light">{post.subtitle}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-xs text-zinc-400 font-light">
            <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {dateStr}</span>
            <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {post.views}</span>
            {post.author && <span className="font-light">por <span className="text-zinc-200">{post.author.name}</span></span>}
          </div>
        </div>
      </article>
    )
  }

  if (variant === 'featured') {
    return (
      <article onClick={open} className={cn('cursor-pointer group hover-lift', className)}>
        <div className="aspect-[16/10] overflow-hidden rounded-xl bg-zinc-100 mb-4">
          <SmartImage
            src={post.coverImage}
            alt={post.title}
            containerClassName="w-full h-full"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="eager"
          />
        </div>
        {showCategory && cat && (
          <div className={cn('inline-block text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full mb-2', `cat-${cat.color || 'slate'}`)}>
            {cat.name}
          </div>
        )}
        <h3 className="text-zinc-900 text-lg leading-snug line-clamp-3 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>
          {post.title}
        </h3>
        {showExcerpt && post.excerpt && (
          <p className="text-sm text-zinc-500 mt-2 line-clamp-2 font-light">{post.excerpt}</p>
        )}
        <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400 font-light">
          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {dateStr}</span>
          <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {post.views}</span>
        </div>
      </article>
    )
  }

  if (variant === 'compact') {
    return (
      <article onClick={open} className={cn('flex gap-3 cursor-pointer group', className)}>
        <div className="w-24 h-20 sm:w-28 sm:h-24 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-100">
          <SmartImage
            src={post.coverImage}
            alt={post.title}
            containerClassName="w-full h-full"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="eager"
          />
        </div>
        <div className="flex-1 min-w-0 py-1">
          {showCategory && cat && (
            <div className={cn('inline-block text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5', `cat-${cat.color || 'slate'}`)}>
              {cat.name}
            </div>
          )}
          <h3 className="text-zinc-900 text-sm leading-snug line-clamp-3 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>
            {post.title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400 font-light">
            <span>{dateStr}</span>
            <span className="text-zinc-300">·</span>
            <span>{post.views} views</span>
          </div>
        </div>
      </article>
    )
  }

  if (variant === 'list') {
    return (
      <article onClick={open} className={cn('flex flex-col sm:flex-row gap-5 cursor-pointer group pb-7 border-b border-zinc-100', className)}>
        <div className="w-full sm:w-64 aspect-[16/10] flex-shrink-0 overflow-hidden rounded-xl bg-zinc-100">
          <SmartImage
            src={post.coverImage}
            alt={post.title}
            containerClassName="w-full h-full"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
        <div className="flex-1 min-w-0">
          {showCategory && cat && (
            <div className={cn('inline-block text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full mb-3', `cat-${cat.color || 'slate'}`)}>
              {cat.name}
            </div>
          )}
          <h3 className="text-zinc-900 text-xl sm:text-2xl leading-tight line-clamp-2 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>
            {post.title}
          </h3>
          {post.subtitle && (
            <p className="text-zinc-600 mt-2 line-clamp-1 font-light">{post.subtitle}</p>
          )}
          {showExcerpt && post.excerpt && (
            <p className="text-sm text-zinc-500 mt-3 line-clamp-2 font-light">{post.excerpt}</p>
          )}
          <div className="flex items-center gap-3 mt-4 text-xs text-zinc-400 font-light">
            {post.author && <span>{post.author.name}</span>}
            <span className="text-zinc-300">·</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {dateStr}</span>
            <span className="text-zinc-300">·</span>
            <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {post.views}</span>
          </div>
        </div>
      </article>
    )
  }

  if (variant === 'minimal') {
    return (
      <article onClick={open} className={cn('cursor-pointer group', className)}>
        {showCategory && cat && (
          <div className={cn('inline-block text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full mb-2', `cat-${cat.color || 'slate'}`)}>
            {cat.name}
          </div>
        )}
        <h3 className="text-zinc-900 leading-snug line-clamp-3 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>
          {post.title}
        </h3>
        <div className="text-xs text-zinc-400 mt-2 font-light">{dateStr}</div>
      </article>
    )
  }

  // standard
  return (
    <article onClick={open} className={cn('cursor-pointer group hover-lift bg-white rounded-xl overflow-hidden border border-zinc-100', className)}>
      <div className="aspect-[16/10] overflow-hidden bg-zinc-100">
        <SmartImage
          src={post.coverImage}
          alt={post.title}
          containerClassName="w-full h-full"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-4 sm:p-5">
        {showCategory && cat && (
          <div className={cn('inline-block text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full mb-2.5', `cat-${cat.color || 'slate'}`)}>
            {cat.name}
          </div>
        )}
        <h3 className="text-zinc-900 text-base sm:text-lg leading-snug line-clamp-3 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>
          {post.title}
        </h3>
        {showExcerpt && post.excerpt && (
          <p className="text-sm text-zinc-500 mt-2 line-clamp-2 font-light">{post.excerpt}</p>
        )}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-zinc-50 text-xs text-zinc-400 font-light">
          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {dateStr}</span>
          <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {post.views}</span>
        </div>
      </div>
    </article>
  )
}
