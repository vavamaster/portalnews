import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { autoCheckAchievements, notify } from '@/lib/achievements'
import { auditAdminAction } from '@/lib/admin-audit'

async function requireAdmin(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return { user: null, error: NextResponse.json({ error: 'NÃ£o autorizado' }, { status: 401 }) }
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return { user: null, error: NextResponse.json({ error: 'PermissÃ£o negada' }, { status: 403 }) }
  }
  return { user, error: null }
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req)
  if (error) return error
  const pending = await db.user.findMany({
    where: { verificationStatus: 'PENDING' },
    select: {
      id: true, name: true, email: true, avatar: true,
      verificationType: true, verificationDoc: true, createdAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ pending })
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAdmin(req)
  if (error || !user) return error
  const { userId, status, reason } = await req.json().catch(() => ({}))
  if (typeof userId !== 'string' || !['VERIFIED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'userId e status (VERIFIED|REJECTED) obrigatÃ³rios' }, { status: 400 })
  }
  if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
    return NextResponse.json({ error: 'Motivo invÃ¡lido' }, { status: 400 })
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      verificationStatus: status,
      verificationAt: status === 'VERIFIED' ? new Date() : null,
    },
  })

  if (status === 'VERIFIED') {
    await notify(userId, 'SYSTEM', 'VerificaÃ§Ã£o aprovada!', 'Seu CPF/CNPJ foi verificado. Selo verificado ativo!', 'profile')
    await autoCheckAchievements(userId)
  } else {
    const message = reason?.trim()
      ? `NÃ£o foi possÃ­vel verificar seu documento. Motivo: ${reason.trim()}`
      : 'NÃ£o foi possÃ­vel verificar seu documento. Contate o suporte.'
    await notify(userId, 'SYSTEM', 'VerificaÃ§Ã£o rejeitada', message, 'profile')
  }

  await auditAdminAction(req, user, status === 'VERIFIED' ? 'VERIFY' : 'REJECT_VERIFICATION', 'USER', updated.id, {
    reason: status === 'REJECTED' ? reason?.trim() || null : null,
  })
  return NextResponse.json({ ok: true, status })
}
