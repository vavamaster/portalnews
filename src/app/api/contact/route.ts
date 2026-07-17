import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { consumeRequestLimit } from '@/lib/request-rate-limit'

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(200, 'Nome muito longo'),
  email: z.string().trim().email('Email inválido').max(254).transform(value => value.toLowerCase()),
  phone: z.string().trim().max(50, 'Telefone muito longo').optional(),
  subject: z.string().trim().max(200, 'Assunto muito longo').optional(),
  message: z.string().trim().min(5, 'Mensagem muito curta').max(5000, 'Mensagem muito longa'),
  website: z.string().max(500).optional(), // honeypot: pessoas não veem este campo
})

// POST /api/contact — submit contact form
export async function POST(req: NextRequest) {
  try {
    const parsed = contactSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    const { name, email, phone, subject, message, website } = parsed.data
    if (website) return NextResponse.json({ ok: true })

    const rateLimit = await consumeRequestLimit(req, {
      scope: 'public-contact', subject: 'form', limit: 10, windowSeconds: 60 * 60,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Muitas mensagens enviadas. Tente novamente mais tarde.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    const user = await getCurrentUser(req)
    const contact = await db.contactMessage.create({
      data: {
        name,
        email,
        phone: phone || null,
        subject: subject || null,
        message,
        userId: user?.id || null,
      },
    })

    const admins = await db.user.findMany({
      where: { role: { in: ['MASTER', 'ADMIN'] } },
      select: { id: true },
    })
    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          type: 'SYSTEM',
          title: 'Nova mensagem de contato',
          message: `${name} enviou: ${subject || message.slice(0, 60)}`,
          link: 'admin',
        })),
      })
    }

    return NextResponse.json({ ok: true, id: contact.id })
  } catch (error) {
    console.error('[contact] unexpected error:', error)
    return NextResponse.json({ error: 'Não foi possível enviar a mensagem' }, { status: 500 })
  }
}
