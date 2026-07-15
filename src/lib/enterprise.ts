import { db } from '@/lib/db'

export const ENTERPRISE_AD_STATUSES = ['PENDING', 'ACTIVE', 'PAUSED', 'REJECTED', 'EXPIRED'] as const
export const ENTERPRISE_CYCLE_STATUSES = ['PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED'] as const
export const ENTERPRISE_BILLING_TYPES = ['MONTHLY', 'IMPRESSIONS'] as const

type EnterpriseCycleLike = {
  status: string
  type: string
  startAt: Date
  endAt: Date | null
  impressionsUsed: number
  impressionsLimit: number
}

export function isEnterpriseCycleEligible(
  cycle: EnterpriseCycleLike,
  now = new Date(),
  options: { allowReachedImpressionLimit?: boolean } = {},
) {
  if (cycle.status !== 'ACTIVE' || cycle.startAt > now) return false
  if (cycle.type === 'MONTHLY') return !cycle.endAt || cycle.endAt > now
  if (cycle.type === 'IMPRESSIONS') {
    if (cycle.impressionsLimit <= 0) return false
    return options.allowReachedImpressionLimit
      ? cycle.impressionsUsed <= cycle.impressionsLimit
      : cycle.impressionsUsed < cycle.impressionsLimit
  }
  return false
}

export async function findEligibleEnterpriseCycle(
  sponsoredCategoryId: string,
  userId: string,
  options: { allowReachedImpressionLimit?: boolean; now?: Date } = {},
) {
  const cycles = await db.enterpriseBillingCycle.findMany({
    where: { sponsoredCategoryId, userId, status: 'ACTIVE' },
    orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
  })
  const now = options.now || new Date()
  return cycles.find(cycle => isEnterpriseCycleEligible(cycle, now, options)) || null
}

export async function findServingEnterpriseCycle(
  sponsoredCategoryId: string,
  userId: string,
  options: { allowReachedImpressionLimit?: boolean; now?: Date } = {},
) {
  const sponsor = await db.sponsoredCategory.findUnique({
    where: { id: sponsoredCategoryId },
    select: { mode: true, isActive: true },
  })
  if (!sponsor?.isActive || sponsor.mode === 'DISABLED') return null
  if (sponsor.mode !== 'EXCLUSIVE') {
    return findEligibleEnterpriseCycle(sponsoredCategoryId, userId, options)
  }

  const cycles = await db.enterpriseBillingCycle.findMany({
    where: { sponsoredCategoryId, status: 'ACTIVE' },
    include: { user: { select: { enterpriseLink: { select: { isActive: true } } } } },
    orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
  })
  const now = options.now || new Date()
  const winner = cycles.find(cycle => (
    cycle.user.enterpriseLink?.isActive && isEnterpriseCycleEligible(cycle, now, options)
  ))
  return winner?.userId === userId ? winner : null
}

/**
 * Activates a cycle while enforcing the commercial invariants:
 * - one active cycle per company/category in rotating mode;
 * - one active company per category in exclusive mode.
 */
export async function activateEnterpriseCycle(cycleId: string, resetPeriod = false) {
  const cycle = await db.enterpriseBillingCycle.findUnique({
    where: { id: cycleId },
    include: { sponsoredCategory: true },
  })
  if (!cycle) throw new Error('Ciclo Enterprise não encontrado')

  const now = new Date()
  const isExclusive = cycle.sponsoredCategory.mode === 'EXCLUSIVE'
  const conflictWhere = isExclusive
    ? { sponsoredCategoryId: cycle.sponsoredCategoryId, status: 'ACTIVE', id: { not: cycle.id } }
    : { sponsoredCategoryId: cycle.sponsoredCategoryId, userId: cycle.userId, status: 'ACTIVE', id: { not: cycle.id } }

  const updateData = {
    status: 'ACTIVE',
    ...(resetPeriod ? {
      startAt: now,
      endAt: cycle.type === 'MONTHLY'
        ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        : null,
      impressionsUsed: cycle.type === 'IMPRESSIONS' ? 0 : cycle.impressionsUsed,
      adminNotifiedAt: null,
    } : {}),
  }

  await db.$transaction([
    db.enterpriseBillingCycle.updateMany({
      where: conflictWhere,
      data: { status: 'EXPIRED' },
    }),
    ...(isExclusive ? [db.enterpriseAd.updateMany({
      where: {
        sponsoredCategoryId: cycle.sponsoredCategoryId,
        ownerId: { not: cycle.userId },
        status: 'ACTIVE',
      },
      data: { status: 'PAUSED' },
    })] : []),
    db.enterpriseBillingCycle.update({ where: { id: cycle.id }, data: updateData }),
    db.enterpriseAd.updateMany({
      where: {
        sponsoredCategoryId: cycle.sponsoredCategoryId,
        ownerId: cycle.userId,
        status: 'PAUSED',
      },
      data: { status: 'ACTIVE' },
    }),
  ])

  return db.enterpriseBillingCycle.findUnique({ where: { id: cycle.id } })
}

export async function pauseEnterpriseAdsWithoutCoverage(sponsoredCategoryId: string, userId: string) {
  const replacement = await findEligibleEnterpriseCycle(sponsoredCategoryId, userId)
  if (replacement) return false
  await db.enterpriseAd.updateMany({
    where: { sponsoredCategoryId, ownerId: userId, status: 'ACTIVE' },
    data: { status: 'PAUSED' },
  })
  return true
}

type MetricKind = 'impression' | 'click'

export async function recordEnterpriseAdMetric(adId: string, kind: MetricKind) {
  const now = new Date()
  const ad = await db.enterpriseAd.findUnique({
    where: { id: adId },
    include: {
      sponsoredCategory: true,
      owner: { select: { enterpriseLink: { select: { isActive: true } } } },
    },
  })

  if (!ad || ad.status !== 'ACTIVE') return { ok: false, reason: 'inactive_ad' as const }
  if (!ad.owner.enterpriseLink?.isActive) return { ok: false, reason: 'inactive_enterprise_access' as const }
  if (!ad.sponsoredCategory.isActive || ad.sponsoredCategory.mode === 'DISABLED') {
    return { ok: false, reason: 'inactive_sponsor' as const }
  }
  if ((ad.startAt && ad.startAt > now) || (ad.endAt && ad.endAt <= now)) {
    return { ok: false, reason: 'outside_schedule' as const }
  }

  const cycle = await findServingEnterpriseCycle(ad.sponsoredCategoryId, ad.ownerId, {
    now,
    allowReachedImpressionLimit: kind === 'click',
  })
  if (!cycle) return { ok: false, reason: 'no_active_cycle' as const }

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  try {
    await db.$transaction(async tx => {
      if (kind === 'impression' && cycle.type === 'IMPRESSIONS') {
        const reserved = await tx.enterpriseBillingCycle.updateMany({
          where: {
            id: cycle.id,
            status: 'ACTIVE',
            impressionsUsed: { lt: cycle.impressionsLimit },
          },
          data: { impressionsUsed: { increment: 1 } },
        })
        if (reserved.count === 0) throw new Error('ENTERPRISE_IMPRESSION_LIMIT_REACHED')
      }

      await tx.enterpriseAd.update({
        where: { id: ad.id },
        data: kind === 'impression'
          ? { impressions: { increment: 1 } }
          : { clicks: { increment: 1 } },
      })
      await tx.enterpriseMetric.upsert({
        where: { sponsoredCategoryId_date: { sponsoredCategoryId: ad.sponsoredCategoryId, date: today } },
        update: kind === 'impression'
          ? { impressions: { increment: 1 } }
          : { clicks: { increment: 1 } },
        create: {
          sponsoredCategoryId: ad.sponsoredCategoryId,
          date: today,
          ...(kind === 'impression' ? { impressions: 1 } : { clicks: 1 }),
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'ENTERPRISE_IMPRESSION_LIMIT_REACHED') {
      return { ok: false, reason: 'impression_limit_reached' as const }
    }
    throw error
  }

  return { ok: true, cycleId: cycle.id }
}

function optionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw new Error('Campo de texto inválido')
  const normalized = value.trim()
  if (normalized.length > maxLength) throw new Error(`Campo excede ${maxLength} caracteres`)
  return normalized || null
}

function optionalUrl(value: unknown, options: { allowRelative?: boolean; youtubeOnly?: boolean } = {}) {
  const normalized = optionalText(value, 2048)
  if (!normalized) return null
  if (options.allowRelative && ((normalized.startsWith('/') && !normalized.startsWith('//')) || normalized.startsWith('?'))) {
    return normalized
  }
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error('URL inválida')
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A URL deve usar HTTP ou HTTPS')
  if (options.youtubeOnly && !/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname.toLowerCase())) {
    throw new Error('O vídeo deve ser uma URL válida do YouTube')
  }
  return url.toString()
}

export function safeEnterpriseUrl(value: unknown, options: { allowRelative?: boolean; youtubeOnly?: boolean } = {}) {
  try { return optionalUrl(value, options) } catch { return null }
}

export function parseEnterpriseAdInput(body: unknown, options: { partial?: boolean; admin?: boolean } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Dados do anúncio inválidos')
  const source = body as Record<string, unknown>
  const data: Record<string, unknown> = {}
  const set = (key: string, parser: (value: unknown) => unknown) => {
    if (!options.partial || key in source) data[key] = parser(source[key])
  }

  set('title', value => {
    const title = optionalText(value, 160)
    if (!options.partial && !title) throw new Error('Título é obrigatório')
    if (options.partial && 'title' in source && !title) throw new Error('Título é obrigatório')
    return title
  })
  set('subtitle', value => optionalText(value, 300))
  set('logoUrl', value => optionalUrl(value, { allowRelative: true }))
  set('imageUrl', value => optionalUrl(value, { allowRelative: true }))
  set('videoUrl', value => optionalUrl(value, { youtubeOnly: true }))
  set('linkUrl', value => optionalUrl(value, { allowRelative: true }))
  set('ctaText', value => optionalText(value, 60))

  if (options.admin && 'order' in source) {
    const order = Number(source.order)
    if (!Number.isInteger(order) || order < 0 || order > 1000) throw new Error('Ordem inválida')
    data.order = order
  }
  return data
}

export function parseEnterpriseLandingPageInput(body: unknown, options: { allowIsActive?: boolean } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Dados da landing page inválidos')
  const source = body as Record<string, unknown>
  const companyName = optionalText(source.companyName, 160)
  if (!companyName) throw new Error('Nome da empresa é obrigatório')

  const data: Record<string, unknown> = {
    companyName,
    niche: optionalText(source.niche, 120),
    logoUrl: optionalUrl(source.logoUrl, { allowRelative: true }),
    heroTitle: optionalText(source.heroTitle, 180),
    heroSubtitle: optionalText(source.heroSubtitle, 300),
    heroImageUrl: optionalUrl(source.heroImageUrl, { allowRelative: true }),
    aboutText: optionalText(source.aboutText, 20_000),
    phone: optionalText(source.phone, 40),
    whatsapp: optionalText(source.whatsapp, 40),
    email: optionalText(source.email, 254),
    website: optionalUrl(source.website),
    facebookUrl: optionalUrl(source.facebookUrl),
    instagramUrl: optionalUrl(source.instagramUrl),
    youtubeUrl: optionalUrl(source.youtubeUrl),
    linkedinUrl: optionalUrl(source.linkedinUrl),
    address: optionalText(source.address, 500),
    city: optionalText(source.city, 120),
    state: optionalText(source.state, 80),
    zipCode: optionalText(source.zipCode, 20),
    seoTitle: optionalText(source.seoTitle, 180),
    seoDescription: optionalText(source.seoDescription, 500),
    seoKeywords: optionalText(source.seoKeywords, 500),
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) {
    throw new Error('Email inválido')
  }

  const primaryColor = optionalText(source.primaryColor, 20)
  if (primaryColor && !/^#[0-9a-f]{6}$/i.test(primaryColor)) throw new Error('Cor primária inválida')
  data.primaryColor = primaryColor

  const coordinate = (value: unknown, min: number, max: number, label: string) => {
    if (value === null || value === undefined || value === '') return null
    const number = Number(value)
    if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label} inválida`)
    return number
  }
  data.latitude = coordinate(source.latitude, -90, 90, 'Latitude')
  data.longitude = coordinate(source.longitude, -180, 180, 'Longitude')

  const jsonArray = (value: unknown, label: string) => {
    if (value === null || value === undefined || value === '') return null
    let parsed = value
    if (typeof value === 'string') {
      if (value.length > 100_000) throw new Error(`${label} excede o tamanho permitido`)
      try { parsed = JSON.parse(value) } catch { throw new Error(`${label} contém JSON inválido`) }
    }
    if (!Array.isArray(parsed) || parsed.length > 100) throw new Error(`${label} deve ser uma lista com até 100 itens`)
    return JSON.stringify(parsed)
  }
  data.productsJson = jsonArray(source.productsJson, 'Produtos')
  data.servicesJson = jsonArray(source.servicesJson, 'Serviços')
  data.galleryJson = jsonArray(source.galleryJson, 'Galeria')
  data.videoUrlsJson = jsonArray(source.videoUrlsJson, 'Vídeos')

  if (options.allowIsActive && source.isActive !== undefined) data.isActive = Boolean(source.isActive)
  return data
}
