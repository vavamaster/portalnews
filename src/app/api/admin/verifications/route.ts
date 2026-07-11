import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { autoCheckAchievements, notify } from '@/lib/achievements'

// GET - list pending verifications
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const pending = await db.user.findMany({
    where: { verificationStatus: 'PENDING' },
    select: {
      id: true, name: true, email: true, avatar: true,
      verificationType: true, verificationDoc: true, createdAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ pending })
}

// PATCH - approve/reject verification
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const { userId, status } = await req.json()
  if (!userId || !['VERIFIED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'userId e status (VERIFIED|REJECTED) obrigatórios' }, { status: 400 })
  }
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      verificationStatus: status,
      verificationAt: status === 'VERIFIED' ? new Date() : null,
    },
  })

  // Notify the user
  if (status === 'VERIFIED') {
    await notify(userId, 'SYSTEM', 'Verificação aprovada!', 'Seu CPF/CNPJ foi verificado. Selo verificado ativo!', 'profile')
    // auto-check achievements
    await autoCheckAchievements(userId)
  } else {
    await notify(userId, 'SYSTEM', 'Verificação rejeitada', 'Não foi possível verificar seu documento. Contate o suporte.', 'profile')
  }

  return NextResponse.json({ ok: true, status })
}
