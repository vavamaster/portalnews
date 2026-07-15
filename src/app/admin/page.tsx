import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/session'
import { AdminShell } from '@/components/admin/AdminShell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Painel administrativo', robots: { index: false, follow: false } }

export default async function AdminPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!token) redirect('/?view=login')
  const session = await db.session.findUnique({
    where: { token },
    select: { expiresAt: true, user: { select: { role: true } } },
  })
  if (!session || session.expiresAt < new Date()) redirect('/?view=login')
  if (!['MASTER', 'ADMIN', 'EDITOR'].includes(session.user.role)) redirect('/')
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-zinc-500">Carregando painel...</div>}><AdminShell /></Suspense>
}
