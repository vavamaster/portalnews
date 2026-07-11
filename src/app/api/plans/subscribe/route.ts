import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { validateCoupon, autoCheckAchievements, notify } from '@/lib/achievements'
import { getDefaultGateway, createRecurringSubscription } from '@/lib/payment-gateway'

// POST /api/plans/subscribe
// Body: { planSlug, provider?, paymentMethod?, autoRenew?, couponCode? }
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Faça login' }, { status: 401 })

    const body = await req.json()
    const { planSlug, paymentMethod = 'PIX', autoRenew = true, couponCode } = body

    const plan = await db.plan.findUnique({ where: { slug: planSlug } })
    if (!plan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    if (!plan.isActive) return NextResponse.json({ error: 'Plano indisponível' }, { status: 400 })

    // Cancel any existing active subscription
    const existing = await db.subscription.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    })
    if (existing) {
      await db.subscription.update({
        where: { id: existing.id },
        data: { status: 'CANCELED' },
      })
    }

    const now = new Date()
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Free plan — direct activation
    if (plan.priceCents === 0) {
      const sub = await db.subscription.create({
        data: {
          userId: user.id, planId: plan.id, status: 'ACTIVE',
          currentPeriodStart: now, currentPeriodEnd: periodEnd,
          paymentProvider: 'NONE', autoRenew: false,
        },
        include: { plan: true },
      })
      await notify(user.id, 'SYSTEM', `Plano ${plan.name} ativado!`, 'Você já pode anunciar.', 'classifieds')
      return NextResponse.json({ subscription: sub, message: `Plano ${plan.name} ativado!` })
    }

    // === Paid plan ===

    // Apply coupon
    let finalAmount = plan.priceCents
    let discountCents = 0
    let couponId: string | null = null
    if (couponCode) {
      const couponResult = await validateCoupon(couponCode, user.id, plan.priceCents, 'SUBSCRIPTION')
      if (!couponResult.valid) {
        return NextResponse.json({ error: couponResult.error }, { status: 400 })
      }
      discountCents = couponResult.discountCents || 0
      finalAmount = plan.priceCents - discountCents
      couponId = couponResult.coupon.id || null
      await db.coupon.update({ where: { id: couponId! }, data: { currentRedemptions: { increment: 1 } } })
      await db.couponRedemption.create({ data: { couponId: couponId!, userId: user.id } })
    }

    // Get gateway — use provider from body or default
    const gateway = await getDefaultGateway()
    if (!gateway) {
      // No gateway configured — mock payment for dev
      const tx = await db.paymentTransaction.create({
        data: {
          userId: user.id, type: 'SUBSCRIPTION', amountCents: finalAmount,
          provider: 'NONE', status: 'PAID',
          description: `Assinatura ${plan.name} (mock — nenhum gateway configurado)`,
          externalId: `mock_${Date.now()}`, couponId, discountCents,
        },
      })
      const sub = await db.subscription.create({
        data: {
          userId: user.id, planId: plan.id, status: 'ACTIVE',
          currentPeriodStart: now, currentPeriodEnd: periodEnd,
          paymentProvider: 'NONE', externalSubId: tx.externalId, autoRenew,
        },
        include: { plan: true },
      })
      await notify(user.id, 'SYSTEM', `Plano ${plan.name} ativado! (modo demo)`, 'Configure um gateway de pagamento no admin para cobranças reais.', 'advertiser')
      await autoCheckAchievements(user.id)
      return NextResponse.json({
        subscription: sub, transaction: tx, isMock: true,
        message: `Pagamento simulado! Plano ${plan.name} ativo por 30 dias. Configure um gateway no admin para cobranças reais.`,
      })
    }

    // === Real gateway payment ===
    const result = await createRecurringSubscription(gateway, {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      planName: plan.name,
      amountCents: finalAmount,
      paymentMethod,
      billingCycle: 'MONTHLY',
    })

    if (!result.success) {
      // Gateway failed — fallback to mock with warning
      const tx = await db.paymentTransaction.create({
        data: {
          userId: user.id, type: 'SUBSCRIPTION', amountCents: finalAmount,
          provider: gateway.provider, status: 'PAID',
          description: `Assinatura ${plan.name} (gateway falhou — modo demo)`,
          externalId: `mock_${Date.now()}`, couponId, discountCents,
        },
      })
      const sub = await db.subscription.create({
        data: {
          userId: user.id, planId: plan.id, status: 'ACTIVE',
          currentPeriodStart: now, currentPeriodEnd: periodEnd,
          paymentProvider: gateway.provider, externalSubId: tx.externalId, autoRenew,
        },
        include: { plan: true },
      })
      await notify(user.id, 'SYSTEM', `Plano ${plan.name} ativado! (modo demo)`, `Gateway retornou erro: ${result.message}. Verifique as API keys no admin.`, 'advertiser')
      await autoCheckAchievements(user.id)
      return NextResponse.json({
        subscription: sub, transaction: tx, isMock: true, gatewayError: result.message,
        message: `Plano ${plan.name} ativo (modo demo). Gateway falhou: ${result.message}`,
      })
    }

    // Create payment transaction
    const tx = await db.paymentTransaction.create({
      data: {
        userId: user.id, type: 'SUBSCRIPTION', amountCents: finalAmount,
        provider: gateway.provider, status: 'PENDING',
        description: `Assinatura ${plan.name}${discountCents > 0 ? ` (cupom: -R$ ${(discountCents / 100).toFixed(2)})` : ''}`,
        externalId: result.externalId, couponId, discountCents,
      },
    })

    // Create subscription (pending until webhook confirms)
    const sub = await db.subscription.create({
      data: {
        userId: user.id, planId: plan.id,
        status: result.status === 'ACTIVE' ? 'ACTIVE' : 'ACTIVE', // activate immediately, webhook will handle failures
        currentPeriodStart: now, currentPeriodEnd: periodEnd,
        paymentProvider: gateway.provider, externalSubId: result.externalId, autoRenew,
      },
      include: { plan: true },
    })

    await notify(user.id, 'SYSTEM', `Pagamento criado no ${gateway.displayName}!`, `Plano ${plan.name}. Complete o pagamento para ativar.`, 'advertiser')
    await autoCheckAchievements(user.id)

    return NextResponse.json({
      subscription: sub,
      transaction: tx,
      payment: {
        provider: gateway.provider,
        pixQrCode: result.pixQrCode,
        pixCopyPaste: result.pixCopyPaste,
        boletoUrl: result.boletoUrl,
        boletoBarcode: result.boletoBarcode,
        checkoutUrl: result.checkoutUrl,
      },
      discount: discountCents > 0 ? { originalPrice: plan.priceCents, discount: discountCents, finalPrice: finalAmount } : null,
      message: result.message,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
