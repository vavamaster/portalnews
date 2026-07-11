import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getUserActivePlan } from '@/lib/plans'

/**
 * GET /api/ads/serve?placement=HOME_TOP
 *
 * Regra de prioridade (10:2):
 *   - Assinantes pagos (isFreeAd=false): 10 impressões para cada 2 de grátis
 *   - Proporção: 83% pago / 17% grátis
 *   - Se não há anúncios pagos, mostra grátis (100%)
 *   - Se não há grátis, mostra pago (100%)
 *
 * Tipos de anúncio:
 *   - isFreeAd=false: anúncio de assinante pago ou admin (prioridade alta)
 *   - isFreeAd=true: anúncio de usuário grátis via créditos (prioridade baixa)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const placement = url.searchParams.get('placement')
  if (!placement) return NextResponse.json({ ad: null })

  const now = new Date()

  // 1. Buscar anúncios pagos/admin (isFreeAd=false, ACTIVE, dentro do período)
  const paidAds = await db.ad.findMany({
    where: {
      placement,
      status: 'ACTIVE',
      isFreeAd: false,
      OR: [
        { startAt: null, endAt: null },
        { startAt: { lte: now }, endAt: { gte: now } },
        { startAt: { lte: now }, endAt: null },
      ],
    },
    take: 10,
  })

  // 2. Buscar anúncios grátis (isFreeAd=true, ACTIVE, com impressões restantes)
  const freeAdsRaw = await db.ad.findMany({
    where: {
      placement,
      status: 'ACTIVE',
      isFreeAd: true,
      OR: [
        { startAt: null, endAt: null },
        { startAt: { lte: now }, endAt: { gte: now } },
        { startAt: { lte: now }, endAt: null },
      ],
    },
    take: 10,
  })

  // Filtrar grátis que ainda têm impressões restantes
  const eligibleFreeAds = freeAdsRaw.filter(a => a.impressionLimit === 0 || a.impressions < a.impressionLimit)

  // Auto-pausar grátis que atingiram limite
  for (const ad of freeAdsRaw) {
    if (ad.impressionLimit > 0 && ad.impressions >= ad.impressionLimit) {
      await db.ad.update({ where: { id: ad.id }, data: { status: 'PAUSED' } }).catch(() => {})
    }
  }

  // 3. Decidir qual anúncio mostrar — regra 10:2 (83% pago, 17% grátis)
  let selectedAd: any = null
  let adSource = 'placeholder'

  if (paidAds.length > 0 && eligibleFreeAds.length > 0) {
    // Ambos existem: 83% chance pago, 17% chance grátis (razão 10:2)
    if (Math.random() < 0.83) {
      selectedAd = paidAds[Math.floor(Math.random() * paidAds.length)]
      adSource = 'paid'
    } else {
      selectedAd = eligibleFreeAds[Math.floor(Math.random() * eligibleFreeAds.length)]
      adSource = 'free'
    }
  } else if (paidAds.length > 0) {
    // Só há pagos
    selectedAd = paidAds[Math.floor(Math.random() * paidAds.length)]
    adSource = 'paid'
  } else if (eligibleFreeAds.length > 0) {
    // Só há grátis
    selectedAd = eligibleFreeAds[Math.floor(Math.random() * eligibleFreeAds.length)]
    adSource = 'free'
  }

  // 4. Incrementar contador de impressões
  if (selectedAd) {
    const updateData: any = { impressions: { increment: 1 } }
    // Auto-pausar grátis se atingiu limite após esta impressão
    if (selectedAd.isFreeAd && selectedAd.impressionLimit > 0 && selectedAd.impressions + 1 >= selectedAd.impressionLimit) {
      updateData.status = 'PAUSED'
    }
    await db.ad.update({ where: { id: selectedAd.id }, data: updateData }).catch(() => {})
  }

  if (!selectedAd) {
    return NextResponse.json({ ad: null, source: 'placeholder' })
  }

  return NextResponse.json({
    ad: {
      id: selectedAd.id,
      title: selectedAd.title,
      content: selectedAd.content,
      imageUrl: selectedAd.imageUrl,
      linkUrl: selectedAd.linkUrl,
      placement: selectedAd.placement,
      isFreeAd: selectedAd.isFreeAd,
      impressionLimit: selectedAd.impressionLimit,
      impressions: selectedAd.impressions + 1,
      remaining: selectedAd.impressionLimit > 0
        ? Math.max(0, selectedAd.impressionLimit - selectedAd.impressions - 1)
        : null,
    },
    source: adSource,
  })
}
