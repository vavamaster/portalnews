import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { activateEnterpriseCycle, ENTERPRISE_BILLING_TYPES, ENTERPRISE_CYCLE_STATUSES } from '@/lib/enterprise'

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

  const type = body.type || sc.billingType
  const requestedStatus = body.status || 'PENDING'
  if (!ENTERPRISE_BILLING_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Tipo de cobrança inválido' }, { status: 400 })
  }
  if (!ENTERPRISE_CYCLE_STATUSES.includes(requestedStatus)) {
    return NextResponse.json({ error: 'Status do ciclo inválido' }, { status: 400 })
  }
  const valueCents = body.valueCents === undefined ? sc.billingValueCents : Number(body.valueCents)
  const impressionsLimit = body.impressionsLimit === undefined ? sc.billingImpressions : Number(body.impressionsLimit)
  if (!Number.isInteger(valueCents) || valueCents < 0) {
    return NextResponse.json({ error: 'Valor do ciclo inválido' }, { status: 400 })
  }
  if (type === 'IMPRESSIONS' && (!Number.isInteger(impressionsLimit) || impressionsLimit <= 0)) {
    return NextResponse.json({ error: 'O ciclo por impressões exige um limite maior que zero' }, { status: 400 })
  }

  // Busca o usuário para usar o nome como fallback do companyName
  const targetUser = await db.user.findUnique({ where: { id: body.userId }, select: { name: true } })
  if (!targetUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  // Default values: monthly = 30 days from now; impressions = open-ended
  const startAt = body.startAt ? new Date(body.startAt) : new Date()
  if (Number.isNaN(startAt.getTime())) return NextResponse.json({ error: 'Data inicial inválida' }, { status: 400 })
  let endAt: Date | null = null
  if (type === 'MONTHLY') {
    endAt = body.endAt ? new Date(body.endAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    if (Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      return NextResponse.json({ error: 'A data final deve ser posterior à inicial' }, { status: 400 })
    }
  }

  let cycle = await db.enterpriseBillingCycle.create({
    data: {
      sponsoredCategoryId: sc.id,
      userId: body.userId,
      type,
      valueCents,
      impressionsLimit: type === 'IMPRESSIONS' ? impressionsLimit : 0,
      startAt,
      endAt,
      status: requestedStatus === 'ACTIVE' ? 'PENDING' : requestedStatus,
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
  if (requestedStatus === 'ACTIVE') {
    cycle = (await activateEnterpriseCycle(cycle.id)) || cycle
    // A-01 fix: use category name, not UUID
    const category = await db.category.findUnique({ where: { id: sc.categoryId }, select: { name: true } })
    await db.notification.create({
      data: {
        userId: body.userId,
        type: 'SYSTEM',
        title: '✓ Anúncio Enterprise ativado',
        message: `Seu anúncio na categoria "${category?.name || 'categoria'}" está ativo. Acesse o painel Enterprise para acompanhar métricas.`,
        link: 'enterprise',
      },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, cycle })
}
