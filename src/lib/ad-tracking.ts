import crypto from 'crypto'
import { db } from './db'

type AdMetricAction = 'impression' | 'click'

const TOKEN_TTL_MS = 15 * 60 * 1000
const fallbackSecret = crypto.randomBytes(32).toString('hex')
const consumedTokens = new Map<string, number>()

function trackingSecret() {
  return process.env.AD_TRACKING_SECRET
    || process.env.NEXTAUTH_SECRET
    || process.env.CRON_SECRET
    || fallbackSecret
}

function signature(value: string) {
  return crypto.createHmac('sha256', trackingSecret()).update(value).digest('base64url')
}

export function createAdTrackingToken(adId: string) {
  const expiresAt = Date.now() + TOKEN_TTL_MS
  const nonce = crypto.randomBytes(12).toString('base64url')
  const payload = `${adId}.${expiresAt}.${nonce}`
  return `${payload}.${signature(payload)}`
}

export function consumeAdTrackingToken(token: unknown, adId: string, action: AdMetricAction) {
  if (typeof token !== 'string' || token.length > 512) return false
  const parts = token.split('.')
  if (parts.length !== 4) return false
  const [tokenAdId, expiresRaw, nonce, suppliedSignature] = parts
  const expiresAt = Number(expiresRaw)
  if (tokenAdId !== adId || !nonce || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return false

  const expected = signature(`${tokenAdId}.${expiresRaw}.${nonce}`)
  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(suppliedSignature)
  if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return false
  }

  const usageKey = `${token}:${action}`
  if (consumedTokens.has(usageKey)) return false
  consumedTokens.set(usageKey, expiresAt)

  if (consumedTokens.size > 2_000) {
    const now = Date.now()
    for (const [key, expiry] of consumedTokens) {
      if (expiry < now) consumedTokens.delete(key)
    }
  }
  return true
}

function isWithinSchedule(ad: { startAt: Date | null; endAt: Date | null }, now: Date) {
  return (!ad.startAt || ad.startAt <= now) && (!ad.endAt || ad.endAt >= now)
}

export async function recordAdMetric(adId: string, action: AdMetricAction) {
  const now = new Date()

  if (action === 'click') {
    const ad = await db.ad.findUnique({
      where: { id: adId },
      select: { id: true, status: true, startAt: true, endAt: true, isFreeAd: true, impressionLimit: true, impressions: true },
    })
    const pausedAtLimit = ad?.status === 'PAUSED'
      && ad.isFreeAd
      && ad.impressionLimit > 0
      && ad.impressions >= ad.impressionLimit
    if (!ad || (ad.status !== 'ACTIVE' && !pausedAtLimit) || !isWithinSchedule(ad, now)) return false
    await db.ad.update({ where: { id: adId }, data: { clicks: { increment: 1 } } })
    return true
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const ad = await db.ad.findUnique({
      where: { id: adId },
      select: { status: true, startAt: true, endAt: true, isFreeAd: true, impressionLimit: true, impressions: true },
    })
    if (!ad || ad.status !== 'ACTIVE' || !isWithinSchedule(ad, now)) return false
    if (ad.isFreeAd && ad.impressionLimit > 0 && ad.impressions >= ad.impressionLimit) {
      await db.ad.updateMany({ where: { id: adId, status: 'ACTIVE' }, data: { status: 'PAUSED' } })
      return false
    }

    const nextImpressions = ad.impressions + 1
    const reachedLimit = ad.isFreeAd && ad.impressionLimit > 0 && nextImpressions >= ad.impressionLimit
    const updated = await db.ad.updateMany({
      where: { id: adId, status: 'ACTIVE', impressions: ad.impressions },
      data: { impressions: nextImpressions, ...(reachedLimit ? { status: 'PAUSED' } : {}) },
    })
    if (updated.count === 1) return true
  }

  return false
}

function headerAdIsEligible(ad: {
  isActive: boolean
  startAt: Date | null
  endAt: Date | null
  daysOfWeek: string | null
  hourRange: string | null
}, now: Date) {
  if (!ad.isActive || !isWithinSchedule(ad, now)) return false
  if (ad.daysOfWeek && !ad.daysOfWeek.split(',').map(day => day.trim()).includes(String(now.getDay()))) return false
  if (ad.hourRange) {
    const match = ad.hourRange.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/)
    if (!match) return false
    const minutes = now.getHours() * 60 + now.getMinutes()
    const start = Number(match[1]) * 60 + Number(match[2])
    const end = Number(match[3]) * 60 + Number(match[4])
    if (minutes < start || minutes > end) return false
  }
  return true
}

export async function recordHeaderAdMetric(adId: string, action: AdMetricAction) {
  const ad = await db.headerAd.findUnique({
    where: { id: adId },
    select: { isActive: true, startAt: true, endAt: true, daysOfWeek: true, hourRange: true },
  })
  if (!ad || !headerAdIsEligible(ad, new Date())) return false
  await db.headerAd.update({
    where: { id: adId },
    data: action === 'impression' ? { impressions: { increment: 1 } } : { clicks: { increment: 1 } },
  })
  return true
}
