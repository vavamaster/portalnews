import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { defaultAvatar } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const users = await db.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, avatar: true, bio: true,
      points: true, credits: true, lastLoginAt: true, createdAt: true,
      verificationStatus: true, verificationType: true, verificationDoc: true, verificationAt: true,
      checkInStreak: true, referralCode: true,
      editorProfile: { select: { id: true, level: true, trustLevel: true, bioIsActive: true } },
      _count: {
        select: {
          posts: true,
          classifiedListings: true,
          subscriptions: true,
          payments: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  // Create new user (master only)
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER'].includes(user.role)) {
    return NextResponse.json({ error: 'Apenas MASTER pode criar usuários' }, { status: 403 })
  }
  const { name, email, role, password, bio, avatar } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, email e senha obrigatórios' }, { status: 400 })
  }
  const { hashPassword } = await import('@/lib/auth')
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
  const hashed = await hashPassword(password)
  const finalRole = role || 'EDITOR'

  const newUser = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        role: finalRole,
        password: hashed,
        bio: bio || null,
        avatar: avatar || defaultAvatar(name),
      },
    })

    // Auto-create EditorProfile if role is EDITOR
    if (finalRole === 'EDITOR') {
      await tx.editorProfile.create({ data: { userId: created.id } })
    }

    return created
  })

  return NextResponse.json({ user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } })
}
