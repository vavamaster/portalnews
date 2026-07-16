import { NextRequest, NextResponse } from 'next/server'
import { cancelGatewaySubscription, type GatewayProvider } from '@/lib/payment-gateway'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notify } from '@/lib/achievements'

/**
 * PATCH /api/subscriptions/[id]
 * Body: { autoRenew?: boolean, cancelNow?: boolean }
 *
 * - { autoRenew: false } → disables auto-renew (subscription stays active until period ends)
 * - { cancelNow: true } → cancels immediately (also cancels at gateway if applicable)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  // Find subscription — user can only cancel their own
  const sub = await db.subscription.findFirst({
    where: { id, userId: user.id },
    include: { plan: true },
  })

  if (!sub) return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })

  // Just toggle autoRenew
  if (body.autoRenew !== undefined && !body.cancelNow) {
    if (typeof body.autoRenew !== 'boolean') {
      return NextResponse.json({ error: 'autoRenew deve ser booleano' }, { status: 400 })
    }
    const isExternal = !!sub.externalSubId && ['ASAAS', 'MERCADO_PAGO', 'STRIPE'].includes(sub.paymentProvider || '')
    if (body.autoRenew === false && isExternal) {
      const canceled = await cancelGatewaySubscription(sub.paymentProvider as GatewayProvider, sub.externalSubId!)
      if (!canceled.success) {
        return NextResponse.json({ error: `O gateway não confirmou o fim da renovação: ${canceled.message}` }, { status: 502 })
      }
    }
    if (body.autoRenew === true && isExternal && sub.autoRenew === false) {
      return NextResponse.json({ error: 'Assine o plano novamente para reativar a cobrança recorrente' }, { status: 400 })
    }
    const updated = await db.subscription.update({
      where: { id: sub.id },
      data: { autoRenew: body.autoRenew },
    })
    await notify(user.id, 'SYSTEM',
      body.autoRenew ? 'Renovação automática ativada' : 'Renovação automática desativada',
      body.autoRenew
        ? 'Sua assinatura será renovada automaticamente ao final do período.'
        : 'Sua assinatura permanece ativa até o final do período atual, mas não será renovada.',
      'advertiser'
    )
    return NextResponse.json({ ok: true, subscription: updated })
  }

  // Cancel immediately
  if (body.cancelNow) {
    if (sub.externalSubId && ['ASAAS', 'MERCADO_PAGO', 'STRIPE'].includes(sub.paymentProvider || '')) {
      const canceled = await cancelGatewaySubscription(sub.paymentProvider as GatewayProvider, sub.externalSubId)
      if (!canceled.success) {
        return NextResponse.json({
          error: `A assinatura não foi cancelada porque o gateway não confirmou a operação: ${canceled.message}`,
        }, { status: 502 })
      }
    }

    const updated = await db.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELED', autoRenew: false },
    })
    await notify(user.id, 'SYSTEM', 'Assinatura cancelada', `Sua assinatura ${sub.plan.name} foi cancelada. Seus anúncios foram pausados.`, 'advertiser')

    // Immediately pause listings (don't wait for cron)
    try {
      const { pauseListingsForUser } = await import('@/lib/classifieds')
      // Check if user has any OTHER active subscription before pausing
      const otherActiveSub = await db.subscription.findFirst({
        where: { userId: user.id, status: 'ACTIVE', currentPeriodEnd: { gte: new Date() }, id: { not: sub.id } },
      })
      if (!otherActiveSub) {
        await pauseListingsForUser(user.id, `Sua assinatura ${sub.plan.name} foi cancelada. Renove para reativar seus anúncios.`)
      }
    } catch (e) {
      console.error('pauseListingsForUser failed:', e)
    }

    return NextResponse.json({ ok: true, subscription: updated })
  }

  return NextResponse.json({ error: 'Nenhuma ação especificada' }, { status: 400 })
}
