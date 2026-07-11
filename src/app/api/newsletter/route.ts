import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

// POST /api/newsletter — subscribe to newsletter (single opt-in)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, name, source } = body
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()

    // Check if already subscribed
    const existing = await db.newsletterSubscriber.findUnique({ where: { email: cleanEmail } })
    if (existing) {
      if (existing.status === 'SUBSCRIBED') {
        return NextResponse.json({ ok: true, message: 'Você já está inscrito!' })
      }
      // Reactivate unsubscribed user
      await db.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { status: 'SUBSCRIBED', name: name || existing.name },
      })
      return NextResponse.json({ ok: true, message: 'Inscrição reativada!' })
    }

    // Try to link to existing user
    const user = await db.user.findUnique({ where: { email: cleanEmail } }).catch(() => null)

    // Generate confirm token (for future double opt-in if email infra is added)
    const confirmToken = crypto.randomBytes(32).toString('hex')

    await db.newsletterSubscriber.create({
      data: {
        email: cleanEmail,
        name: name || user?.name || null,
        userId: user?.id || null,
        source: source || 'home',
        confirmToken,
        confirmedAt: new Date(), // single opt-in for now
      },
    })

    return NextResponse.json({ ok: true, message: 'Inscrição realizada com sucesso!' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/newsletter — check subscription status (for current user)
export async function GET(req: NextRequest) {
  try {
    const { getCurrentUser } = await import('@/lib/session')
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ subscribed: false })

    const sub = await db.newsletterSubscriber.findUnique({ where: { email: user.email } })
    return NextResponse.json({
      subscribed: sub?.status === 'SUBSCRIBED',
      status: sub?.status || 'NONE',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
