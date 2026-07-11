import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// POST /api/admin/sponsored-categories/[id]/billing
// Admin registers a new billing cycle for a sponsor.
// Body: { userId, type, valueCents, impressionsLimit, startAt, endAt, status, paymentTransactionId? }
// The cycle is created PENDING by default; admin marks ACTIVE after payment is confirmed
// (or directly ACTIVE for manual/offline payments).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id } = await params
  const sc = await db.sponsoredCategory.findUnique({ where: { id } })
  if (!sc) return NextResponse.json({ error: 'Sponsor não encontrado' }, { status: 404 })

  const body = await req.json()
  if (!body.userId) return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })

  // Busca o usuário para usar o nome como fallback do companyName
  const targetUser = await db.user.findUnique({ where: { id: body.userId }, select: { name: true } })
  if (!targetUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  // Default values: monthly = 30 days from now; impressions = open-ended
  const startAt = body.startAt ? new Date(body.startAt) : new Date()
  let endAt: Date | null = null
  if (body.type === 'MONTHLY' || (body.type !== 'IMPRESSIONS' && sc.billingType === 'MONTHLY')) {
    endAt = body.endAt ? new Date(body.endAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }

  const cycle = await db.enterpriseBillingCycle.create({
    data: {
      sponsoredCategoryId: sc.id,
      userId: body.userId,
      type: body.type || sc.billingType,
      valueCents: parseInt(body.valueCents, 10) || sc.billingValueCents,
      impressionsLimit: parseInt(body.impressionsLimit, 10) || sc.billingImpressions,
      startAt,
      endAt,
      status: body.status || 'PENDING',
      paymentTransactionId: body.paymentTransactionId || null,
    },
  })

  // Auto-vincular o usuário como Enterprise (dá acesso ao painel Enterprise)
  // Usa o companyName fornecido pelo admin no formulário de cobrança
  const companyName = body.companyName?.trim() || targetUser?.name || 'Empresa'
  if (targetUser) {
    await db.enterpriseUserLink.upsert({
      where: { userId: body.userId },
      update: { isActive: true, companyName },
      create: {
        userId: body.userId,
        companyName,
        assignedBy: user.id,
      },
    })
  }

  // Se for EXCLUSIVE e for uma empresa DIFERENTE da que tinha antes,
  // limpar a landing page antiga (não pertence à nova empresa)
  if (sc.mode === 'EXCLUSIVE') {
    // Verificar se já existe uma landing page e se pertence a um usuário diferente
    const existingLp = await db.enterpriseLandingPage.findUnique({
      where: { sponsoredCategoryId: sc.id },
    })
    if (existingLp && existingLp.companyName !== companyName) {
      // Empresa diferente — deletar a landing page antiga
      await db.enterpriseLandingPage.delete({
        where: { sponsoredCategoryId: sc.id },
      })
      console.log(`[Enterprise] Landing page cleared: old company "${existingLp.companyName}" → new company "${companyName}"`)
    }
  }

  // If admin marks as ACTIVE immediately, also unpause the sponsor's ads
  if (cycle.status === 'ACTIVE') {
    await db.enterpriseAd.updateMany({
      where: { sponsoredCategoryId: sc.id, status: 'PAUSED' },
      data: { status: 'ACTIVE' },
    })
    // Notify the user
    await db.notification.create({
      data: {
        userId: body.userId,
        type: 'SYSTEM',
        title: '✓ Anúncio Enterprise ativado',
        message: `Seu anúncio na categoria "${sc.categoryId}" está ativo. Acesse o painel Enterprise para acompanhar métricas.`,
        link: 'enterprise',
      },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, cycle })
}
