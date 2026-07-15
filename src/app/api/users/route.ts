import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { defaultAvatar } from '@/lib/utils'
import { USER_ROLES } from '@/lib/admin-validation'
import { auditAdminAction } from '@/lib/admin-audit'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const url = new URL(req.url)
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(url.searchParams.get('pageSize') || '50', 10) || 50))
  const search = (url.searchParams.get('q') || '').trim().slice(0, 120)
  const role = url.searchParams.get('role')
  const verification = url.searchParams.get('verification')
  const where: any = {}
  if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search.toLowerCase() } }]
  if (role && USER_ROLES.includes(role as any)) where.role = role
  if (verification && ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'].includes(verification)) where.verificationStatus = verification

  const [users, total, roleCounts, verificationCounts] = await Promise.all([db.user.findMany({
    where,
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
    skip: (page - 1) * pageSize,
    take: pageSize,
  }), db.user.count({ where }), db.user.groupBy({ by: ['role'], _count: { _all: true } }), db.user.groupBy({ by: ['verificationStatus'], _count: { _all: true } })])
  return NextResponse.json({
    users,
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
    stats: {
      total: roleCounts.reduce((sum, item) => sum + item._count._all, 0),
      byRole: Object.fromEntries(roleCounts.map(item => [item.role, item._count._all])),
      byVerification: Object.fromEntries(verificationCounts.map(item => [item.verificationStatus, item._count._all])),
    },
  })
}

export async function POST(req: NextRequest) {
  // Create new user (master only)
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER'].includes(user.role)) {
    return NextResponse.json({ error: 'Apenas MASTER pode criar usuários' }, { status: 403 })
  }
  const { name, email, role, password, bio, avatar } = await req.json()
  if (typeof name !== 'string' || !name.trim() || name.length > 120 || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string') {
    return NextResponse.json({ error: 'Nome, email e senha obrigatórios' }, { status: 400 })
  }
  if (password.length < 8 || password.length > 200) return NextResponse.json({ error: 'Senha deve ter entre 8 e 200 caracteres' }, { status: 400 })
  if (role !== undefined && !USER_ROLES.includes(role)) return NextResponse.json({ error: 'Papel de usuário inválido' }, { status: 400 })
  const { hashPassword } = await import('@/lib/auth')
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
  const hashed = await hashPassword(password)
  const finalRole = role || 'EDITOR'

  const newUser = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: name.trim(),
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

  await auditAdminAction(req, user, 'CREATE', 'USER', newUser.id, { role: finalRole })
  return NextResponse.json({ user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } })
}
