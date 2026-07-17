import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCronBearer } from '@/lib/cron-auth'

export async function GET(req: NextRequest) {
  const denied = requireCronBearer(req)
  if (denied) return denied

  const now = new Date()
  const staleThrottleAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const usedOtpAt = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const configuredRetention = Number.parseInt(process.env.ANALYTICS_RETENTION_DAYS || '365', 10)
  const retentionDays = Number.isFinite(configuredRetention)
    ? Math.min(3650, Math.max(30, configuredRetention))
    : 365
  const analyticsCutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)

  const [sessions, trackingReceipts, throttles, whatsappOtps, pageViews] = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.adTrackingReceipt.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.loginThrottle.deleteMany({
      where: {
        lastAttemptAt: { lt: staleThrottleAt },
        OR: [{ blockedUntil: null }, { blockedUntil: { lt: now } }],
      },
    }),
    db.whatsAppOtp.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { isUsed: true, createdAt: { lt: usedOtpAt } },
        ],
      },
    }),
    db.pageView.deleteMany({ where: { viewedAt: { lt: analyticsCutoff } } }),
  ])

  return NextResponse.json({
    ok: true,
    retentionDays,
    deleted: {
      sessions: sessions.count,
      trackingReceipts: trackingReceipts.count,
      throttles: throttles.count,
      whatsappOtps: whatsappOtps.count,
      pageViews: pageViews.count,
    },
    at: now.toISOString(),
  })
}
