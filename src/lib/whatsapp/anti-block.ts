/**
 * Anti-block helpers — central logic for WhatsApp anti-banishment protection.
 *
 * Principles (based on WhatsApp's anti-spam heuristics):
 * 1. Rate limiting: never exceed X messages/hour or Y/day per chip
 * 2. Random delays: 30-90s between sends (mimics human behavior)
 * 3. Quiet hours: no sends 22h-08h (recipients asleep = no read = spam signal)
 * 4. Warmup: new chips ramp up gradually (day 1: 10 msgs, day 2: 20, ...)
 * 5. Bounce protection: auto-pause if bounce rate > X%
 * 6. Error circuit breaker: pause after N consecutive errors
 * 7. Message variants: vary wording slightly to avoid pattern detection
 * 8. Daily cap per campaign: spread large sends across multiple days
 */

import { db } from '../db'

export interface AntiBlockConfig {
  maxPerHour: number
  maxPerDay: number
  delayMinMs: number
  delayMaxMs: number
  quietHoursStart: number // 0-23
  quietHoursEnd: number   // 0-23
  maxBounceRate: number   // %
  warmupEnabled: boolean
  warmupDays: number
  warmupStartCount: number
  autoPauseOnError: boolean
  errorThreshold: number
  requireOptOutFooter: boolean
  optOutFooterText: string
  enableVariants: boolean
}

const DEFAULT_CONFIG: AntiBlockConfig = {
  maxPerHour: 50,
  maxPerDay: 200,
  delayMinMs: 30_000,
  delayMaxMs: 90_000,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  maxBounceRate: 10,
  warmupEnabled: true,
  warmupDays: 7,
  warmupStartCount: 10,
  autoPauseOnError: true,
  errorThreshold: 5,
  requireOptOutFooter: true,
  optOutFooterText: '\n\nResponda PARAR para sair.',
  enableVariants: true,
}

/** Load anti-block config from DB (singleton). */
export async function getAntiBlockConfig(): Promise<AntiBlockConfig> {
  const row = await db.whatsAppAntiBlockConfig.findFirst()
  if (!row) return DEFAULT_CONFIG
  return {
    maxPerHour: row.maxPerHour,
    maxPerDay: row.maxPerDay,
    delayMinMs: row.delayMinMs,
    delayMaxMs: row.delayMaxMs,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    maxBounceRate: row.maxBounceRate,
    warmupEnabled: row.warmupEnabled,
    warmupDays: row.warmupDays,
    warmupStartCount: row.warmupStartCount,
    autoPauseOnError: row.autoPauseOnError,
    errorThreshold: row.errorThreshold,
    requireOptOutFooter: row.requireOptOutFooter,
    optOutFooterText: row.optOutFooterText,
    enableVariants: row.enableVariants,
  }
}

/** Update anti-block config (admin only). */
export async function updateAntiBlockConfig(data: Partial<AntiBlockConfig>): Promise<AntiBlockConfig> {
  const existing = await db.whatsAppAntiBlockConfig.findFirst()
  const merged = { ...DEFAULT_CONFIG, ...data }
  const dbData = {
    maxPerHour: Math.max(1, Math.min(500, merged.maxPerHour)),
    maxPerDay: Math.max(1, Math.min(2000, merged.maxPerDay)),
    delayMinMs: Math.max(1000, Math.min(600_000, merged.delayMinMs)),
    delayMaxMs: Math.max(merged.delayMinMs, Math.min(600_000, merged.delayMaxMs)),
    quietHoursStart: Math.max(0, Math.min(23, merged.quietHoursStart)),
    quietHoursEnd: Math.max(0, Math.min(23, merged.quietHoursEnd)),
    maxBounceRate: Math.max(0, Math.min(100, merged.maxBounceRate)),
    warmupEnabled: merged.warmupEnabled,
    warmupDays: Math.max(1, Math.min(30, merged.warmupDays)),
    warmupStartCount: Math.max(1, Math.min(100, merged.warmupStartCount)),
    autoPauseOnError: merged.autoPauseOnError,
    errorThreshold: Math.max(1, Math.min(50, merged.errorThreshold)),
    requireOptOutFooter: merged.requireOptOutFooter,
    optOutFooterText: merged.optOutFooterText,
    enableVariants: merged.enableVariants,
  }
  if (existing) {
    await db.whatsAppAntiBlockConfig.update({ where: { id: existing.id }, data: dbData })
  } else {
    await db.whatsAppAntiBlockConfig.create({ data: dbData })
  }
  return merged
}

/**
 * Check if we're currently in quiet hours (no sends allowed).
 * Handles wrap-around (e.g., 22-8 means 22h to 8h next day).
 */
export function isInQuietHours(now: Date, cfg: AntiBlockConfig): boolean {
  const hour = now.getHours()
  if (cfg.quietHoursStart === cfg.quietHoursEnd) return false
  if (cfg.quietHoursStart < cfg.quietHoursEnd) {
    // Same day (e.g., 2-5)
    return hour >= cfg.quietHoursStart && hour < cfg.quietHoursEnd
  }
  // Wraps midnight (e.g., 22-8)
  return hour >= cfg.quietHoursStart || hour < cfg.quietHoursEnd
}

/**
 * Get the next time sends are allowed (end of quiet hours).
 * Returns null if currently allowed.
 */
export function getNextAllowedTime(now: Date, cfg: AntiBlockConfig): Date | null {
  if (!isInQuietHours(now, cfg)) return null
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(cfg.quietHoursEnd, 0, 0, 0)
  // If quietHoursEnd is after current hour (same day), use today
  const today = new Date(now)
  today.setHours(cfg.quietHoursEnd, 0, 0, 0)
  if (today > now) return today
  return tomorrow
}

/**
 * Count messages sent in the last hour and last day.
 * Used to enforce rate limits.
 */
export async function getRecentSendCounts(): Promise<{ lastHour: number; lastDay: number }> {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 3600_000)
  const oneDayAgo = new Date(now.getTime() - 86400_000)
  const [lastHour, lastDay] = await Promise.all([
    db.whatsAppMessage.count({
      where: { direction: 'OUTGOING', createdAt: { gte: oneHourAgo } },
    }),
    db.whatsAppMessage.count({
      where: { direction: 'OUTGOING', createdAt: { gte: oneDayAgo } },
    }),
  ])
  return { lastHour, lastDay }
}

/**
 * Get warmup cap for the chip based on its age.
 * Day 1: warmupStartCount, Day 2: warmupStartCount * 2, ..., capped at maxPerDay.
 * Returns null if warmup is disabled or chip is older than warmupDays.
 */
export async function getWarmupCap(cfg: AntiBlockConfig): Promise<number | null> {
  if (!cfg.warmupEnabled) return null
  const waConfig = await db.whatsAppConfig.findFirst()
  if (!waConfig?.lastConnectedAt) return cfg.warmupStartCount // brand new chip = day 1
  const daysConnected = Math.floor((Date.now() - new Date(waConfig.lastConnectedAt).getTime()) / 86400_000)
  if (daysConnected >= cfg.warmupDays) return null // warmup period over
  const dayNumber = daysConnected + 1
  const cap = Math.min(cfg.warmupStartCount * dayNumber, cfg.maxPerDay)
  return cap
}

/**
 * Check if we can send now (rate limits + quiet hours + warmup).
 * Returns { allowed: boolean, reason?: string, retryAfterMs?: number }.
 */
export async function canSendNow(cfg?: AntiBlockConfig): Promise<{
  allowed: boolean
  reason?: string
  retryAfterMs?: number
}> {
  const config = cfg || await getAntiBlockConfig()
  const now = new Date()

  // 1. Quiet hours check
  if (isInQuietHours(now, config)) {
    const next = getNextAllowedTime(now, config)
    return {
      allowed: false,
      reason: `Fora do horário permitido (quiet hours ${config.quietHoursStart}h-${config.quietHoursEnd}h)`,
      retryAfterMs: next ? next.getTime() - now.getTime() : 3600_000,
    }
  }

  // 2. Rate limit checks
  const counts = await getRecentSendCounts()
  if (counts.lastHour >= config.maxPerHour) {
    return {
      allowed: false,
      reason: `Limite por hora atingido (${counts.lastHour}/${config.maxPerHour})`,
      retryAfterMs: 3600_000,
    }
  }
  if (counts.lastDay >= config.maxPerDay) {
    return {
      allowed: false,
      reason: `Limite diário atingido (${counts.lastDay}/${config.maxPerDay})`,
      retryAfterMs: 86400_000 - (Date.now() % 86400_000),
    }
  }

  // 3. Warmup cap check
  const warmupCap = await getWarmupCap(config)
  if (warmupCap !== null && counts.lastDay >= warmupCap) {
    return {
      allowed: false,
      reason: `Warmup: chip novo, limite diário reduzido (${counts.lastDay}/${warmupCap})`,
      retryAfterMs: 86400_000 - (Date.now() % 86400_000),
    }
  }

  return { allowed: true }
}

/**
 * Get a random delay between min and max (human-like behavior).
 */
export function getRandomDelay(cfg: AntiBlockConfig): number {
  return Math.floor(Math.random() * (cfg.delayMaxMs - cfg.delayMinMs + 1)) + cfg.delayMinMs
}

/**
 * Apply opt-out footer to a message (compliance).
 */
export function applyOptOutFooter(message: string, cfg: AntiBlockConfig): string {
  if (!cfg.requireOptOutFooter) return message
  if (message.includes('PARAR')) return message // already has footer
  return message + cfg.optOutFooterText
}

/**
 * Generate message variants for A/B testing.
 * Variants change emoji + wording slightly to avoid pattern detection.
 */
export function generateMessageVariants(baseMessage: string, count: number = 2): string[] {
  const emojiPrefixes = ['📰', '🔔', '📲', '⚡', '🔥']
  const greetings = ['', 'Olá! ', 'Oi! ', '']
  const closings = ['', 'Abraço!', 'Até mais!', '👍', '']

  const variants: string[] = [baseMessage]
  for (let i = 1; i < count; i++) {
    const emoji = emojiPrefixes[i % emojiPrefixes.length]
    const greeting = greetings[i % greetings.length]
    const closing = closings[i % closings.length]
    let variant = baseMessage
    // Add greeting if not present
    if (greeting && !variant.startsWith('Olá') && !variant.startsWith('Oi')) {
      variant = `${greeting}${variant}`
    }
    // Add emoji prefix if base doesn't have one
    if (emoji && !variant.startsWith(emoji)) {
      variant = `${emoji} ${variant}`
    }
    // Add closing
    if (closing && !variant.endsWith(closing)) {
      variant = `${variant}\n\n${closing}`
    }
    variants.push(variant)
  }
  return variants
}

/**
 * Replace template variables in a message.
 * Variables: {{name}}, {{title}}, {{link}}, {{category}}, {{phone}}
 */
export function renderTemplate(
  template: string,
  vars: { name?: string | null; title?: string | null; link?: string | null; category?: string | null; phone?: string | null }
): string {
  return template
    .replace(/\{\{name\}\}/g, vars.name || '')
    .replace(/\{\{title\}\}/g, vars.title || '')
    .replace(/\{\{link\}\}/g, vars.link || '')
    .replace(/\{\{category\}\}/g, vars.category || '')
    .replace(/\{\{phone\}\}/g, vars.phone || '')
}

/**
 * Check if a campaign should be auto-paused based on recent error rate.
 */
export async function shouldAutoPause(campaignId: string, cfg: AntiBlockConfig): Promise<{
  shouldPause: boolean
  reason?: string
}> {
  if (!cfg.autoPauseOnError) return { shouldPause: false }

  // Check consecutive errors (last N recipients)
  const recentRecipients = await db.whatsAppCampaignRecipient.findMany({
    where: { campaignId },
    orderBy: { createdAt: 'desc' },
    take: cfg.errorThreshold,
    select: { status: true },
  })

  const recentErrors = recentRecipients.filter(r => r.status === 'FAILED').length
  if (recentRecipients.length >= cfg.errorThreshold && recentErrors === recentRecipients.length) {
    return {
      shouldPause: true,
      reason: `${cfg.errorThreshold} erros consecutivos — auto-pausado para proteção do chip`,
    }
  }

  // Check bounce rate (overall campaign)
  const total = await db.whatsAppCampaignRecipient.count({
    where: { campaignId, status: { in: ['SENT', 'DELIVERED', 'READ', 'FAILED'] } },
  })
  if (total >= 20) { // only check after 20+ sends for statistical significance
    const failed = await db.whatsAppCampaignRecipient.count({
      where: { campaignId, status: 'FAILED' },
    })
    const bounceRate = (failed / total) * 100
    if (bounceRate > cfg.maxBounceRate) {
      return {
        shouldPause: true,
        reason: `Taxa de bounce ${bounceRate.toFixed(1)}% > limite ${cfg.maxBounceRate}% — auto-pausado`,
      }
    }
  }

  return { shouldPause: false }
}
