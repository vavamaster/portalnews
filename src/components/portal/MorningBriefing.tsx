'use client'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn, formatDate } from '@/lib/utils'
import { Coffee, ArrowRight, Flame, Clock } from 'lucide-react'

/**
 * MorningBriefing — a warm, inviting card shown at the top of the home page
 * that greets the user and shows "today's essentials". Designed to create
 * a daily-visit habit (like picking up the morning newspaper).
 *
 * Shows:
 * - Personalized greeting based on time of day
 * - Date in long format
 * - 3 "must-read" posts (most viewed today)
 * - Quick links to sections
 */
export function MorningBriefing({ mostRead }: { mostRead: any[] }) {
  const { setView, user } = useAppStore()
  const [greeting, setGreeting] = useState('')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const hour = new Date().getHours()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(
      hour < 6 ? 'Boa madrugada'
      : hour < 12 ? 'Bom dia'
      : hour < 18 ? 'Boa tarde'
      : 'Boa noite'
    )

    // Check if dismissed today
    try {
      const lastDismissed = localStorage.getItem('briefing-dismissed-date')
      const today = new Date().toDateString()
      if (lastDismissed === today) {
        setDismissed(true)
      }
    } catch {}
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem('briefing-dismissed-date', new Date().toDateString())
    } catch {}
  }

  if (dismissed || !mostRead || mostRead.length === 0) return null

  const top3 = mostRead.slice(0, 3)
  const today = formatDate(new Date(), 'long')

  return (
    <div className="news-container pt-4">
      <div className="briefing-card rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 transition-colors"
          aria-label="Fechar"
        >
          ✕
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Coffee className="h-5 w-5 text-amber-600" />
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
            {today}
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl text-zinc-900 mb-4" style={{ fontWeight: 600 }}>
          {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
        </h2>

        <p className="text-sm text-zinc-600 mb-4">
          As notícias mais lidas de hoje:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {top3.map((post, i) => (
            <button
              key={post.id}
              onClick={() => {
                setView({ name: 'article', slug: post.slug })
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="text-left group bg-white/60 dark:bg-white/5 rounded-lg p-3 hover:bg-white transition-colors border border-white/50 dark:border-white/10"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold text-primary/30 font-numeric">{i + 1}</span>
                {post.breaking && (
                  <Flame className="h-3 w-3 text-red-500" />
                )}
              </div>
              <h3 className="text-sm text-zinc-800 line-clamp-2 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>
                {post.title}
              </h3>
              <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-1">
                <Clock className="h-2.5 w-2.5" />
                <span className="font-numeric">{post.views}</span> leituras
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setView({ name: 'home' })
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:gap-2 transition-all link-underline"
          style={{ fontWeight: 500 }}
        >
          Ver todas as notícias <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
