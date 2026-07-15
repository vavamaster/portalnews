'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/lib/store'
import { AdminDock } from './AdminDock'
import { Button } from '@/components/ui/button'
import {
  AlertCircle, ExternalLink, LayoutDashboard, Newspaper, Plus, CheckCircle,
  Megaphone, Store, TrendingUp, Layers, Cpu, Users, UserCog, Search,
  FolderTree, LogOut, CreditCard, ShieldCheck, Crown, Tag, Globe, Share2, Bot, MessageCircle, BarChart3, type LucideIcon,
} from 'lucide-react'

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
  section: 'dashboard' | 'posts' | 'editor' | 'ads' | 'users' | 'seo' | 'categories' | 'classifieds' | 'editors' | 'review' | 'quotes' | 'slides' | 'ai' | 'gateways' | 'verifications' | 'home-config' | 'sponsored' | 'coupons' | 'wordpress' | 'social' | 'ai-autonews' | 'whatsapp' | 'header-ads' | 'analytics' | 'audit'
  postId?: string
}

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Newspaper, Plus, CheckCircle, Megaphone, Store,
  TrendingUp, Layers, Cpu, Users, UserCog, Search, FolderTree, CreditCard, ShieldCheck, Crown, Tag, Globe, Share2, Bot, MessageCircle,
}

const SAFE_EDITOR_SECTIONS = ['dashboard', 'posts', 'editor']
const MASTER_ONLY_SECTIONS = ['gateways', 'ai', 'social', 'wordpress', 'audit']

export function AdminView({ section, postId }: Props) {
  const { user, setView, logout } = useAppStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editorAccess, setEditorAccess] = useState<string[] | null>(null)
  const isEditor = user?.role === 'EDITOR'

  useEffect(() => {
    if (!isEditor) return
    let cancelled = false
    fetch('/api/editor-profile/mine')
      .then(async response => response.ok ? response.json() : Promise.reject(new Error('Sem acesso')))
      .then(data => {
        if (!cancelled) {
          const configured = Array.isArray(data.profile?.panelAccess) ? data.profile.panelAccess : SAFE_EDITOR_SECTIONS
          setEditorAccess(SAFE_EDITOR_SECTIONS.filter(sectionId => configured.includes(sectionId)))
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
    || (user.role === 'ADMIN' && !MASTER_ONLY_SECTIONS.includes(section))
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
          <Button onClick={() => setView({ name: 'admin', section: editorAccess?.[0] as any || 'dashboard' })}>Abrir área permitida</Button>
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
      <AdminDock section={section} isMasterOrAdmin={isMasterOrAdmin} isMaster={isMaster} allowedSections={editorAccess || []} onNavigate={() => setSidebarOpen(false)} />
    </div>
  )
}

function AdminHeader({ section }: { section: string }) {
  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    posts: 'Gerenciar Notícias',
    editor: 'Editor de Notícia',
    ads: 'Gerenciar Anúncios',
    classifieds: 'Classificados',
    users: 'Gerenciar Usuários',
    seo: 'SEO & Configurações do Site',
    categories: 'Gerenciar Categorias',
    editors: 'Gerenciar Editores',
    review: 'Fila de Revisão',
    quotes: 'Cotações Agropecuárias',
    slides: 'Configuração de Slides',
    ai: 'Configuração de IA',
    gateways: 'Gateways de Pagamento',
    verifications: 'Verificação de CPF/CNPJ',
    'home-config': 'Configuração da Home',
    sponsored: 'Categorias Patrocinadas (Enterprise)',
    coupons: 'Cupons de Desconto',
    wordpress: 'WordPress Import',
    social: 'Redes Sociais',
    'ai-autonews': 'IA Auto-News',
    whatsapp: 'WhatsApp (Baileys)',
    'header-ads': 'Anúncios do Header',
    analytics: 'Analytics & Métricas',
    audit: 'Auditoria Administrativa',
  }
  const descriptions: Record<string, string> = {
    dashboard: 'Visão geral do portal',
    posts: 'Todas as notícias cadastradas',
    editor: 'Crie ou edite uma notícia',
    ads: 'Anúncios do portal (próprios e de leitores)',
    classifieds: 'Gerencie anúncios classificados do portal',
    users: 'Usuários master, admin, editor e leitores',
    seo: 'Configurações de SEO, OpenGraph e redes sociais',
    categories: 'Categorias e editorias do portal',
    editors: 'Configure permissões, limites e bios dos editores',
    review: 'Aprove ou rejeite notícias de editores com auto-ação',
    quotes: 'Cotações de dólar, produtos agrícolas e pecuários',
    slides: 'Configure o slideshow da home e de cada categoria',
    ai: 'Configure providers de IA (ZAI, OpenAI, Gemini, Claude, Ollama)',
    gateways: 'Configure Asaas, Mercado Pago e Stripe para cobranças reais',
    verifications: 'Aprove ou rejeite verificações de identidade (CPF/CNPJ) dos usuários',
    'home-config': 'Configure os filtros avançados de publicação da home e o sistema anti-duplicação',
    sponsored: 'Anúncios Enterprise pagos em cada categoria — modo exclusivo (landing page) ou rotativo',
    coupons: 'Crie e gerencie cupons de desconto para assinaturas e boost',
    wordpress: 'Importe matérias e imagens do seu WordPress antigo',
    social: 'Configure APIs do Facebook, Instagram, X, Telegram e WhatsApp para publicação automática',
    'ai-autonews': 'Agende geração automática de notícias por IA com notificação via WhatsApp',
    whatsapp: 'Conecte um chip via Baileys para receber notificações de publicações',
    'header-ads': 'Banners e slides publicitários isolados no topo do portal',
    analytics: 'Métricas de acesso, geolocalização, origens de tráfego e relatórios exportáveis',
    audit: 'Histórico rastreável das alterações administrativas sensíveis',
  }
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">Painel Admin</div>
        <h1 className="font-black text-2xl text-zinc-900 leading-tight tracking-tight">{titles[section] || 'Área administrativa'}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{descriptions[section] || 'Selecione uma seção válida no menu.'}</p>
      </div>
    </div>
  )
}
