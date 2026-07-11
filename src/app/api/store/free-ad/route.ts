import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getPointsConfig } from '@/lib/seo'
import { getUserActivePlan } from '@/lib/plans'

/**
 * POST /api/store/free-ad
 *
 * Cria um anúncio banner usando créditos.
 *
 * Regras de negócio:
 *   1. Assinantes de plano pago (PROFESSIONAL, COMPANY, PREMIUM):
 *      - Não pagam créditos para criar anúncio banner
 *      - Anúncio é marcado como isFreeAd=false (prioridade alta no serve)
 *      - Sem limite de impressões (ilimitado enquanto a assinatura estiver ativa)
 *      - Status PENDING (aguarda aprovação admin)
 *
 *   2. Usuários grátis (FREE):
 *      - Pagam N créditos (configurável, default 20)
 *      - Anúncio é marcado como isFreeAd=true (prioridade baixa no serve)
 *      - Limite de impressões = créditos × impressões_por_crédito
 *      - Status PENDING (aguarda aprovação admin)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { title, content, imageUrl, linkUrl, placement, categoryId, durationDays } = await req.json()
    if (!title || !content || !placement) {
      return NextResponse.json({ error: 'Título, conteúdo e posicionamento são obrigatórios' }, { status: 400 })
    }

    const fresh = await db.user.findUnique({ where: { id: user.id } })
    if (!fresh) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // Verificar se é assinante pago
    const subscription = await getUserActivePlan(user.id, db)
    const isPaidSubscriber = subscription && subscription.plan && subscription.plan.priceCents > 0

    const config = await getPointsConfig()
    const days = durationDays || 7
    const startAt = new Date()
    const endAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    if (isPaidSubscriber) {
      // === ASSINANTE PAGO: não paga créditos, prioridade alta ===
      const ad = await db.ad.create({
        data: {
          title, content, imageUrl, linkUrl, placement,
          status: 'PENDING',
          isFreeAd: false, // prioridade alta no serve (regra 10:2)
          impressionLimit: 0, // ilimitado (assinante)
          ownerId: user.id,
          categoryId: categoryId || null,
          startAt, endAt,
        },
      })

      return NextResponse.json({
        ok: true,
        ad,
        creditsSpent: 0,
        message: 'Anúncio enviado para aprovação! Como assinante, você não paga créditos e tem prioridade de exibição.',
      })
    }

    // === USUÁRIO GRÁTIS: paga créditos, prioridade baixa ===
    if (fresh.credits < config.freeAdCostCredits) {
      return NextResponse.json({
        error: `Créditos insuficientes. Necessário: ${config.freeAdCostCredits}. Disponível: ${fresh.credits}.`,
      }, { status: 400 })
    }

    // Calcular limite de impressões
    const impressionsPerCreditStr = await db.seoSetting.findUnique({ where: { key: 'impressions_per_credit' } })
    const impressionsPerCredit = impressionsPerCreditStr ? parseInt(impressionsPerCreditStr.value) : 50
    const impressionLimit = config.freeAdCostCredits * impressionsPerCredit

    // Debitar créditos
    const ad = await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { credits: { decrement: config.freeAdCostCredits } },
      }),
      db.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -config.freeAdCostCredits,
          reason: 'SPENT_FREE_AD',
        },
      }),
      db.ad.create({
        data: {
          title, content, imageUrl, linkUrl, placement,
          status: 'PENDING',
          isFreeAd: true, // prioridade baixa no serve (regra 10:2)
          impressionLimit,
          ownerId: user.id,
          categoryId: categoryId || null,
          startAt, endAt,
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      ad: ad[2],
      creditsSpent: config.freeAdCostCredits,
      impressionLimit,
      message: `Anúncio enviado para aprovação! ${impressionLimit} impressões (${config.freeAdCostCredits} créditos × ${impressionsPerCredit} impressões/crédito).`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
