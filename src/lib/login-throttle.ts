import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import { db } from './db'
import { getSecuritySecret } from './security-secret'

function throttleKey(req: NextRequest, email: string) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  const secret = getSecuritySecret('AUTH_THROTTLE_SECRET')
  return crypto.createHmac('sha256', secret).update(`${ip}:${email}`).digest('hex')
}

export async function loginBlockStatus(req: NextRequest, email: string) {
  const key = throttleKey(req, email)
  const row = await db.loginThrottle.findUnique({ where: { key } })
  const retryAfter = row?.blockedUntil ? Math.ceil((row.blockedUntil.getTime() - Date.now()) / 1000) : 0
  return { key, blocked: retryAfter > 0, retryAfter: Math.max(0, retryAfter) }
}

export async function recordLoginFailure(key: string) {
  const row = await db.loginThrottle.upsert({
    where: { key },
    create: { key, attempts: 1 },
    update: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
  })
  if (row.attempts < 5) return 0
  const seconds = Math.min(30 * 60, 60 * 2 ** Math.min(5, row.attempts - 5))
  await db.loginThrottle.update({
    where: { key },
    data: { blockedUntil: new Date(Date.now() + seconds * 1000) },
  })
  return seconds
}

export async function clearLoginFailures(key: string) {
  await db.loginThrottle.deleteMany({ where: { key } })
}
