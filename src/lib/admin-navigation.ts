export type AdminGroupColor = 'blue' | 'amber' | 'purple' | 'zinc'

export interface AdminNavigationItem {
  id: string
  label: string
  title: string
  description: string
  hint: string
  icon: string
  keywords: readonly string[]
  masterOnly?: boolean
}

export interface AdminNavigationGroup {
  id: string
  label: string
  color: AdminGroupColor
  icon: string
  items: readonly AdminNavigationItem[]
}

export const ADMIN_NAVIGATION_GROUPS = [
  {
    id: 'content', label: 'Conteúdo', color: 'blue', icon: 'Newspaper',
    items: [
      { id: 'dashboard', label: 'Dashboard', title: 'Dashboard', description: 'Visão geral do portal', hint: 'Visão geral', icon: 'LayoutDashboard', keywords: ['início', 'resumo', 'indicadores'] },
      { id: 'posts', label: 'Notícias', title: 'Gerenciar Notícias', description: 'Todas as notícias cadastradas', hint: 'Gerenciar matérias', icon: 'Newspaper', keywords: ['posts', 'matérias', 'conteúdo'] },
      { id: 'editor', label: 'Nova Notícia', title: 'Editor de Notícia', description: 'Crie ou edite uma notícia', hint: 'Criar matéria', icon: 'Plus', keywords: ['escrever', 'publicar', 'post'] },
      { id: 'review', label: 'Revisão', title: 'Fila de Revisão', description: 'Aprove ou rejeite notícias de editores com auto-ação', hint: 'Fila de aprovação', icon: 'CheckCircle', keywords: ['aprovação', 'pendências', 'moderação'] },
      { id: 'home-config', label: 'Home Layout', title: 'Configuração da Home', description: 'Configure os filtros de publicação da home e o sistema anti-duplicação', hint: 'Configurar home', icon: 'LayoutDashboard', keywords: ['capa', 'layout', 'destaques'] },
    ],
  },
  {
    id: 'monetization', label: 'Monetização', color: 'amber', icon: 'Megaphone',
    items: [
      { id: 'ads', label: 'Anúncios', title: 'Gerenciar Anúncios', description: 'Anúncios do portal, próprios e de leitores', hint: 'Anúncios do portal', icon: 'Megaphone', keywords: ['publicidade', 'banners', 'campanhas'] },
      { id: 'sponsored', label: 'Patrocinadas', title: 'Categorias Patrocinadas (Enterprise)', description: 'Anúncios Enterprise pagos por categoria, exclusivos ou rotativos', hint: 'Categorias Enterprise', icon: 'Crown', keywords: ['enterprise', 'categorias', 'landing page'] },
      { id: 'coupons', label: 'Cupons', title: 'Cupons de Desconto', description: 'Crie e gerencie cupons para assinaturas e impulsionamentos', hint: 'Cupons de desconto', icon: 'Tag', keywords: ['promoção', 'desconto', 'assinatura'] },
      { id: 'classifieds', label: 'Classificados', title: 'Classificados', description: 'Gerencie anúncios classificados do portal', hint: 'Anúncios classificados', icon: 'Store', keywords: ['loja', 'vendas', 'listagens'] },
      { id: 'gateways', label: 'Pagamentos', title: 'Gateways de Pagamento', description: 'Configure Asaas, Mercado Pago e Stripe para cobranças reais', hint: 'Gateways', icon: 'CreditCard', keywords: ['asaas', 'stripe', 'mercado pago'], masterOnly: true },
    ],
  },
  {
    id: 'integrations', label: 'Integrações', color: 'purple', icon: 'Globe',
    items: [
      { id: 'wordpress', label: 'WordPress', title: 'WordPress Import', description: 'Importe matérias e imagens do seu WordPress antigo', hint: 'Importar matérias', icon: 'Globe', keywords: ['importação', 'site antigo'], masterOnly: true },
      { id: 'social', label: 'Redes Sociais', title: 'Redes Sociais', description: 'Configure login social e publicação automática', hint: 'OAuth e publicação', icon: 'Share2', keywords: ['google', 'login', 'oauth', 'facebook', 'instagram', 'telegram', 'x'], masterOnly: true },
      { id: 'ai-autonews', label: 'IA Auto-News', title: 'IA Auto-News', description: 'Agende geração automática de notícias por IA', hint: 'Geração automática', icon: 'Bot', keywords: ['automação', 'inteligência artificial', 'notícias'] },
      { id: 'whatsapp', label: 'WhatsApp', title: 'WhatsApp (Baileys)', description: 'Conecte um chip para notificações e campanhas', hint: 'Baileys e notificações', icon: 'MessageCircle', keywords: ['mensagens', 'campanhas', 'chip'] },
      { id: 'header-ads', label: 'Anúncios Header', title: 'Anúncios do Header', description: 'Banners e slides publicitários isolados no topo do portal', hint: 'Banners no topo', icon: 'Megaphone', keywords: ['cabeçalho', 'banner', 'publicidade'] },
    ],
  },
  {
    id: 'system', label: 'Sistema', color: 'zinc', icon: 'Cpu',
    items: [
      { id: 'analytics', label: 'Analytics', title: 'Analytics e Métricas', description: 'Métricas de acesso, geolocalização e origens de tráfego', hint: 'Métricas e relatórios', icon: 'BarChart3', keywords: ['acessos', 'relatórios', 'tráfego'] },
      { id: 'quotes', label: 'Cotações', title: 'Cotações Agropecuárias', description: 'Cotações de dólar, produtos agrícolas e pecuários', hint: 'Cotações agro', icon: 'TrendingUp', keywords: ['preços', 'agro', 'dólar'] },
      { id: 'slides', label: 'Slides', title: 'Configuração de Slides', description: 'Configure o slideshow da home e de cada categoria', hint: 'Slideshow', icon: 'Layers', keywords: ['carrossel', 'destaques', 'home'] },
      { id: 'ai', label: 'IA e Chat', title: 'Configuração de IA', description: 'Configure os provedores de inteligência artificial', hint: 'Provedores de IA', icon: 'Cpu', keywords: ['openai', 'gemini', 'claude', 'ollama'], masterOnly: true },
      { id: 'users', label: 'Usuários', title: 'Gerenciar Usuários', description: 'Usuários master, admin, editor e leitores', hint: 'Gerenciar usuários', icon: 'Users', keywords: ['contas', 'perfis', 'leitores'] },
      { id: 'editors', label: 'Editores', title: 'Gerenciar Editores', description: 'Configure permissões, limites e bios dos editores', hint: 'Permissões', icon: 'UserCog', keywords: ['redatores', 'autores', 'acessos'] },
      { id: 'verifications', label: 'Verificações', title: 'Verificação de CPF/CNPJ', description: 'Aprove ou rejeite verificações de identidade', hint: 'CPF/CNPJ', icon: 'ShieldCheck', keywords: ['documentos', 'identidade', 'aprovação'] },
      { id: 'seo', label: 'SEO e Site', title: 'SEO e Configurações do Site', description: 'Configurações de SEO, OpenGraph e redes sociais', hint: 'Configurações globais', icon: 'Search', keywords: ['metadados', 'opengraph', 'aparência'] },
      { id: 'categories', label: 'Categorias', title: 'Gerenciar Categorias', description: 'Categorias e editorias do portal', hint: 'Editorias', icon: 'FolderTree', keywords: ['seções', 'menu', 'editorias'] },
      { id: 'audit', label: 'Auditoria', title: 'Auditoria Administrativa', description: 'Histórico rastreável das alterações administrativas sensíveis', hint: 'Histórico administrativo', icon: 'ScrollText', keywords: ['logs', 'alterações', 'segurança'], masterOnly: true },
    ],
  },
] as const satisfies readonly AdminNavigationGroup[]

type NavigationGroup = typeof ADMIN_NAVIGATION_GROUPS[number]
export type AdminSectionId = NavigationGroup['items'][number]['id']

export const ADMIN_SECTION_IDS = ADMIN_NAVIGATION_GROUPS.flatMap(group => group.items.map(item => item.id)) as AdminSectionId[]
export const ADMIN_SECTION_BY_ID = Object.fromEntries(
  ADMIN_NAVIGATION_GROUPS.flatMap(group => group.items.map(item => [item.id, item])),
) as Record<AdminSectionId, AdminNavigationItem>

export const EDITOR_PANEL_SECTIONS = ['dashboard', 'posts', 'editor'] as const satisfies readonly AdminSectionId[]

export function isAdminSectionId(value: string): value is AdminSectionId {
  return ADMIN_SECTION_IDS.includes(value as AdminSectionId)
}

export function isMasterOnlyAdminSection(section: AdminSectionId): boolean {
  return ADMIN_SECTION_BY_ID[section].masterOnly === true
}
