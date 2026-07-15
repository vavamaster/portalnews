import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { createSession, setSessionCookie } from '@/lib/session'
import { clearLoginFailures, loginBlockStatus, recordLoginFailure } from '@/lib/login-throttle'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json().catch(() => ({}))
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 254 || password.length > 200) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }
    const normalizedEmail = email.trim().toLowerCase()
    const throttle = await loginBlockStatus(req, normalizedEmail)
    if (throttle.blocked) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } },
      )
    }
    const user = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (!user || !user.password) {
      await recordLoginFailure(throttle.key)
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }
    const ok = await verifyPassword(password, user.password)
    if (!ok) {
      const retryAfter = await recordLoginFailure(throttle.key)
      if (retryAfter > 0) {
        return NextResponse.json(
          { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        )
      }
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }
    await clearLoginFailures(throttle.key)
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
        lastCheckInAt: user.lastCheckInAt,
        checkInStreak: user.checkInStreak,
        verificationStatus: user.verificationStatus,
        referralCode: user.referralCode,
      },
    })
    res.headers.set('set-cookie', setSessionCookie(token, req))
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
