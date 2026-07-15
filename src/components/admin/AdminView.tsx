'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { AdminDashboard } from './AdminDashboard'
import { AdminPosts } from './AdminPosts'
import { AdminEditor } from './AdminEditor'
import { AdminAds } from './AdminAds'
import { AdminUsers } from './AdminUsers'
import { AdminSeo } from './AdminSeo'
import { AdminGateways } from './AdminGateways'
import { AdminCategories } from './AdminCategories'
import { AdminEditors } from './AdminEditors'
import { AdminReview } from './AdminReview'
import { AdminQuotes } from './AdminQuotes'
import { AdminSlideConfig } from './AdminSlideConfig'
import { AdminAIConfig } from './AdminAIConfig'
import { AdminClassifieds } from './AdminClassifieds'
import { AdminVerifications } from './AdminVerifications'
import { AdminHomeConfig } from './AdminHomeConfig'
import { AdminSponsoredCategories } from './AdminSponsoredCategories'
import { AdminCoupons } from './AdminCoupons'
import { AdminWordPress } from './AdminWordPress'
import { AdminSocial } from './AdminSocial'
import { AdminAINews } from './AdminAINews'
import { AdminWhatsApp } from './AdminWhatsApp'
import { AdminHeaderAds } from './AdminHeaderAds'
import { AdminAnalytics } from './AdminAnalytics'
import { AdminDock } from './AdminDock'
import { Button } from '@/components/ui/button'
import {
  AlertCircle, ExternalLink, LayoutDashboard, Newspaper, Plus, CheckCircle,
  Megaphone, Store, TrendingUp, Layers, Cpu, Users, UserCog, Search,
  FolderTree, LogOut, CreditCard, ShieldCheck, Crown, Tag, Globe, Share2, Bot, MessageCircle, BarChart3, type LucideIcon,
} from 'lucide-react'

interface Props {
  section: 'dashboard' | 'posts' | 'editor' | 'ads' | 'users' | 'seo' | 'categories' | 'classifieds' | 'editors' | 'review' | 'quotes' | 'slides' | 'ai' | 'gateways' | 'verifications' | 'home-config' | 'sponsored' | 'coupons' | 'wordpress' | 'social' | 'ai-autonews' | 'whatsapp' | 'header-ads' | 'analytics'
  postId?: string
}

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Newspaper, Plus, CheckCircle, Megaphone, Store,
  TrendingUp, Layers, Cpu, Users, UserCog, Search, FolderTree, CreditCard, ShieldCheck, Crown, Tag, Globe, Share2, Bot, MessageCircle,
}

export function AdminView({ section, postId }: Props) {
  const { user, setView, logout } = useAppStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar removed — bottom dock handles branding + navigation */}

      <div className="max-w-7xl mx-auto py-4 px-4 pb-20 transition-all">
        {/* Main content — full width, with bottom padding for the bottom dock */}
        <main>
          <AdminHeader section={section} />
          <div className="mt-4">
            {section === 'dashboard' && <AdminDashboard />}
            {section === 'posts' && <AdminPosts />}
            {section === 'editor' && <AdminEditor postId={postId} />}
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
          </div>
        </main>
      </div>

      {/* === Bottom Dock Navigation === */}
      <AdminDock section={section} isMasterOrAdmin={isMasterOrAdmin} onNavigate={() => setSidebarOpen(false)} />
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
  }
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">Painel Admin</div>
        <h1 className="font-black text-2xl text-zinc-900 leading-tight tracking-tight">{titles[section]}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{descriptions[section]}</p>
      </div>
    </div>
  )
}
