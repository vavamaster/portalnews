import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { refreshAllQuotes } from '@/lib/quotes'
import { handleApiError } from '@/lib/api-helpers'
import { requireCronBearer } from '@/lib/cron-auth'

export const maxDuration = 60

// POST /api/quotes/refresh - manually trigger refresh (admin) or cron job
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    const isAdmin = !!user && ['MASTER', 'ADMIN'].includes(user.role)
    if (!isAdmin) {
      const authError = requireCronBearer(req, { missingStatus: 401 })
      if (authError) return authError
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
