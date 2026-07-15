import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getOrCreateEditorProfile } from '@/lib/editors'

// P0-3 fix: whitelist of fields admins can edit directly on a user.
// Sensitive fields are intentionally excluded and must be modified via
// dedicated endpoints:
//   - `password`           → dedicated password-reset flow (body.newPassword below)
//   - `points`, `credits`  → wallet helpers (PointTransaction / CreditTransaction)
//   - `verification*`      → /api/admin/verifications
// `isActive`, `city`, `state`, `phone` are listed for forward-compatibility
// (they are no-ops until added to the User schema).
const EDITABLE_FIELDS = [
  'name', 'email', 'role', 'avatar', 'bio',
  'isActive', 'city', 'state', 'phone',
] as const

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentUser = await getCurrentUser(req)
  if (!currentUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(currentUser.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const body = await req.json()

  // Verify target user exists
  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  // P0-3 fix: ADMIN cannot modify MASTER accounts (reset password, change
  // email/role, modify points/credits, etc.). Only MASTER can touch another
  // MASTER.
  if (currentUser.role === 'ADMIN' && existing.role === 'MASTER') {
    return NextResponse.json({ error: 'ADMIN não pode modificar contas MASTER' }, { status: 403 })
  }

  // P0-3 fix: role changes (any direction, including granting/revoking
  // MASTER) require MASTER. ADMIN cannot change roles at all.
  if (body.role !== undefined && currentUser.role !== 'MASTER') {
    return NextResponse.json({ error: 'Apenas MASTER pode alterar o papel de usuários' }, { status: 403 })
  }

  // Build update data — only allowed fields
  const update: any = {}
  for (const f of EDITABLE_FIELDS) {
    if (body[f] !== undefined) update[f] = body[f]
  }

  // Email uniqueness check
  if (update.email && update.email !== existing.email) {
    const emailOwner = await db.user.findUnique({ where: { email: update.email.toLowerCase() } })
    if (emailOwner && emailOwner.id !== id) {
      return NextResponse.json({ error: 'Email já está em uso por outro usuário' }, { status: 400 })
    }
    update.email = update.email.toLowerCase()
  }

  // Verification doc cleanup
  if (update.verificationDoc) {
    update.verificationDoc = String(update.verificationDoc).replace(/\D/g, '')
  }

  // Password change (optional, separate field)
  if (body.newPassword) {
    if (String(body.newPassword).length < 6) {
      return NextResponse.json({ error: 'Senha precisa ter no mínimo 6 caracteres' }, { status: 400 })
    }
    const { hashPassword } = await import('@/lib/auth')
    update.password = await hashPassword(body.newPassword)
  }

  // Role change to EDITOR: auto-create EditorProfile
  const wasNotEditor = existing.role !== 'EDITOR'
  const willBeEditor = update.role === 'EDITOR'
  const shouldCreateEditorProfile = wasNotEditor && willBeEditor

  // Role change away from EDITOR: optionally remove EditorProfile
  const wasEditor = existing.role === 'EDITOR'
  const willLeaveEditor = wasEditor && update.role && update.role !== 'EDITOR'

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id }, data: update })

    if (shouldCreateEditorProfile) {
      await tx.editorProfile.upsert({
        where: { userId: id },
        update: {},
        create: { userId: id },
      })
    }

    if (willLeaveEditor) {
      // Keep the profile (so it can be reactivated later) but the user loses editor access
      // — admin can explicitly delete via the editors panel if needed.
    }

    return u
  })

  // Log admin action
  await db.notification.create({
    data: {
      userId: id,
      type: 'SYSTEM',
      title: 'Perfil atualizado pelo administrador',
      message: `Seus dados foram atualizados por ${currentUser.name}.`,
      link: 'profile',
    },
  }).catch(() => {})

  return NextResponse.json({ user: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER'].includes(user.role)) {
    return NextResponse.json({ error: 'Apenas MASTER pode remover usuários' }, { status: 403 })
  }
  if (user.id === id) {
    return NextResponse.json({ error: 'Não é possível remover a si mesmo' }, { status: 400 })
  }
  await db.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
