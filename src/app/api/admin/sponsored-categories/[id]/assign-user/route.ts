import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// POST /api/admin/sponsored-categories/[id]/assign-user
// Links an existing user to the Enterprise dashboard (gives them "Anúncio Enterprise" in their menu).
// Body: { userId, companyName }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await getCurrentUser(req)
  if (!adminUser || !['MASTER', 'ADMIN'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params
  // The sponsor ID is in params.id but we don't strictly need it for the link creation;
  // we just verify the sponsor exists.
  const sc = await db.sponsoredCategory.findUnique({ where: { id } })
  if (!sc) return NextResponse.json({ error: 'Sponsor não encontrado' }, { status: 404 })

  const body = await req.json()
  if (!body.userId || !body.companyName) {
    return NextResponse.json({ error: 'userId e companyName são obrigatórios' }, { status: 400 })
  }

  // Create or update the EnterpriseUserLink
  const link = await db.enterpriseUserLink.upsert({
    where: { userId: body.userId },
    update: { companyName: body.companyName, isActive: true, assignedBy: adminUser.id },
    create: { userId: body.userId, companyName: body.companyName, assignedBy: adminUser.id },
  })

  // Notify the user
  await db.notification.create({
    data: {
      userId: body.userId,
      type: 'SYSTEM',
      title: '🎯 Acesso Enterprise liberado',
      message: `Você foi vinculado como empresa "${body.companyName}". Acesse o painel Enterprise para configurar seus anúncios.`,
      link: 'enterprise',
    },
  }).catch(() => {})

  return NextResponse.json({ ok: true, link })
}
