import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(path.resolve('.env')) } catch {}
}

const db = new PrismaClient()
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'
const cronSecret = process.env.CRON_SECRET
assert.ok(cronSecret, 'CRON_SECRET deve estar configurado')
const suffix = crypto.randomBytes(8).toString('hex')
const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
let userId = ''

try {
  const user = await db.user.create({ data: { email: `maintenance-${suffix}@invalid.local`, name: 'Teste manutenção' } })
  userId = user.id
  await Promise.all([
    db.session.create({ data: { userId, token: `expired-${suffix}`, expiresAt: old } }),
    db.adTrackingReceipt.create({ data: { key: `expired-${suffix}`, expiresAt: old } }),
    db.loginThrottle.create({ data: { key: `stale-${suffix}`, attempts: 1, lastAttemptAt: old } }),
    db.whatsAppOtp.create({ data: { phoneNumber: `5500${suffix.slice(0, 8)}`, code: '000000', expiresAt: old } }),
    db.pageView.create({
      data: {
        sessionId: `session-${suffix}`,
        visitorId: `visitor-${suffix}`,
        path: '/maintenance-test',
        ipHash: suffix,
        viewedAt: old,
        createdAt: old,
      },
    }),
  ])

  const unauthorized = await fetch(`${baseUrl}/api/cron/maintenance`)
  assert.equal(unauthorized.status, 401)
  const response = await fetch(`${baseUrl}/api/cron/maintenance`, {
    headers: { authorization: `Bearer ${cronSecret}` },
  })
  assert.equal(response.status, 200, await response.text())

  const [session, receipt, throttle, otp, pageView] = await Promise.all([
    db.session.findUnique({ where: { token: `expired-${suffix}` } }),
    db.adTrackingReceipt.findUnique({ where: { key: `expired-${suffix}` } }),
    db.loginThrottle.findUnique({ where: { key: `stale-${suffix}` } }),
    db.whatsAppOtp.findFirst({ where: { phoneNumber: `5500${suffix.slice(0, 8)}` } }),
    db.pageView.findFirst({ where: { sessionId: `session-${suffix}` } }),
  ])
  assert.deepEqual([session, receipt, throttle, otp, pageView], [null, null, null, null, null])
  console.log('Database maintenance cleanup passed.')
} finally {
  await db.pageView.deleteMany({ where: { sessionId: `session-${suffix}` } })
  await db.loginThrottle.deleteMany({ where: { key: `stale-${suffix}` } })
  await db.adTrackingReceipt.deleteMany({ where: { key: `expired-${suffix}` } })
  await db.whatsAppOtp.deleteMany({ where: { phoneNumber: `5500${suffix.slice(0, 8)}` } })
  if (userId) await db.user.deleteMany({ where: { id: userId } })
  await db.$disconnect()
}
