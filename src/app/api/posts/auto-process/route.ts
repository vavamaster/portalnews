import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { processAutoActions } from '@/lib/editors'

// POST /api/posts/auto-process - process expired pending posts (cron-style)
// Can be called by external cron or manually by admin
export async function POST(req: NextRequest) {
  try {
    // X7 fix: Require either admin auth OR CRON_SECRET
    const user = await getCurrentUser(req)
    const cronKey = new URL(req.url).searchParams.get('key')
    const cronSecret = process.env.CRON_SECRET

    if (user && !['MASTER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    // If no authenticated admin, require CRON_SECRET
    if (!user) {
      if (!cronSecret) {
        return NextResponse.json({ error: 'Autenticação necessária (admin ou CRON_SECRET)' }, { status: 401 })
      }
      if (cronKey !== cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET inválido' }, { status: 401 })
      }
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
