import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { autoCheckAchievements } from '@/lib/achievements'

// POST - submit verification request (CPF/CNPJ)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login' }, { status: 401 })
    const { type, document } = await req.json()
    if (!type || !document) return NextResponse.json({ error: 'Tipo e documento obrigatórios' }, { status: 400 })
    if (!['CPF', 'CNPJ'].includes(type)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

    // sanitize document - keep only digits
    const cleanDoc = document.replace(/\D/g, '')
    if (type === 'CPF' && cleanDoc.length !== 11) return NextResponse.json({ error: 'CPF inválido' }, { status: 400 })
    if (type === 'CNPJ' && cleanDoc.length !== 14) return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        verificationStatus: 'PENDING',
        verificationType: type,
        verificationDoc: cleanDoc,
      },
    })

    // Notify admins
    const admins = await db.user.findMany({ where: { role: { in: ['MASTER', 'ADMIN'] } } })
    await db.notification.createMany({
      data: admins.map(a => ({
        userId: a.id,
        type: 'SYSTEM',
        title: 'Nova verificação pendente',
        message: `${user.name} solicitou verificação de ${type}: ${cleanDoc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`,
        link: 'admin',
      })),
    })

    return NextResponse.json({
      ok: true,
      verificationStatus: 'PENDING',
      verificationType: type,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET - current user's verification status
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ verificationStatus: 'NONE' })
  const u = await db.user.findUnique({ where: { id: user.id } })
  return NextResponse.json({
    verificationStatus: u?.verificationStatus || 'NONE',
    verificationType: u?.verificationType || null,
    verificationDoc: u?.verificationDoc || null,
    verificationAt: u?.verificationAt || null,
  })
}
