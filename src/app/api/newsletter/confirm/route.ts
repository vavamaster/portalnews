import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/newsletter/confirm?token=... — confirm subscription (double opt-in)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const sub = await db.newsletterSubscriber.findFirst({ where: { confirmToken: token } })
  if (!sub) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })

  await db.newsletterSubscriber.update({
    where: { id: sub.id },
    data: { confirmedAt: new Date(), status: 'SUBSCRIBED' },
  })

  return NextResponse.json({ ok: true, message: 'Inscrição confirmada!' })
}
