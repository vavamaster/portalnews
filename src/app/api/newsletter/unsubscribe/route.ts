import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/newsletter/unsubscribe?token=... — unsubscribe
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')

  if (token) {
    const sub = await db.newsletterSubscriber.findFirst({ where: { confirmToken: token } })
    if (!sub) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    await db.newsletterSubscriber.update({
      where: { id: sub.id },
      data: { status: 'UNSUBSCRIBED' },
    })
    return NextResponse.json({ ok: true, message: 'Inscrição cancelada.' })
  }

  if (email) {
    const sub = await db.newsletterSubscriber.findUnique({ where: { email: email.toLowerCase() } })
    if (!sub) return NextResponse.json({ error: 'Email não encontrado' }, { status: 404 })
    await db.newsletterSubscriber.update({
      where: { id: sub.id },
      data: { status: 'UNSUBSCRIBED' },
    })
    return NextResponse.json({ ok: true, message: 'Inscrição cancelada.' })
  }

  return NextResponse.json({ error: 'Token ou email obrigatório' }, { status: 400 })
}
