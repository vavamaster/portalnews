'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  Bell, Check, Trash2, X, Award, MessageCircle, Star, Flame, UserPlus,
  Tag, Crown, AlertCircle, Sparkles, type LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Notification {
  id: string
  type: string // LEAD | REVIEW | SYSTEM | ACHIEVEMENT | COUPON | REFERRAL | ALERT | CHECKIN
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
  LEAD: 'bg-purple-100 text-purple-600',
  REVIEW: 'bg-amber-100 text-amber-600',
  SYSTEM: 'bg-blue-100 text-blue-600',
  ACHIEVEMENT: 'bg-emerald-100 text-emerald-600',
  COUPON: 'bg-rose-100 text-rose-600',
  REFERRAL: 'bg-teal-100 text-teal-600',
  ALERT: 'bg-zinc-100 text-zinc-600',
  CHECKIN: 'bg-orange-100 text-orange-600',
}

export function NotificationsBell() {
  const { user, setView } = useAppStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  const load = async () => {
    if (!user) return
    try {
      const res = await fetch('/api/notifications?limit=15')
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {}
  }

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load()
      // poll every 30 seconds for new notifications
      const interval = setInterval(load, 30_000)
      return () => clearInterval(interval)
    }
  }, [user])

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  const markOneRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  const deleteOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  const handleNotifClick = (notif: Notification) => {
    if (!notif.isRead) markOneRead(notif.id)
    if (notif.link) {
      // link is a view name like 'profile', 'advertiser', etc
      setView({ name: notif.link as any })
    }
    setOpen(false)
  }

  if (!user) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto custom-scrollbar p-0">
        <div className="sticky top-0 bg-white border-b border-zinc-100 p-3 flex items-center justify-between">
          <div className="font-bold text-sm">Notificações</div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Check className="h-3 w-3" /> Marcar todas como lidas
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            <Bell className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
            Nenhuma notificação ainda.
          </div>
        ) : (
          <>
            {notifications.map((notif) => {
              const Icon = TYPE_ICONS[notif.type] || Bell
              return (
                <DropdownMenuItem
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={cn(
                    'p-3 cursor-pointer border-b border-zinc-50 last:border-0 focus:bg-zinc-50',
                    !notif.isRead && 'bg-amber-50/50'
                  )}
                >
                  <div className="flex items-start gap-2 w-full">
                    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', TYPE_COLORS[notif.type] || 'bg-zinc-100')}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className={cn('text-sm font-medium leading-tight', !notif.isRead && 'font-bold')}>
                          {notif.title}
                        </div>
                        <button
                          onClick={(e) => deleteOne(notif.id, e)}
                          className="text-zinc-400 hover:text-red-500 flex-shrink-0"
                          aria-label="Excluir"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="text-xs text-zinc-600 mt-0.5 line-clamp-2">{notif.message}</div>
                      <div className="text-[10px] text-zinc-400 mt-1">
                        {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(notif.createdAt))}
                      </div>
                    </div>
                    {!notif.isRead && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                  </div>
                </DropdownMenuItem>
              )
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
