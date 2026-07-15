'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppStore, viewToUrl } from '@/lib/store'
import { AdminView } from './AdminView'

const VALID_SECTIONS = new Set([
  'dashboard', 'posts', 'editor', 'ads', 'users', 'seo', 'categories', 'classifieds',
  'editors', 'review', 'quotes', 'slides', 'ai', 'gateways', 'verifications', 'home-config',
  'sponsored', 'coupons', 'wordpress', 'social', 'ai-autonews', 'whatsapp', 'header-ads', 'analytics', 'audit',
])

export function AdminShell() {
  const params = useSearchParams()
  const router = useRouter()
  const { user, view, setView, refreshUser } = useAppStore()
  const [ready, setReady] = useState(false)
  const requested = params.get('section') || 'dashboard'
  const section = (VALID_SECTIONS.has(requested) ? requested : 'dashboard') as any
  const postId = params.get('postId') || undefined

  useEffect(() => {
    refreshUser().finally(() => {
      setView({ name: 'admin', section, postId })
      setReady(true)
    })
  }, [refreshUser, section, postId, setView])

  useEffect(() => {
    if (!ready) return
    const target = viewToUrl(view)
    const current = `${window.location.pathname}${window.location.search}`
    if (target !== current) router.push(target)
  }, [ready, router, view])

  if (!ready) return <div className="min-h-screen flex items-center justify-center text-zinc-500">Validando acesso...</div>
  return <AdminView key={`${user?.id || 'anonymous'}:${section}:${postId || ''}`} section={section} postId={postId} />
}
