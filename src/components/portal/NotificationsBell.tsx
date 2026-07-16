'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn, formatDate } from '@/lib/utils'
import {
  AlertCircle,
  Award,
  Bell,
  Check,
  Flame,
  Loader2,
  MessageCircle,
  Star,
  Tag,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string | null
  isRead: boolean
  createdAt: string
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  LEAD: MessageCircle,
  REVIEW: Star,
  SYSTEM: AlertCircle,
  ACHIEVEMENT: Award,
  COUPON: Tag,
  REFERRAL: UserPlus,
  ALERT: Bell,
  CHECKIN: Flame,
}

const TYPE_COLORS: Record<string, string> = {
  LEAD: 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-300',
  REVIEW: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
  SYSTEM: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300',
  ACHIEVEMENT: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
  COUPON: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300',
  REFERRAL: 'bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-300',
  ALERT: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  CHECKIN: 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-300',
}

export function NotificationsBell() {
  const { user, setView } = useAppStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) return

    try {
      const response = await fetch('/api/notifications?limit=15')
      if (!response.ok) return

      const data = await response.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {
      // Preserve the latest valid state when a polling request fails.
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    const initialLoad = setTimeout(() => void load(), 0)
    const interval = setInterval(load, 30_000)
    return () => {
      clearTimeout(initialLoad)
      clearInterval(interval)
    }
  }, [load, user?.id])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) void load()
  }

  const markAllRead = async () => {
    const response = await fetch('/api/notifications', { method: 'PATCH' })
    if (!response.ok) return

    setNotifications(current => current.map(notification => ({ ...notification, isRead: true })))
    setUnreadCount(0)
  }

  const markOneRead = async (id: string) => {
    const response = await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    if (!response.ok) return

    setNotifications(current => current.map(notification => (
      notification.id === id ? { ...notification, isRead: true } : notification
    )))
    setUnreadCount(current => Math.max(0, current - 1))
  }

  const deleteOne = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const notification = notifications.find(item => item.id === id)
    const response = await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    if (!response.ok) return

    setNotifications(current => current.filter(item => item.id !== id))
    if (notification && !notification.isRead) {
      setUnreadCount(current => Math.max(0, current - 1))
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) void markOneRead(notification.id)
    if (notification.link) setView({ name: notification.link as any })
    setOpen(false)
  }

  if (!user) return null

  const unreadLabel = unreadCount === 1 ? '1 não lida' : `${unreadCount} não lidas`

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
          style={{ color: 'var(--header-text)' }}
          aria-label={unreadCount > 0 ? `Notificações: ${unreadLabel}` : 'Notificações'}
          title={unreadCount > 0 ? unreadLabel : 'Notificações'}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none tabular-nums text-white"
              style={{ boxShadow: '0 0 0 2px var(--header-bg)' }}
              aria-hidden="true"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[calc(100vw-1rem)] max-w-96 overflow-hidden rounded-2xl border-zinc-200 bg-white p-0 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex min-h-16 items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notificações</div>
            <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {unreadCount > 0 ? unreadLabel : 'Tudo em dia'}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Check className="h-3.5 w-3.5" />
              Marcar como lidas
            </button>
          )}
        </div>

        {loading && notifications.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Carregando notificações
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
              <Bell className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Nenhuma notificação</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Novidades e atualizações aparecerão aqui.
            </div>
          </div>
        ) : (
          <div className="custom-scrollbar max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto overscroll-contain">
            {notifications.map(notification => {
              const Icon = TYPE_ICONS[notification.type] || Bell

              return (
                <div
                  key={notification.id}
                  className={cn(
                    'group relative border-b border-zinc-100 last:border-b-0 dark:border-zinc-800',
                    !notification.isRead && 'bg-blue-50/60 dark:bg-blue-950/20'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 pr-12 text-left transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none dark:hover:bg-zinc-900/70 dark:focus-visible:bg-zinc-900/70"
                  >
                    <span className={cn(
                      'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
                      TYPE_COLORS[notification.type] || 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span className={cn(
                          'line-clamp-2 flex-1 text-sm leading-snug text-zinc-800 dark:text-zinc-100',
                          !notification.isRead ? 'font-semibold' : 'font-medium'
                        )}>
                          {notification.title}
                        </span>
                        {!notification.isRead && (
                          <span
                            className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary"
                            aria-label="Não lida"
                          />
                        )}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {notification.message}
                      </span>
                      <span className="mt-1.5 block text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                        {formatDate(notification.createdAt, 'datetime')}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={event => void deleteOne(notification.id, event)}
                    className="absolute right-2 top-2.5 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:bg-red-50 focus-visible:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:hover:bg-red-950/40 dark:focus-visible:bg-red-950/40"
                    aria-label={`Excluir notificação: ${notification.title}`}
                    title="Excluir notificação"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
