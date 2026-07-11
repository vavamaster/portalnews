// Plan configuration - source of truth for plan features.
// Mirrors what's in the DB so we can seed defaults and validate.

export type PlanSlug = 'FREE' | 'PROFESSIONAL' | 'COMPANY' | 'PREMIUM'

export interface PlanConfig {
  slug: PlanSlug
  name: string
  description: string
  priceCents: number
  badgeColor: string
  maxListings: number // -1 = unlimited
  maxPhotosPerListing: number
  maxServicesPerListing: number
  allowPoints: boolean
  pointsPerListing: number
  pointsPerBoost3d: number
  pointsPerBoost7d: number
  pointsPerBoost15d: number
  allowWhatsApp: boolean
  allowPanelMessage: boolean
  allowPhone: boolean
  allowEmail: boolean
  allowMap: boolean
  allowLogo: boolean
  allowFeatured: boolean
  allowReviews: boolean
  allowAnalytics: boolean
  allowBoost: boolean
  allowServices: boolean
  allowVerified: boolean
  maxLeadsPerMonth: number
  personType: 'PF' | 'PJ' | 'BOTH'
  highlights: string[] // marketing bullets
}

export const PLANS: PlanConfig[] = [
  {
    slug: 'FREE',
    name: 'Grátis',
    description: 'Para começar — perfeito para anúncios pessoais esporádicos. Use pontos para publicar mais.',
    priceCents: 0,
    badgeColor: 'zinc',
    maxListings: 1,
    maxPhotosPerListing: 3,
    maxServicesPerListing: 0,
    allowPoints: true,
    pointsPerListing: 30,
    pointsPerBoost3d: 50,
    pointsPerBoost7d: 100,
    pointsPerBoost15d: 200,
    allowWhatsApp: false,
    allowPanelMessage: true,
    allowPhone: false,
    allowEmail: false,
    allowMap: false,
    allowLogo: false,
    allowFeatured: false,
    allowReviews: false,
    allowAnalytics: false,
    allowBoost: true,
    allowServices: false,
    allowVerified: false,
    maxLeadsPerMonth: 5,
    personType: 'PF',
    highlights: [
      '1 anúncio ativo',
      'Até 3 fotos',
      'Mensagens pelo painel (5/mês)',
      'Use pontos para anúncios extras',
      'Boost com pontos',
    ],
  },
  {
    slug: 'PROFESSIONAL',
    name: 'Profissional',
    description: 'Para autônomos e profissionais liberais (CPF) que querem mais contatos.',
    priceCents: 4990, // R$ 49,90/mês
    badgeColor: 'blue',
    maxListings: 10,
    maxPhotosPerListing: 6,
    maxServicesPerListing: 5,
    allowPoints: false,
    pointsPerListing: 0,
    pointsPerBoost3d: 50,
    pointsPerBoost7d: 100,
    pointsPerBoost15d: 200,
    allowWhatsApp: true,
    allowPanelMessage: true,
    allowPhone: true,
    allowEmail: true,
    allowMap: true,
    allowLogo: false,
    allowFeatured: false,
    allowReviews: true,
    allowAnalytics: true,
    allowBoost: true,
    allowServices: true,
    allowVerified: true,
    maxLeadsPerMonth: 50,
    personType: 'PF',
    highlights: [
      '10 anúncios ativos',
      'Até 6 fotos por anúncio',
      'WhatsApp + Telefone + Email liberados',
      'Mapa da localização',
      'Até 5 serviços/produtos',
      'Avaliações de clientes',
      'Painel de leads + analytics',
      'Selos de boost com pontos',
    ],
  },
  {
    slug: 'COMPANY',
    name: 'Empresa',
    description: 'Para empresas e MEI (CNPJ) com catálogo de produtos/serviços e destaque na busca.',
    priceCents: 9900, // R$ 99,00/mês
    badgeColor: 'amber',
    maxListings: 50,
    maxPhotosPerListing: 10,
    maxServicesPerListing: 20,
    allowPoints: false,
    pointsPerListing: 0,
    pointsPerBoost3d: 50,
    pointsPerBoost7d: 100,
    pointsPerBoost15d: 200,
    allowWhatsApp: true,
    allowPanelMessage: true,
    allowPhone: true,
    allowEmail: true,
    allowMap: true,
    allowLogo: true,
    allowFeatured: true,
    allowReviews: true,
    allowAnalytics: true,
    allowBoost: true,
    allowServices: true,
    allowVerified: true,
    maxLeadsPerMonth: -1, // unlimited
    personType: 'PJ',
    highlights: [
      '50 anúncios ativos',
      'Até 10 fotos por anúncio',
      'Logo + razão social + CNPJ verificado',
      'WhatsApp + Telefone + Email + Website',
      'Mapa + endereço completo',
      'Até 20 serviços/produtos com preço',
      'Destaque (Featured) na busca',
      'Leads ilimitadas + analytics avançado',
      'Selo verificado dourado',
    ],
  },
  {
    slug: 'PREMIUM',
    name: 'Premium',
    description: 'Para quem quer máxima exposição. Tudo do Empresa + featured automático + prioridade.',
    priceCents: 19900, // R$ 199,00/mês
    badgeColor: 'purple',
    maxListings: -1,
    maxPhotosPerListing: 20,
    maxServicesPerListing: -1,
    allowPoints: false,
    pointsPerListing: 0,
    pointsPerBoost3d: 50,
    pointsPerBoost7d: 100,
    pointsPerBoost15d: 200,
    allowWhatsApp: true,
    allowPanelMessage: true,
    allowPhone: true,
    allowEmail: true,
    allowMap: true,
    allowLogo: true,
    allowFeatured: true,
    allowReviews: true,
    allowAnalytics: true,
    allowBoost: true,
    allowServices: true,
    allowVerified: true,
    maxLeadsPerMonth: -1,
    personType: 'BOTH',
    highlights: [
      'Anúncios ilimitados',
      'Até 20 fotos por anúncio',
      'Serviços/produtos ilimitados',
      'Featured automático em todos anúncios',
      'Prioridade no algoritmo de busca',
      'Suporte prioritário',
      'Relatórios mensais por email',
      'Selos verificados + Premium',
    ],
  },
]

export function getPlanConfig(slug: string): PlanConfig | undefined {
  return PLANS.find(p => p.slug === slug)
}

// Convert config to DB shape
export function planConfigToDbData(c: PlanConfig) {
  return {
    slug: c.slug,
    name: c.name,
    description: c.description,
    priceCents: c.priceCents,
    badgeColor: c.badgeColor,
    maxListings: c.maxListings,
    maxPhotosPerListing: c.maxPhotosPerListing,
    maxServicesPerListing: c.maxServicesPerListing,
    allowPoints: c.allowPoints,
    pointsPerListing: c.pointsPerListing,
    pointsPerBoost3d: c.pointsPerBoost3d,
    pointsPerBoost7d: c.pointsPerBoost7d,
    pointsPerBoost15d: c.pointsPerBoost15d,
    allowWhatsApp: c.allowWhatsApp,
    allowPanelMessage: c.allowPanelMessage,
    allowPhone: c.allowPhone,
    allowEmail: c.allowEmail,
    allowMap: c.allowMap,
    allowLogo: c.allowLogo,
    allowFeatured: c.allowFeatured,
    allowReviews: c.allowReviews,
    allowAnalytics: c.allowAnalytics,
    allowBoost: c.allowBoost,
    allowServices: c.allowServices,
    allowVerified: c.allowVerified,
    maxLeadsPerMonth: c.maxLeadsPerMonth,
  }
}

// Payment provider labels
export const PAYMENT_PROVIDERS = {
  ASAAS: { name: 'Asaas', icon: 'CreditCard', color: 'blue' },
  MERCADO_PAGO: { name: 'Mercado Pago', icon: 'Wallet', color: 'amber' },
  STRIPE: { name: 'Stripe', icon: 'CreditCard', color: 'purple' },
} as const

export type PaymentProvider = keyof typeof PAYMENT_PROVIDERS

// Boost tiers
export const BOOST_TIERS = [
  { id: '3d', days: 3, pointsCost: 50, label: '3 dias' },
  { id: '7d', days: 7, pointsCost: 100, label: '7 dias' },
  { id: '15d', days: 15, pointsCost: 200, label: '15 dias' },
] as const

// Helper: get current active subscription for a user
export async function getUserActivePlan(userId: string, db: any) {
  const sub = await db.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      currentPeriodEnd: { gte: new Date() },
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  })
  return sub
}
