import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { createPayment, getDefaultGateway } from '@/lib/payment-gateway'
import { safeEnterpriseUrl } from '@/lib/enterprise'

// POST /api/enterprise/billing/[cycleId]/checkout
// Generates a payment checkout URL for a PENDING billing cycle using the configured gateway.
// The Enterprise user (or admin on their behalf) calls this to get a payment link.
//
// After payment is confirmed by the gateway webhook, the cycle is automatically
// activated by activateEnterpriseCycleOnPayment() in the webhook handler.
export async function POST(req: NextRequest, { params }: { params: Promise<{ cycleId: string }> }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Either the cycle owner or an admin can generate the checkout
  const { cycleId } = await params
  const cycle = await db.enterpriseBillingCycle.findUnique({
    where: { id: cycleId },
    include: {
      sponsoredCategory: {
        include: { category: { select: { name: true } } },
      },
      user: { select: { id: true, name: true, email: true, enterpriseLink: { select: { isActive: true } } } },
    },
  })
  if (!cycle) return NextResponse.json({ error: 'Ciclo não encontrado' }, { status: 404 })

  const isAdmin = ['MASTER', 'ADMIN'].includes(user.role)
  if (cycle.userId !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  if (cycle.status !== 'PENDING') {
    return NextResponse.json({ error: `Ciclo não está pendente (status: ${cycle.status})` }, { status: 400 })
  }
  if (!isAdmin && !cycle.user.enterpriseLink?.isActive) {
    return NextResponse.json({ error: 'Seu acesso Enterprise está desativado' }, { status: 403 })
  }

  if (cycle.paymentTransactionId) {
    const previous = await db.paymentTransaction.findUnique({ where: { id: cycle.paymentTransactionId } })
    if (previous?.status === 'PAID') {
      return NextResponse.json({ error: 'Este ciclo já foi pago' }, { status: 409 })
    }
    if (previous?.status === 'PENDING' && previous.externalId) {
      return NextResponse.json({ error: 'Já existe uma cobrança pendente para este ciclo. Aguarde a confirmação ou contate o suporte.' }, { status: 409 })
    }
  }

  // Get the default gateway
  const gateway = await getDefaultGateway()
  if (!gateway) {
    return NextResponse.json({
      error: 'Nenhum gateway de pagamento configurado. O admin precisa configurar em /admin > Pagamentos.',
    }, { status: 503 })
  }

  // Create a PaymentTransaction linked to this cycle
  const tx = await db.paymentTransaction.create({
    data: {
      userId: cycle.userId,
      type: 'ENTERPRISE_SPONSOR',
      refId: cycle.id,
      amountCents: cycle.valueCents,
      provider: gateway.provider,
      status: 'PENDING',
      description: `Anúncio Enterprise — ${cycle.sponsoredCategory.category.name} (${cycle.type === 'MONTHLY' ? 'mensal' : `${cycle.impressionsLimit} impressões`})`,
    },
  })

  // Link the transaction to the cycle
  await db.enterpriseBillingCycle.update({
    where: { id: cycle.id },
    data: { paymentTransactionId: tx.id },
  })

  // Generate the checkout URL via the gateway
  try {
    // Default to PIX (most common in Brazil); the user can request other methods via UI later
    const result = await createPayment(gateway, {
      userId: cycle.user.id,
      userName: cycle.user.name,
      userEmail: cycle.user.email,
      planName: `Enterprise — ${cycle.sponsoredCategory.category.name}`,
      amountCents: cycle.valueCents,
      paymentMethod: gateway.acceptsPix ? 'PIX' : (gateway.acceptsBoleto ? 'BOLETO' : 'CREDIT_CARD'),
    })

    if (!result.success) {
      await db.$transaction([
        db.paymentTransaction.update({ where: { id: tx.id }, data: { status: 'FAILED' } }),
        db.enterpriseBillingCycle.updateMany({
          where: { id: cycle.id, paymentTransactionId: tx.id },
          data: { paymentTransactionId: null },
        }),
      ])
      return NextResponse.json({ error: result.message || 'Falha no gateway' }, { status: 502 })
    }

    // Update the transaction with the external ID from the gateway
    await db.paymentTransaction.update({
      where: { id: tx.id },
      data: { externalId: result.externalId },
    })

    return NextResponse.json({
      ok: true,
      checkoutUrl: safeEnterpriseUrl(result.checkoutUrl),
      pixCode: result.pixCopyPaste || null,
      pixQrCode: result.pixQrCode || null,
      boletoUrl: safeEnterpriseUrl(result.boletoUrl),
      boletoBarcode: result.boletoBarcode || null,
      provider: result.provider,
      transactionId: tx.id,
    })
  } catch (e: any) {
    console.error('[Enterprise] checkout error:', e)
    await db.$transaction([
      db.paymentTransaction.updateMany({ where: { id: tx.id, status: 'PENDING' }, data: { status: 'FAILED' } }),
      db.enterpriseBillingCycle.updateMany({
        where: { id: cycle.id, paymentTransactionId: tx.id },
        data: { paymentTransactionId: null },
      }),
    ]).catch(() => {})
    return NextResponse.json({
      error: `Falha ao gerar checkout: ${e.message}`,
    }, { status: 500 })
  }
}
