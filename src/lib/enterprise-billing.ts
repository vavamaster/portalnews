import { db } from './db'

/**
 * When a payment transaction is confirmed (PAID), check if it's linked to an
 * Enterprise billing cycle. If so, mark the cycle as ACTIVE and unpause the
 * sponsor's ads.
 *
 * Called from /api/webhooks/{asaas,mercadopago,stripe} after a payment is marked PAID.
 */
export async function activateEnterpriseCycleOnPayment(paymentTransactionId: string) {
  try {
    // Find any PENDING Enterprise billing cycle linked to this payment transaction
    const cycle = await db.enterpriseBillingCycle.findFirst({
      where: {
        paymentTransactionId,
        status: 'PENDING',
      },
      include: {
        sponsoredCategory: {
          include: { category: { select: { name: true } } },
        },
      },
    })

    if (!cycle) return // not an Enterprise payment, nothing to do

    // Activate the cycle
    await db.enterpriseBillingCycle.update({
      where: { id: cycle.id },
      data: {
        status: 'ACTIVE',
        startAt: new Date(),
        endAt: cycle.type === 'MONTHLY'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null,
      },
    })

    // Unpause the sponsor's ads owned by this user
    await db.enterpriseAd.updateMany({
      where: {
        sponsoredCategoryId: cycle.sponsoredCategoryId,
        ownerId: cycle.userId,
        status: 'PAUSED',
      },
      data: { status: 'ACTIVE' },
    })

    // Notify the company user
    await db.notification.create({
      data: {
        userId: cycle.userId,
        type: 'SYSTEM',
        title: '✓ Pagamento confirmado — Anúncio Enterprise ativado',
        message: `Seu anúncio em "${cycle.sponsoredCategory.category.name}" está ativo! Acesse o painel Enterprise para acompanhar métricas.`,
        link: 'enterprise',
      },
    }).catch(() => {})

    // Notify admin
    const admin = await db.user.findFirst({ where: { role: 'MASTER' } })
    if (admin) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: 'SYSTEM',
          title: '💰 Pagamento Enterprise confirmado',
          message: `Ciclo ativado para a categoria "${cycle.sponsoredCategory.category.name}".`,
          link: 'admin',
        },
      }).catch(() => {})
    }

    console.debug(`[Enterprise] Cycle ${cycle.id} activated after payment ${paymentTransactionId}`)
  } catch (e) {
    console.error('[Enterprise] activateCycleOnPayment error:', e)
  }
}
