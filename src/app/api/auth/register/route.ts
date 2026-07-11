import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { createSession, setSessionCookie } from '@/lib/session'
import { generateReferralCode } from '@/lib/achievements'
import { getSiteNameAsync } from '@/lib/seo-helpers'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, referralCode } = await req.json()
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
    }
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
    }

    // Resolve referral code if provided
    let referredById: string | null = null
    if (referralCode) {
      const referrer = await db.user.findUnique({ where: { referralCode: referralCode.toUpperCase() } })
      if (referrer) referredById = referrer.id
    }

    const hashed = await hashPassword(password)
    const userReferralCode = generateReferralCode(name)

    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashed,
        role: 'READER',
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=2563eb&textColor=fff`,
        referralCode: userReferralCode,
        referredById,
      },
    })

    // If referred, notify referrer
    if (referredById) {
      await db.notification.create({
        data: {
          userId: referredById,
          type: 'REFERRAL',
          title: 'Novo indicado cadastrado!',
          message: `${name} se cadastrou com seu código. Quando ele publicar o 1º anúncio, você ganha 50 pontos!`,
          link: 'profile',
        },
      })
    }

    // Welcome notification — uses the admin-configured site name (dynamic, not hardcoded)
    const siteName = await getSiteNameAsync()
    await db.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: `Bem-vindo ao ${siteName}, ${name}!`,
        message: 'Complete seu perfil, leia notícias e ganhe pontos. Use o cupom BEMVINDO10 na 1ª assinatura!',
        link: 'profile',
      },
    })

    // Auto-grant FIRST_READ if eligible (will be checked later)
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
    res.headers.set('set-cookie', setSessionCookie(token))
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
