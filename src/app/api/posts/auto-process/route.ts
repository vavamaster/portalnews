import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { processAutoActions } from '@/lib/editors'

// POST /api/posts/auto-process - process expired pending posts (cron-style)
// Can be called by external cron or manually by admin
export async function POST(req: NextRequest) {
  try {
    // Optional auth - if auth provided, must be admin
    const user = await getCurrentUser(req)
    if (user && !['MASTER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    const result = await processAutoActions()
    return NextResponse.json({
      ok: true,
      ...result,
      message: `${result.approved} auto-aprovado(s), ${result.rejected} auto-rejeitado(s)`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
