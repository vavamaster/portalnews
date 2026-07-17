import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { z } from 'zod'
import { handleApiError } from '@/lib/api-helpers'
import { consumeRequestLimit } from '@/lib/request-rate-limit'

const subscriptionSchema = z.object({
  email: z.string().trim().email('Email inválido').max(254).transform(value => value.toLowerCase()),
  name: z.string().trim().max(120, 'Nome muito longo').optional(),
  source: z.string().trim().max(80, 'Origem inválida').optional(),
})

// POST /api/newsletter — subscribe to newsletter (single opt-in)
export async function POST(req: NextRequest) {
  try {
    const parsed = subscriptionSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    const { email: cleanEmail, name, source } = parsed.data

    const ipLimit = await consumeRequestLimit(req, {
      scope: 'newsletter-ip', subject: 'subscribe', limit: 10, windowSeconds: 60 * 60,
    })
    const emailLimit = await consumeRequestLimit(req, {
      scope: 'newsletter-email', subject: cleanEmail, includeIp: false, limit: 3, windowSeconds: 60 * 60,
    })
    if (!ipLimit.allowed || !emailLimit.allowed) {
      const retryAfter = Math.max(ipLimit.retryAfter, emailLimit.retryAfter)
      return NextResponse.json(
        { error: 'Muitas solicitações de inscrição. Tente novamente mais tarde.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      )
    }

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
    return handleApiError(e, 'newsletter subscribe')
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
    return handleApiError(e, 'newsletter status')
  }
}
