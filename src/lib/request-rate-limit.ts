import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import { db } from './db'
import { getSecuritySecret } from './security-secret'

interface RequestLimitOptions {
  scope: string
  subject?: string
  limit: number
  windowSeconds: number
  includeIp?: boolean
}

function clientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

function requestLimitKey(req: NextRequest, options: RequestLimitOptions) {
  const secret = getSecuritySecret('AUTH_THROTTLE_SECRET')
  const identity = `${options.scope}:${options.includeIp === false ? '' : clientIp(req)}:${options.subject || ''}`
  return crypto.createHmac('sha256', secret).update(identity).digest('hex')
}

export async function consumeRequestLimit(req: NextRequest, options: RequestLimitOptions) {
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.windowSeconds < 1) {
    throw new Error('Invalid request limit configuration')
  }

  const key = requestLimitKey(req, options)
  const now = new Date()
  const windowMs = options.windowSeconds * 1000
  if (Math.random() < 0.01) {
    const staleBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    void db.loginThrottle.deleteMany({
      where: {
        lastAttemptAt: { lt: staleBefore },
        OR: [{ blockedUntil: null }, { blockedUntil: { lt: now } }],
      },
    }).catch(error => console.error('[rate-limit] cleanup failed:', error))
  }
  const existing = await db.loginThrottle.findUnique({ where: { key } })
  const activeBlockSeconds = existing?.blockedUntil
    ? Math.ceil((existing.blockedUntil.getTime() - now.getTime()) / 1000)
    : 0
  if (activeBlockSeconds > 0) {
    return { allowed: false, retryAfter: activeBlockSeconds, remaining: 0 }
  }

  const resetWindow = !existing || now.getTime() - existing.lastAttemptAt.getTime() >= windowMs
  const row = await db.loginThrottle.upsert({
    where: { key },
    create: { key, attempts: 1, lastAttemptAt: now, blockedUntil: null },
    update: resetWindow
      ? { attempts: 1, lastAttemptAt: now, blockedUntil: null }
      : { attempts: { increment: 1 }, lastAttemptAt: now, blockedUntil: null },
  })

  if (row.attempts > options.limit) {
    const blockedUntil = new Date(now.getTime() + windowMs)
    await db.loginThrottle.update({ where: { key }, data: { blockedUntil } })
    return { allowed: false, retryAfter: options.windowSeconds, remaining: 0 }
  }

  return { allowed: true, retryAfter: 0, remaining: Math.max(0, options.limit - row.attempts) }
}
