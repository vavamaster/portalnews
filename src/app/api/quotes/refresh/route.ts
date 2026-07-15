import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { refreshAllQuotes } from '@/lib/quotes'
import { handleApiError } from '@/lib/api-helpers'
import crypto from 'crypto'

export const maxDuration = 60

// POST /api/quotes/refresh - manually trigger refresh (admin) or cron job
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    const isAdmin = !!user && ['MASTER', 'ADMIN'].includes(user.role)
    if (!isAdmin) {
      const secret = process.env.CRON_SECRET
      if (!secret) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      const authHeader = req.headers.get('authorization')
      const provided = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : new URL(req.url).searchParams.get('key') || ''
      const expectedBuffer = Buffer.from(secret)
      const providedBuffer = Buffer.from(provided)
      if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
    }

    const result = await refreshAllQuotes()

    return NextResponse.json({
      ok: true,
      ...result,
      message: `${result.success} atualizadas, ${result.fallback} via cache, ${result.failed} falharam`,
    })
  } catch (e: any) {
    return handleApiError(e, 'quotes refresh')
  }
}
