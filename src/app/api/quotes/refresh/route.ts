import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { refreshAllQuotes } from '@/lib/quotes'
import { handleApiError } from '@/lib/api-helpers'

export const maxDuration = 60

// POST /api/quotes/refresh - manually trigger refresh (admin) or cron job
export async function POST(req: NextRequest) {
  try {
    // Auth optional - if provided, must be admin; if not, allow (for cron)
    const user = await getCurrentUser(req)
    if (user && !['MASTER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
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
