/**
 * Classifieds business logic — single source of truth.
 *
 * Consolidates:
 * - Plan feature-gating (sanitizeListingByPlan) — used by POST + PUT routes
 * - Boosted/featured "still active" checks (isBoosted/isFeatured) — used by 7+ sites
 * - Status transition validation — used by classifieds PUT + admin PUT
 */

import { db } from './db'
import type { Plan, Prisma } from '@prisma/client'
import { cancelGatewaySubscription, type GatewayProvider } from './payment-gateway'

// === Status types ===
export type ListingStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REJECTED' | 'EXPIRED' | 'SOLD'
export type PersonType = 'PF' | 'PJ'

// === Status transitions ===
// Maps current status → allowed next statuses.
// Owner can: ACTIVE↔PAUSED, ACTIVE→SOLD, PAUSED→SOLD, SOLD→ACTIVE
// Admin can do anything (handled separately)
const OWNER_TRANSITIONS: Record<string, ListingStatus[]> = {
  ACTIVE: ['PAUSED', 'SOLD'],
  PAUSED: ['ACTIVE', 'SOLD'],
  PENDING: [], // owner can't self-approve
  REJECTED: [], // owner can't self-unreject
  EXPIRED: [], // owner can't reactivate expired
  SOLD: ['ACTIVE', 'PAUSED'], // reactivate
}

const ADMIN_TRANSITIONS: Record<string, ListingStatus[]> = {
  ACTIVE: ['PAUSED', 'SOLD', 'EXPIRED', 'PENDING', 'REJECTED'],
  PAUSED: ['ACTIVE', 'SOLD', 'EXPIRED'],
  PENDING: ['ACTIVE', 'REJECTED', 'PAUSED'],
  REJECTED: ['ACTIVE', 'PENDING'],
  EXPIRED: ['ACTIVE', 'PENDING'],
  SOLD: ['ACTIVE', 'PAUSED'],
}

/** Check if a status transition is allowed for the given role. */
export function isStatusTransitionAllowed(
  from: string,
  to: string,
  isAdmin: boolean
): boolean {
  if (from === to) return true
  const allowed = isAdmin ? ADMIN_TRANSITIONS[from] : OWNER_TRANSITIONS[from]
  return allowed?.includes(to as ListingStatus) ?? false
}

// === Boosted/Featured checks ===

/** Check if a listing is currently boosted (boosted flag + boostedUntil in future) */
export function isBoosted(listing: { boosted: boolean; boostedUntil?: string | Date | null }): boolean {
  if (!listing.boosted || !listing.boostedUntil) return false
  return new Date(listing.boostedUntil) > new Date()
}

/** Check if a listing is currently featured (featured flag + featuredUntil in future) */
export function isFeatured(listing: { featured: boolean; featuredUntil?: string | Date | null }): boolean {
  if (!listing.featured || !listing.featuredUntil) return false
  return new Date(listing.featuredUntil) > new Date()
}

// === Plan feature-gating ===

export interface SanitizedListingData {
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  logoUrl: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  services: string | null
  photos: string[] | null
}

/**
 * Strip contact info + features that the plan doesn't allow.
 * Used by both POST (create) and PUT (update) classifieds routes.
 *
 * @param plan The Plan record from DB
 * @param data Raw input data from the request
 * @returns Sanitized data with disallowed fields set to null
 */
export function sanitizeListingByPlan(
  plan: {
    allowPhone: boolean
    allowWhatsApp: boolean
    allowEmail: boolean
    allowLogo: boolean
    allowMap: boolean
    allowServices: boolean
    maxPhotosPerListing: number
    maxServicesPerListing: number
  },
  data: {
    phone?: string | null
    whatsapp?: string | null
    email?: string | null
    website?: string | null
    logoUrl?: string | null
    address?: string | null
    latitude?: number | null
    longitude?: number | null
    services?: any
    photos?: any
  }
): SanitizedListingData {
  // Validate photos
  let photos: string[] | null = null
  if (Array.isArray(data.photos)) {
    photos = data.photos
      .map((p: any) => typeof p === 'string' ? normalizeClassifiedMediaUrl(p) : null)
      .filter((p: string | null): p is string => !!p)
    if (plan.maxPhotosPerListing !== -1) photos = photos.slice(0, plan.maxPhotosPerListing)
  }

  // Validate services
  let services: string | null = null
  if (plan.allowServices && data.services) {
    if (Array.isArray(data.services)) {
      const max = plan.maxServicesPerListing === -1 ? data.services.length : plan.maxServicesPerListing
      const normalizedServices = data.services
        .slice(0, max)
        .filter((item: any) => item && typeof item === 'object' && !Array.isArray(item))
        .map((item: any) => ({
          name: typeof item.name === 'string' ? item.name.trim().slice(0, 120) : '',
          price: Number.isFinite(Number(item.price)) && Number(item.price) >= 0 ? Math.min(Number(item.price), 999_999_999) : 0,
          description: typeof item.description === 'string' ? item.description.trim().slice(0, 1000) : '',
          photo: normalizeClassifiedMediaUrl(item.photo) || '',
        }))
        .filter((item: any) => item.name.length > 0)
      services = normalizedServices.length ? JSON.stringify(normalizedServices) : null
    }
  }

  return {
    phone: plan.allowPhone ? (typeof data.phone === 'string' ? data.phone.trim() || null : null) : null,
    whatsapp: plan.allowWhatsApp ? (typeof data.whatsapp === 'string' ? data.whatsapp.trim() || null : null) : null,
    email: plan.allowEmail ? (typeof data.email === 'string' ? data.email.trim() || null : null) : null,
    // website gated by allowEmail (no separate allowWebsite field in schema)
    website: plan.allowEmail ? normalizeExternalUrl(data.website) : null,
    logoUrl: plan.allowLogo ? normalizeClassifiedMediaUrl(data.logoUrl) : null,
    address: plan.allowMap ? (typeof data.address === 'string' ? data.address.trim() || null : null) : null,
    latitude: plan.allowMap ? (data.latitude ?? null) : null,
    longitude: plan.allowMap ? (data.longitude ?? null) : null,
    services,
    photos,
  }
}

// Local URL normalizer to avoid circular import with utils.ts
export function normalizeClassifiedMediaUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^\/uploads\/[a-zA-Z0-9._-]+$/.test(trimmed)) return trimmed
  return normalizeExternalUrl(trimmed)
}

export function normalizeExternalUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(withProto)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

/**
 * Applies a newly activated plan to every listing owned by the subscriber.
 * It removes features the new plan no longer permits and pauses ACTIVE
 * listings above the new quota. Manual pauses remain untouched.
 */
export async function applyPlanLimitsToUser(
  tx: Prisma.TransactionClient,
  userId: string,
  plan: Plan,
): Promise<void> {
  const listings = await tx.classifiedListing.findMany({
    where: { ownerId: userId },
    orderBy: [{ publishedAt: 'asc' }, { createdAt: 'asc' }],
  })

  const quotaCandidates = listings.filter(listing =>
    listing.status === 'ACTIVE' || listing.status === 'PENDING' || listing.pausedBySubscription
  )
  const allowedIds = new Set(
    (plan.maxListings === -1 ? quotaCandidates : quotaCandidates.slice(0, plan.maxListings)).map(listing => listing.id)
  )
  const now = new Date()

  for (const listing of listings) {
    const photos = (() => {
      try {
        const parsed = JSON.parse(listing.photos || '[]')
        if (!Array.isArray(parsed)) return null
        const sanitized = parsed
          .map(normalizeClassifiedMediaUrl)
          .filter((url): url is string => !!url)
        return JSON.stringify(plan.maxPhotosPerListing === -1 ? sanitized : sanitized.slice(0, plan.maxPhotosPerListing))
      } catch {
        return null
      }
    })()
    const services = (() => {
      if (!plan.allowServices) return null
      try {
        const parsed = JSON.parse(listing.services || '[]')
        if (!Array.isArray(parsed)) return null
        return JSON.stringify(plan.maxServicesPerListing === -1 ? parsed : parsed.slice(0, plan.maxServicesPerListing))
      } catch {
        return null
      }
    })()
    const data: Prisma.ClassifiedListingUpdateInput = {
      plan: { connect: { id: plan.id } },
      phone: plan.allowPhone ? listing.phone : null,
      whatsapp: plan.allowWhatsApp ? listing.whatsapp : null,
      email: plan.allowEmail ? listing.email : null,
      website: plan.allowEmail ? listing.website : null,
      logoUrl: plan.allowLogo ? listing.logoUrl : null,
      address: plan.allowMap ? listing.address : null,
      latitude: plan.allowMap ? listing.latitude : null,
      longitude: plan.allowMap ? listing.longitude : null,
      services,
      photos,
      featured: plan.allowFeatured ? listing.featured : false,
      featuredUntil: plan.allowFeatured ? listing.featuredUntil : null,
      boosted: plan.allowBoost ? listing.boosted : false,
      boostedUntil: plan.allowBoost ? listing.boostedUntil : null,
    }

    if (listing.status === 'ACTIVE' && !allowedIds.has(listing.id)) {
      data.status = 'PAUSED'
      data.pausedBySubscription = true
    } else if (
      listing.status === 'PAUSED' &&
      listing.pausedBySubscription &&
      allowedIds.has(listing.id) &&
      !!listing.publishedAt &&
      !!listing.expiresAt &&
      listing.expiresAt > now
    ) {
      data.status = 'ACTIVE'
      data.pausedBySubscription = false
    }

    await tx.classifiedListing.update({ where: { id: listing.id }, data })
  }
}

/** Activate a paid subscription only after gateway confirmation. */
export async function activateClassifiedSubscription(
  subscriptionId: string,
  options: { externalSubId?: string | null; periodEnd?: Date } = {},
) {
  const subscription = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  })
  if (!subscription) throw new Error('Assinatura pendente não encontrada')

  const previous = await db.subscription.findMany({
    where: { userId: subscription.userId, status: 'ACTIVE', id: { not: subscription.id } },
  })
  for (const current of previous) {
    if (current.externalSubId && ['ASAAS', 'MERCADO_PAGO', 'STRIPE'].includes(current.paymentProvider || '')) {
      const canceled = await cancelGatewaySubscription(current.paymentProvider as GatewayProvider, current.externalSubId)
      if (!canceled.success) throw new Error(`Falha ao cancelar assinatura anterior no ${current.paymentProvider}: ${canceled.message}`)
    }
  }

  const now = new Date()
  const periodEnd = options.periodEnd || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  return db.$transaction(async tx => {
    await tx.subscription.updateMany({
      where: { userId: subscription.userId, status: 'ACTIVE', id: { not: subscription.id } },
      data: { status: 'CANCELED', autoRenew: false },
    })
    const activated = await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        externalSubId: options.externalSubId || subscription.externalSubId,
        listingsUsedThisCycle: 0,
        leadsReceivedThisCycle: 0,
      },
      include: { plan: true },
    })
    await applyPlanLimitsToUser(tx, subscription.userId, subscription.plan)
    return activated
  })
}

// === Subscription-listing pause/resume (consolidated from 3 sites) ===

/**
 * Pause all ACTIVE listings for a user (when their subscription expires/cancels).
 * Called by: cron/renew-subscriptions, webhooks (stripe/asaas/mp), admin cancel.
 */
export async function pauseListingsForUser(userId: string, reason?: string): Promise<number> {
  const result = await db.classifiedListing.updateMany({
    where: { ownerId: userId, status: 'ACTIVE' },
    data: { status: 'PAUSED', pausedBySubscription: true },
  })
  if (result.count > 0) {
    await db.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Anúncios pausados',
        message: reason || 'Sua assinatura não está ativa. Seus anúncios foram pausados. Renove o plano para reativá-los.',
        link: 'plans',
      },
    }).catch(() => {})
  }
  return result.count
}

/**
 * Resume PAUSED listings for a user (when they re-subscribe).
 * Called by: webhooks (invoice.paid), admin activate, cron resume step.
 */
export async function resumeListingsForUser(userId: string): Promise<number> {
  const result = await db.classifiedListing.updateMany({
    where: {
      ownerId: userId,
      status: 'PAUSED',
      pausedBySubscription: true,
      expiresAt: { gt: new Date() },
    },
    data: { status: 'ACTIVE', pausedBySubscription: false },
  })
  if (result.count > 0) {
    await db.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Anúncios reativados',
        message: 'Sua assinatura está ativa novamente. Seus anúncios foram reativados.',
        link: 'advertiser',
      },
    }).catch(() => {})
  }
  return result.count
}
