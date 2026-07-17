import crypto from 'crypto'
import { NextResponse } from 'next/server'

export function requireCronBearer(req: Request, options: { missingStatus?: number } = {}) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[cron auth] CRON_SECRET não configurado')
    return NextResponse.json(
      { error: options.missingStatus === 401 ? 'Não autorizado' : 'CRON_SECRET não configurado' },
      { status: options.missingStatus || 500 },
    )
  }

  const authorization = req.headers.get('authorization') || ''
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  if (
    expectedBuffer.length !== providedBuffer.length
    || expectedBuffer.length === 0
    || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  return null
}
