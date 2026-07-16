'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/lib/store'
import { AdminDock } from './AdminDock'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import {
  ADMIN_SECTION_BY_ID,
  EDITOR_PANEL_SECTIONS,
  isMasterOnlyAdminSection,
  type AdminSectionId,
} from '@/lib/admin-navigation'

const loadingPanel = () => <div className="py-12 text-center text-sm text-zinc-500">Carregando módulo...</div>
const AdminDashboard = dynamic(() => import('./AdminDashboard').then(module => module.AdminDashboard), { loading: loadingPanel })
const AdminPosts = dynamic(() => import('./AdminPosts').then(module => module.AdminPosts), { loading: loadingPanel })
const AdminEditor = dynamic(() => import('./AdminEditor').then(module => module.AdminEditor), { loading: loadingPanel })
const AdminAds = dynamic(() => import('./AdminAds').then(module => module.AdminAds), { loading: loadingPanel })
const AdminUsers = dynamic(() => import('./AdminUsers').then(module => module.AdminUsers), { loading: loadingPanel })
const AdminSeo = dynamic(() => import('./AdminSeo').then(module => module.AdminSeo), { loading: loadingPanel })
const AdminGateways = dynamic(() => import('./AdminGateways').then(module => module.AdminGateways), { loading: loadingPanel })
const AdminCategories = dynamic(() => import('./AdminCategories').then(module => module.AdminCategories), { loading: loadingPanel })
const AdminEditors = dynamic(() => import('./AdminEditors').then(module => module.AdminEditors), { loading: loadingPanel })
const AdminReview = dynamic(() => import('./AdminReview').then(module => module.AdminReview), { loading: loadingPanel })
const AdminQuotes = dynamic(() => import('./AdminQuotes').then(module => module.AdminQuotes), { loading: loadingPanel })
const AdminSlideConfig = dynamic(() => import('./AdminSlideConfig').then(module => module.AdminSlideConfig), { loading: loadingPanel })
const AdminAIConfig = dynamic(() => import('./AdminAIConfig').then(module => module.AdminAIConfig), { loading: loadingPanel })
const AdminClassifieds = dynamic(() => import('./AdminClassifieds').then(module => module.AdminClassifieds), { loading: loadingPanel })
const AdminVerifications = dynamic(() => import('./AdminVerifications').then(module => module.AdminVerifications), { loading: loadingPanel })
const AdminHomeConfig = dynamic(() => import('./AdminHomeConfig').then(module => module.AdminHomeConfig), { loading: loadingPanel })
const AdminSponsoredCategories = dynamic(() => import('./AdminSponsoredCategories').then(module => module.AdminSponsoredCategories), { loading: loadingPanel })
const AdminCoupons = dynamic(() => import('./AdminCoupons').then(module => module.AdminCoupons), { loading: loadingPanel })
const AdminWordPress = dynamic(() => import('./AdminWordPress').then(module => module.AdminWordPress), { loading: loadingPanel })
const AdminSocial = dynamic(() => import('./AdminSocial').then(module => module.AdminSocial), { loading: loadingPanel })
const AdminAINews = dynamic(() => import('./AdminAINews').then(module => module.AdminAINews), { loading: loadingPanel })
const AdminWhatsApp = dynamic(() => import('./AdminWhatsApp').then(module => module.AdminWhatsApp), { loading: loadingPanel })
const AdminHeaderAds = dynamic(() => import('./AdminHeaderAds').then(module => module.AdminHeaderAds), { loading: loadingPanel })
const AdminAnalytics = dynamic(() => import('./AdminAnalytics').then(module => module.AdminAnalytics), { loading: loadingPanel })
const AdminAudit = dynamic(() => import('./AdminAudit').then(module => module.AdminAudit), { loading: loadingPanel })

interface Props {
  section: AdminSectionId
  postId?: string
}

export function AdminView({ section, postId }: Props) {
  const { user, setView } = useAppStore()
  const [editorAccess, setEditorAccess] = useState<AdminSectionId[] | null>(null)
  const isEditor = user?.role === 'EDITOR'

  useEffect(() => {
    if (!isEditor) return
    let cancelled = false
    fetch('/api/editor-profile/mine')
      .then(async response => response.ok ? response.json() : Promise.reject(new Error('Sem acesso')))
      .then(data => {
        if (!cancelled) {
          const configured = Array.isArray(data.profile?.panelAccess) ? data.profile.panelAccess : EDITOR_PANEL_SECTIONS
          setEditorAccess(EDITOR_PANEL_SECTIONS.filter(sectionId => configured.includes(sectionId)))
        }
      })
      .catch(() => { if (!cancelled) setEditorAccess([]) })
    return () => { cancelled = true }
  }, [isEditor, user?.id])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Acesso restrito</h1>
          <p className="text-zinc-600 mb-6">Faça login como administrador para acessar o painel.</p>
          <Button onClick={() => setView({ name: 'login' })} className="bg-primary">Entrar</Button>
        </div>
      </div>
    )
  }

  if (!['MASTER', 'ADMIN', 'EDITOR'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Permissão negada</h1>
          <p className="text-zinc-600 mb-6">Você não tem permissão para acessar o painel administrativo.</p>
          <Button onClick={() => setView({ name: 'home' })} className="bg-primary">Voltar ao início</Button>
        </div>
      </div>
    )
  }

  const isMasterOrAdmin = ['MASTER', 'ADMIN'].includes(user.role)
  const isMaster = user.role === 'MASTER'
  const hasSectionAccess = isMaster
    || (user.role === 'ADMIN' && !isMasterOnlyAdminSection(section))
    || !!editorAccess?.includes(section)

  if (isEditor && editorAccess === null) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-500">Carregando permissões...</div>
  }

  if (!hasSectionAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center max-w-md px-4">
          <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Seção não autorizada</h1>
          <p className="text-zinc-600 mb-6">Seu perfil não possui acesso a esta área administrativa.</p>
          <Button onClick={() => setView({ name: 'admin', section: editorAccess?.[0] || 'dashboard' })}>Abrir área permitida</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar removed — bottom dock handles branding + navigation */}

      <div className="max-w-7xl mx-auto py-4 px-4 pb-20 transition-all">
        {/* Main content — full width, with bottom padding for the bottom dock */}
        <main>
          <AdminHeader section={section} />
          <div className="mt-4">
            {section === 'dashboard' && hasSectionAccess && <AdminDashboard />}
            {section === 'posts' && hasSectionAccess && <AdminPosts />}
            {section === 'editor' && hasSectionAccess && <AdminEditor postId={postId} />}
            {section === 'ads' && isMasterOrAdmin && <AdminAds />}
            {section === 'users' && isMasterOrAdmin && <AdminUsers />}
            {section === 'seo' && isMasterOrAdmin && <AdminSeo />}
            {section === 'categories' && isMasterOrAdmin && <AdminCategories />}
            {section === 'classifieds' && isMasterOrAdmin && (
              <AdminClassifieds />
            )}
            {section === 'editors' && isMasterOrAdmin && <AdminEditors />}
            {section === 'review' && isMasterOrAdmin && <AdminReview />}
            {section === 'quotes' && isMasterOrAdmin && <AdminQuotes />}
            {section === 'slides' && isMasterOrAdmin && <AdminSlideConfig />}
            {section === 'ai' && isMasterOrAdmin && <AdminAIConfig />}
            {section === 'gateways' && isMasterOrAdmin && <AdminGateways />}
            {section === 'verifications' && isMasterOrAdmin && <AdminVerifications />}
            {section === 'home-config' && isMasterOrAdmin && <AdminHomeConfig />}
            {section === 'sponsored' && isMasterOrAdmin && <AdminSponsoredCategories />}
            {section === 'coupons' && isMasterOrAdmin && <AdminCoupons />}
            {section === 'wordpress' && isMasterOrAdmin && <AdminWordPress />}
            {section === 'social' && isMasterOrAdmin && <AdminSocial />}
            {section === 'ai-autonews' && isMasterOrAdmin && <AdminAINews />}
            {section === 'whatsapp' && isMasterOrAdmin && <AdminWhatsApp />}
            {section === 'header-ads' && isMasterOrAdmin && <AdminHeaderAds />}
            {section === 'analytics' && isMasterOrAdmin && <AdminAnalytics />}
            {section === 'audit' && isMaster && <AdminAudit />}
          </div>
        </main>
      </div>

      {/* === Bottom Dock Navigation === */}
      <AdminDock section={section} isMasterOrAdmin={isMasterOrAdmin} isMaster={isMaster} allowedSections={editorAccess || []} />
    </div>
  )
}

function AdminHeader({ section }: { section: AdminSectionId }) {
  const item = ADMIN_SECTION_BY_ID[section]
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">Painel Admin</div>
        <h1 className="font-black text-2xl text-zinc-900 leading-tight tracking-tight">{item.title}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{item.description}</p>
      </div>
    </div>
  )
}
