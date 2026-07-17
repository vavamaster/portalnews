import { NextRequest, NextResponse } from 'next/server'
import { processPendingCampaigns } from '@/lib/whatsapp/campaign-processor'
import { requireCronBearer } from '@/lib/cron-auth'

/**
 * Cron: process WhatsApp campaigns every 5 minutes.
 *
 * Auth: Authorization: Bearer CRON_SECRET
 *
 * - Activates SCHEDULED campaigns whose scheduledAt has passed
 * - Sends batches of PENDING recipients for SENDING campaigns
 * - Respects anti-block rules (rate limit, quiet hours, warmup)
 * - Auto-pauses on high error/bounce rate
 */
export async function GET(req: NextRequest) {
  const authError = requireCronBearer(req)
  if (authError) return authError

  const result = await processPendingCampaigns()
  return NextResponse.json({
    ok: true,
    ...result,
    timestamp: new Date().toISOString(),
  })
}
