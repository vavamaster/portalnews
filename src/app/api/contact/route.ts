import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// POST /api/contact — submit contact form
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, phone, subject, message } = body
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Nome, email e mensagem são obrigatórios' }, { status: 400 })
    }
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    if (message.length < 5) {
      return NextResponse.json({ error: 'Mensagem muito curta' }, { status: 400 })
    }

    const user = await getCurrentUser(req)

    const contact = await db.contactMessage.create({
      data: {
        name: String(name).slice(0, 200),
        email: String(email).toLowerCase().slice(0, 200),
        phone: phone ? String(phone).slice(0, 50) : null,
        subject: subject ? String(subject).slice(0, 200) : null,
        message: String(message).slice(0, 5000),
        userId: user?.id || null,
      },
    })

    // Notify admins
    const admins = await db.user.findMany({ where: { role: { in: ['MASTER', 'ADMIN'] } } })
    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          type: 'SYSTEM',
          title: 'Nova mensagem de contato',
          message: `${name} enviou: ${subject || message.slice(0, 60)}`,
          link: 'admin',
        })),
      })
    }

    return NextResponse.json({ ok: true, id: contact.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
