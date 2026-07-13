import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrRespond, handleApiError } from '@/lib/api-helpers'
import { getAntiBlockConfig, updateAntiBlockConfig } from '@/lib/whatsapp/anti-block'
import { canSendNow, getRecentSendCounts, getWarmupCap } from '@/lib/whatsapp/anti-block'

// GET /api/admin/whatsapp/antiblock — current config + live status
export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdminOrRespond(req)
    if (response) return response

    const cfg = await getAntiBlockConfig()
    const [sendCheck, counts, warmupCap] = await Promise.all([
      canSendNow(cfg),
      getRecentSendCounts(),
      getWarmupCap(cfg),
    ])

    return NextResponse.json({
      config: cfg,
      liveStatus: {
        canSendNow: sendCheck.allowed,
        reason: sendCheck.reason,
        retryAfterMs: sendCheck.retryAfterMs,
        sentLastHour: counts.lastHour,
        sentLastDay: counts.lastDay,
        warmupCap,
      },
    })
  } catch (e: any) {
    return handleApiError(e, 'antiblock GET')
  }
}

// POST /api/admin/whatsapp/antiblock — update config
export async function POST(req: NextRequest) {
  try {
    const { response } = await requireAdminOrRespond(req)
    if (response) return response

    const body = await req.json().catch(() => ({}))
    const updated = await updateAntiBlockConfig(body)
    return NextResponse.json({ ok: true, config: updated })
  } catch (e: any) {
    return handleApiError(e, 'antiblock POST')
  }
}
