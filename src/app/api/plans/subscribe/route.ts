import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { validateCoupon, autoCheckAchievements, notify } from '@/lib/achievements'
import { getDefaultGateway, createRecurringSubscription } from '@/lib/payment-gateway'
import { getPlanConfig } from '@/lib/plans'

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

    // === Business rule: validate personType compatibility ===
    // Plan config (in src/lib/plans.ts) declares personType: 'PF' | 'PJ' | 'BOTH'.
    // The DB Plan model doesn't have this column — read from config.
    const planConfig = getPlanConfig(plan.slug)
    if (planConfig && planConfig.personType !== 'BOTH') {
      // Check user's listings — if they have PJ listings, they can't subscribe to PF-only plan
      const userListings = await db.classifiedListing.findFirst({
        where: { ownerId: user.id, personType: { not: planConfig.personType } },
        select: { id: true },
      })
      if (userListings) {
        return NextResponse.json({
          error: `O plano ${plan.name} é exclusivo para ${planConfig.personType === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}. Você possui anúncios como ${planConfig.personType === 'PF' ? 'PJ' : 'PF'} que precisam ser removidos ou migrados.`,
        }, { status: 400 })
      }
    }

    // === Atomic cancel-existing + create-new to prevent race condition ===
    // Use a transaction with a re-check inside
    const now = new Date()
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Free plan — direct activation (still in transaction to handle race)
    if (plan.priceCents === 0) {
      const sub = await db.$transaction(async (tx) => {
        // Inside transaction: cancel existing ACTIVE subs for this user
        await tx.subscription.updateMany({
          where: { userId: user.id, status: 'ACTIVE' },
          data: { status: 'CANCELED' },
        })
        // Create new FREE subscription
        return await tx.subscription.create({
          data: {
            userId: user.id, planId: plan.id, status: 'ACTIVE',
            currentPeriodStart: now, currentPeriodEnd: periodEnd,
            paymentProvider: 'NONE', autoRenew: false,
          },
          include: { plan: true },
        })
      })
      await notify(user.id, 'SYSTEM', `Plano ${plan.name} ativado!`, 'Você já pode anunciar.', 'classifieds')
      try { await autoCheckAchievements(user.id) } catch {}
      return NextResponse.json({
        subscription: sub,
        message: `Plano ${plan.name} ativado!`,
        status: 'ACTIVE',
      })
    }

    // === Paid plan: apply coupon (validation only — redemption on webhook) ===
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
    }

    // === Get gateway ===
    const gateway = await getDefaultGateway()
    if (!gateway) {
      // No gateway configured — mock payment for dev only
      const tx = await db.paymentTransaction.create({
        data: {
          userId: user.id, type: 'SUBSCRIPTION', amountCents: finalAmount,
          provider: 'NONE', status: 'PAID',
          description: `Assinatura ${plan.name} (mock — nenhum gateway configurado)`,
          externalId: `mock_${Date.now()}`, couponId, discountCents,
        },
      })
      const sub = await db.$transaction(async (tx2) => {
        await tx2.subscription.updateMany({
          where: { userId: user.id, status: 'ACTIVE' },
          data: { status: 'CANCELED' },
        })
        return await tx2.subscription.create({
          data: {
            userId: user.id, planId: plan.id, status: 'ACTIVE',
            currentPeriodStart: now, currentPeriodEnd: periodEnd,
            paymentProvider: 'NONE', externalSubId: tx.externalId, autoRenew,
          },
          include: { plan: true },
        })
      })
      await notify(user.id, 'SYSTEM', `Plano ${plan.name} ativado! (modo demo)`, 'Configure um gateway de pagamento no admin para cobranças reais.', 'advertiser')
      // Redeem coupon after payment confirmed
      if (couponId) {
        await db.coupon.update({ where: { id: couponId }, data: { currentRedemptions: { increment: 1 } } })
        await db.couponRedemption.create({ data: { couponId, userId: user.id } })
      }
      try { await autoCheckAchievements(user.id) } catch {}
      return NextResponse.json({
        subscription: sub, transaction: tx, isMock: true,
        status: 'ACTIVE',
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

    // CRITICAL FIX: do NOT activate subscription on gateway failure — return error
    if (!result.success) {
      return NextResponse.json({
        error: `Gateway de pagamento indisponível: ${result.message}. Tente novamente.`,
        gatewayError: result.message,
      }, { status: 502 })
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

    // CRITICAL FIX: ALWAYS create subscription as PENDING until webhook confirms payment.
    // Activation via webhook only (invoice.paid / PAYMENT_RECEIVED).
    // This prevents the "free access window" between checkout and payment settlement.
    const sub = await db.$transaction(async (tx2) => {
      // Cancel existing ACTIVE subs (but DON'T touch PENDING ones — user may have multiple pending)
      await tx2.subscription.updateMany({
        where: { userId: user.id, status: 'ACTIVE' },
        data: { status: 'CANCELED' },
      })
      return await tx2.subscription.create({
        data: {
          userId: user.id, planId: plan.id,
          status: 'PENDING', // always pending until webhook confirms
          currentPeriodStart: now, currentPeriodEnd: periodEnd,
          paymentProvider: gateway.provider, externalSubId: result.externalId, autoRenew,
        },
        include: { plan: true },
      })
    })

    await notify(
      user.id,
      'SYSTEM',
      `Pagamento criado no ${gateway.displayName}!`,
      `Plano ${plan.name}. Complete o pagamento para ativar o plano.`,
      'advertiser',
    )
    try { await autoCheckAchievements(user.id) } catch {}

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
      status: 'PENDING', // tell the client the subscription is pending payment
      message: result.message || `Pagamento criado. Complete o pagamento para ativar o plano ${plan.name}.`,
    })
  } catch (e: any) {
    console.error('Subscribe error:', e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
