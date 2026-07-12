import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getPointsConfig } from '@/lib/seo'
import { getUserActivePlan } from '@/lib/plans'

// Valid placements for ad banner
const VALID_PLACEMENTS = [
  'HOME_TOP', 'HOME_MIDDLE', 'HOME_SIDEBAR', 'HOME_INFEED',
  'ARTICLE_TOP', 'ARTICLE_MIDDLE', 'ARTICLE_BOTTOM', 'ARTICLE_INFEED',
  'CATEGORY_TOP', 'CATEGORY_SIDEBAR', 'CATEGORY_BOTTOM',
]

// Validate URL — must be http(s) and well-formed
function validateUrl(url: any): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

/**
 * POST /api/store/free-ad
 *
 * Cria um anúncio banner usando créditos.
 *
 * Regras de negócio:
 *   1. Assinantes de plano pago (PROFESSIONAL, COMPANY, PREMIUM):
 *      - Não pagam créditos para criar anúncio banner
 *      - Anúncio é marcado como isFreeAd=false (prioridade alta no serve)
 *      - Anúncio expira no final do ciclo da assinatura (currentPeriodEnd)
 *      - Status PENDING (aguarda aprovação admin)
 *
 *   2. Usuários grátis (FREE):
 *      - Pagam N créditos (configurável, default 20)
 *      - Anúncio é marcado como isFreeAd=true (prioridade baixa no serve)
 *      - Limite de impressões = créditos × impressões_por_crédito
 *      - Anúncio expira em N dias (cap 90)
 *      - Status PENDING (aguarda aprovação admin)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const { title, content, imageUrl, linkUrl, placement, categoryId, durationDays } = body

    // === Basic validation ===
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return NextResponse.json({ error: 'Título é obrigatório (mínimo 3 caracteres)' }, { status: 400 })
    }
    if (!content || typeof content !== 'string' || content.trim().length < 5) {
      return NextResponse.json({ error: 'Conteúdo é obrigatório (mínimo 5 caracteres)' }, { status: 400 })
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'Título muito longo (máx 200)' }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: 'Conteúdo muito longo (máx 2000)' }, { status: 400 })
    }
    if (!placement || !VALID_PLACEMENTS.includes(placement)) {
      return NextResponse.json({
        error: `Posicionamento inválido. Válidos: ${VALID_PLACEMENTS.join(', ')}`,
      }, { status: 400 })
    }

    // Validate URLs — reject javascript:, data:, etc.
    const finalImageUrl = validateUrl(imageUrl)
    const finalLinkUrl = validateUrl(linkUrl)
    // imageUrl is optional, linkUrl is optional — but if provided and invalid, error
    if (imageUrl && !finalImageUrl) {
      return NextResponse.json({ error: 'URL da imagem inválida' }, { status: 400 })
    }
    if (linkUrl && !finalLinkUrl) {
      return NextResponse.json({ error: 'URL do link inválida' }, { status: 400 })
    }

    // Validate categoryId if provided
    if (categoryId) {
      const cat = await db.classifiedCategory.findUnique({ where: { id: categoryId } })
      if (!cat) {
        return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 400 })
      }
    }

    // Cap durationDays: 1-90
    const days = Math.min(Math.max(Number(durationDays) || 7, 1), 90)
    const startAt = new Date()
    const endAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    const fresh = await db.user.findUnique({ where: { id: user.id } })
    if (!fresh) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // === Check subscription ===
    const subscription = await getUserActivePlan(user.id, db)
    const isPaidSubscriber = subscription && subscription.plan && subscription.plan.priceCents > 0

    const config = await getPointsConfig()

    if (isPaidSubscriber) {
      // === ASSINANTE PAGO: não paga créditos, prioridade alta ===
      // Anúncio expira no final do ciclo da assinatura (ou durationDays, o que for menor)
      const subEnd = subscription ? new Date(subscription.currentPeriodEnd) : endAt
      const finalEndAt = subEnd < endAt ? subEnd : endAt

      const ad = await db.ad.create({
        data: {
          title: title.trim(), content: content.trim(),
          imageUrl: finalImageUrl, linkUrl: finalLinkUrl, placement,
          status: 'PENDING',
          isFreeAd: false, // prioridade alta no serve
          impressionLimit: 0, // ilimitado (assinante)
          ownerId: user.id,
          categoryId: categoryId || null,
          startAt, endAt: finalEndAt,
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

    // Calcular limite de impressões (com fallback seguro para NaN)
    const impressionsPerCreditStr = await db.seoSetting.findUnique({ where: { key: 'impressions_per_credit' } })
    let impressionsPerCredit = 50
    if (impressionsPerCreditStr?.value) {
      const parsed = parseInt(impressionsPerCreditStr.value, 10)
      if (!isNaN(parsed) && parsed > 0) impressionsPerCredit = parsed
    }
    const impressionLimit = config.freeAdCostCredits * impressionsPerCredit

    // === Race-safe credit decrement via conditional updateMany ===
    // First, atomically decrement credits (only if user still has enough)
    const decrementResult = await db.user.updateMany({
      where: { id: user.id, credits: { gte: config.freeAdCostCredits } },
      data: { credits: { decrement: config.freeAdCostCredits } },
    })

    if (decrementResult.count === 0) {
      // Race condition: credits dropped between read and write
      return NextResponse.json({
        error: `Créditos insuficientes. Necessário: ${config.freeAdCostCredits}.`,
      }, { status: 400 })
    }

    // Credits decremented successfully — create transaction record + ad
    const ad = await db.$transaction([
      db.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -config.freeAdCostCredits,
          reason: 'SPENT_FREE_AD',
        },
      }),
      db.ad.create({
        data: {
          title: title.trim(), content: content.trim(),
          imageUrl: finalImageUrl, linkUrl: finalLinkUrl, placement,
          status: 'PENDING',
          isFreeAd: true, // prioridade baixa no serve
          impressionLimit,
          ownerId: user.id,
          categoryId: categoryId || null,
          startAt, endAt,
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      ad: ad[1],
      creditsSpent: config.freeAdCostCredits,
      impressionLimit,
      message: `Anúncio enviado para aprovação! ${impressionLimit} impressões (${config.freeAdCostCredits} créditos × ${impressionsPerCredit} impressões/crédito).`,
    })
  } catch (e: any) {
    console.error('Store free-ad error:', e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
