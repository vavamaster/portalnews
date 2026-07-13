/**
 * Classifieds business logic — single source of truth.
 *
 * Consolidates:
 * - Plan feature-gating (sanitizeListingByPlan) — used by POST + PUT routes
 * - Boosted/featured "still active" checks (isBoosted/isFeatured) — used by 7+ sites
 * - Status transition validation — used by classifieds PUT + admin PUT
 */

import { db } from './db'

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
      .map((p: any) => typeof p === 'string' ? normalizeUrlLocal(p) : null)
      .filter((p: string | null): p is string => !!p)
      .slice(0, plan.maxPhotosPerListing) // truncate to plan limit
  }

  // Validate services
  let services: string | null = null
  if (plan.allowServices && data.services) {
    if (Array.isArray(data.services)) {
      const max = plan.maxServicesPerListing === -1 ? Infinity : plan.maxServicesPerListing
      services = JSON.stringify(data.services.slice(0, max))
    } else if (typeof data.services === 'string') {
      services = data.services
    }
  }

  return {
    phone: plan.allowPhone ? (typeof data.phone === 'string' ? data.phone.trim() || null : null) : null,
    whatsapp: plan.allowWhatsApp ? (typeof data.whatsapp === 'string' ? data.whatsapp.trim() || null : null) : null,
    email: plan.allowEmail ? (typeof data.email === 'string' ? data.email.trim() || null : null) : null,
    // website gated by allowEmail (no separate allowWebsite field in schema)
    website: plan.allowEmail ? normalizeUrlLocal(data.website) : null,
    logoUrl: plan.allowLogo ? normalizeUrlLocal(data.logoUrl) : null,
    address: plan.allowMap ? (typeof data.address === 'string' ? data.address.trim() || null : null) : null,
    latitude: plan.allowMap ? (data.latitude ?? null) : null,
    longitude: plan.allowMap ? (data.longitude ?? null) : null,
    services,
    photos,
  }
}

// Local URL normalizer to avoid circular import with utils.ts
function normalizeUrlLocal(url: any): string | null {
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

// === Subscription-listing pause/resume (consolidated from 3 sites) ===

/**
 * Pause all ACTIVE listings for a user (when their subscription expires/cancels).
 * Called by: cron/renew-subscriptions, webhooks (stripe/asaas/mp), admin cancel.
 */
export async function pauseListingsForUser(userId: string, reason?: string): Promise<number> {
  const result = await db.classifiedListing.updateMany({
    where: { ownerId: userId, status: 'ACTIVE' },
    data: { status: 'PAUSED' },
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
    where: { ownerId: userId, status: 'PAUSED' },
    data: { status: 'ACTIVE' },
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
