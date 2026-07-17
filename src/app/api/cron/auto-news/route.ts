import { NextRequest, NextResponse } from 'next/server'
import { runScheduledNews } from '@/lib/auto-news'
import { requireCronBearer } from '@/lib/cron-auth'

export const maxDuration = 300 // 5 minutes

// GET /api/cron/auto-news — called by external cron (every hour)
// Authentication: Authorization: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const authError = requireCronBearer(req)
  if (authError) return authError

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
