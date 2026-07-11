import { NextRequest, NextResponse } from 'next/server'
import { runScheduledNews } from '@/lib/auto-news'

export const maxDuration = 300 // 5 minutes

// GET /api/cron/auto-news — called by external cron (every hour)
// Supports auth via header CRON_SECRET for production
export async function GET(req: NextRequest) {
  // Optional: check secret for production
  const secret = req.headers.get('x-cron-secret')
  const expectedSecret = process.env.CRON_SECRET
  if (expectedSecret && secret !== expectedSecret) {
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
