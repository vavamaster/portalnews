import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { createSession, setSessionCookie } from '@/lib/session'
import { generateReferralCode } from '@/lib/achievements'
import { getSiteNameAsync } from '@/lib/seo-helpers'
import { defaultAvatar } from '@/lib/utils'
import { consumeRequestLimit } from '@/lib/request-rate-limit'

const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Informe um nome válido').max(120, 'Nome muito longo'),
  email: z.string().trim().email('Informe um email válido').max(254).transform(value => value.toLowerCase()),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres').max(200, 'Senha muito longa'),
  referralCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/).optional().or(z.literal('')),
})

async function uniqueReferralCode(name: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode(`${name}${attempt || ''}`)
    const existing = await db.user.findUnique({ where: { referralCode: code }, select: { id: true } })
    if (!existing) return code
  }
  throw new Error('REFERRAL_CODE_UNAVAILABLE')
}

export async function POST(req: NextRequest) {
  try {
    const parsed = registrationSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dados de cadastro inválidos' }, { status: 400 })
    }
    const { name, email, password, referralCode } = parsed.data

    const rateLimit = await consumeRequestLimit(req, {
      scope: 'auth-register',
      subject: email,
      limit: 5,
      windowSeconds: 60 * 60,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })

    let referredById: string | null = null
    if (referralCode) {
      const referrer = await db.user.findUnique({ where: { referralCode }, select: { id: true } })
      referredById = referrer?.id || null
    }

    const hashed = await hashPassword(password)
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: 'READER',
        avatar: defaultAvatar(name),
        referralCode: await uniqueReferralCode(name),
        referredById,
      },
    })

    if (referredById) {
      await db.notification.create({
        data: {
          userId: referredById,
          type: 'REFERRAL',
          title: 'Novo indicado cadastrado!',
          message: `${name} se cadastrou com seu código. Quando publicar o primeiro anúncio, você ganha 50 pontos.`,
          link: 'profile',
        },
      }).catch(error => console.error('[auth register] referral notification failed:', error))
    }

    const siteName = await getSiteNameAsync()
    await db.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: `Bem-vindo ao ${siteName}, ${name}!`,
        message: 'Complete seu perfil, leia notícias e ganhe pontos. Use o cupom BEMVINDO10 na primeira assinatura.',
        link: 'profile',
      },
    }).catch(error => console.error('[auth register] welcome notification failed:', error))

    const token = await createSession(user.id)
    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        points: user.points,
        credits: user.credits,
        referralCode: user.referralCode,
        referredById: user.referredById,
      },
    })
    res.headers.set('set-cookie', setSessionCookie(token, req))
    return res
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Email ou código de indicação já cadastrado' }, { status: 409 })
    }
    console.error('[auth register] unexpected error:', error)
    return NextResponse.json({ error: 'Não foi possível concluir o cadastro' }, { status: 500 })
  }
}
