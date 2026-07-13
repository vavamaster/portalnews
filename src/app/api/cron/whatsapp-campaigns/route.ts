import { NextRequest, NextResponse } from 'next/server'
import { processPendingCampaigns } from '@/lib/whatsapp/campaign-processor'

/**
 * Cron: process WhatsApp campaigns every 5 minutes.
 *
 * Auth: ?key=CRON_SECRET or Authorization: Bearer CRON_SECRET
 *
 * - Activates SCHEDULED campaigns whose scheduledAt has passed
 * - Sends batches of PENDING recipients for SENDING campaigns
 * - Respects anti-block rules (rate limit, quiet hours, warmup)
 * - Auto-pauses on high error/bounce rate
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const queryKey = url.searchParams.get('key')
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 })
  }
  const providedKey = queryKey || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '')
  if (!providedKey || providedKey.length !== cronSecret.length || providedKey !== cronSecret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const result = await processPendingCampaigns()
  return NextResponse.json({
    ok: true,
    ...result,
    timestamp: new Date().toISOString(),
  })
}
