import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { createSession, setSessionCookie } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }
    const ok = await verifyPassword(password, user.password)
    if (!ok) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }
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
    res.headers.set('set-cookie', setSessionCookie(token))
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
