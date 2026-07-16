'use client'

import { useState } from 'react'
import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  name: string
  avatar?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showStatus?: boolean
  fallback?: 'initials' | 'icon'
}

const SIZE_MAP = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-base',
  xl: 'h-24 w-24 text-xl',
}

// Generate a deterministic color from name
function getColorFromName(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
    'bg-purple-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// Generate initials from name
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function UserAvatar({ name, avatar, size = 'md', className, showStatus, fallback = 'initials' }: Props) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null)
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md
  const bgClass = getColorFromName(name)
  const initials = getInitials(name)

  const avatarUrl = avatar?.trim() || ''
  const hasAvatar = avatarUrl !== '' && avatarUrl !== 'null' && avatarUrl !== 'undefined'
  const showImage = hasAvatar && failedAvatar !== avatarUrl

  return (
    <div className={cn('relative inline-block flex-shrink-0', className)}>
      {showImage ? (
        <img
          src={avatarUrl}
          alt={name}
          className={cn('rounded-full object-cover ring-1 ring-zinc-200', sizeClass)}
          onError={() => setFailedAvatar(avatarUrl)}
        />
      ) : (
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-medium ring-1 ring-inset',
            sizeClass,
            fallback === 'icon'
              ? 'bg-zinc-100 text-zinc-500 ring-zinc-200'
              : cn(bgClass, 'text-white ring-black/5'),
          )}
          role="img"
          aria-label={`Avatar de ${name}`}
        >
          {fallback === 'icon' ? <UserRound className="h-1/2 w-1/2" /> : initials}
        </div>
      )}
      {showStatus && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 border-2 border-white rounded-full" />
      )}
    </div>
  )
}
