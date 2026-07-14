import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getOrCreateEditorProfile, EDITOR_LEVELS, PANEL_SECTIONS } from '@/lib/editors'
import { defaultAvatar } from '@/lib/utils'

// GET - admin lists all editor profiles
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const profiles = await db.editorProfile.findMany({
    include: {
      user: {
        select: {
          id: true, name: true, email: true, avatar: true, bio: true,
          verificationStatus: true, verificationType: true,
          _count: { select: { posts: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const parsed = profiles.map(p => ({
    ...p,
    categoriesAllowed: p.categoriesAllowed ? JSON.parse(p.categoriesAllowed) : null,
    panelAccess: p.panelAccess ? JSON.parse(p.panelAccess) : [],
    bioSocialLinks: p.bioSocialLinks ? JSON.parse(p.bioSocialLinks) : null,
  }))

  return NextResponse.json({ profiles: parsed, levels: EDITOR_LEVELS, panelSections: PANEL_SECTIONS })
}

// POST - admin creates editor profile for an existing user, OR creates a brand-new editor with login
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const body = await req.json()

  // Mode A: attach editor profile to existing user
  if (body.userId) {
    const targetUser = await db.user.findUnique({ where: { id: body.userId } })
    if (!targetUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // Ensure user is EDITOR role
    if (targetUser.role === 'READER') {
      await db.user.update({ where: { id: body.userId }, data: { role: 'EDITOR' } })
    }

    const profile = await getOrCreateEditorProfile(body.userId)
    return NextResponse.json({ profile, user: targetUser })
  }

  // Mode B: create new editor with login + profile in one shot
  const { name, email, password, bio, avatar, ...profileDefaults } = body
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, email e senha obrigatórios para criar um novo editor' }, { status: 400 })
  }

  const { hashPassword } = await import('@/lib/auth')
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })

  const hashed = await hashPassword(password)

  const result = await db.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        role: 'EDITOR',
        password: hashed,
        bio: bio || null,
        avatar: avatar || defaultAvatar(name),
      },
    })

    const profile = await tx.editorProfile.create({
      data: {
        userId: newUser.id,
        bioTitle: profileDefaults.bioTitle || null,
        bioSlug: profileDefaults.bioSlug || null,
        bioIsActive: profileDefaults.bioIsActive ?? true,
      },
    })

    // Notify
    await tx.notification.create({
      data: {
        userId: newUser.id,
        type: 'SYSTEM',
        title: 'Bem-vindo(a) ao time de editores!',
        message: `Sua conta foi criada por ${user.name}. Você já pode começar a publicar notícias.`,
        link: 'admin',
      },
    })

    return { user: newUser, profile }
  })

  return NextResponse.json({ user: result.user, profile: result.profile })
}
