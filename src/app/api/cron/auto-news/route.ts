import { NextRequest, NextResponse } from 'next/server'
import { runScheduledNews } from '@/lib/auto-news'

export const maxDuration = 300 // 5 minutes

// GET /api/cron/auto-news — called by external cron (every hour)
// Supports auth via header CRON_SECRET for production
export async function GET(req: NextRequest) {
  // C3 fix: require CRON_SECRET always (no bypass when absent)
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('key')
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 })
  }
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const result = await runScheduledNews()
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error('[AutoNews Cron] Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
