import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/enterprise/ads — list all ads owned by the current Enterprise user
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const link = await db.enterpriseUserLink.findUnique({ where: { userId: user.id } })
  if (!link || !link.isActive) {
    return NextResponse.json({ error: 'Você não tem acesso Enterprise' }, { status: 403 })
  }

  const ads = await db.enterpriseAd.findMany({
    where: { ownerId: user.id },
    include: {
      sponsoredCategory: {
        include: {
          category: { select: { id: true, name: true, slug: true } },
          landingPage: { select: { slug: true, companyName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ ads })
}

// POST /api/enterprise/ads — Enterprise user creates a new ad
// Body: { sponsoredCategoryId, title, subtitle, logoUrl, imageUrl, videoUrl, linkUrl, ctaText }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const link = await db.enterpriseUserLink.findUnique({ where: { userId: user.id } })
  if (!link || !link.isActive) {
    return NextResponse.json({ error: 'Você não tem acesso Enterprise' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.sponsoredCategoryId || !body.title) {
    return NextResponse.json({ error: 'sponsoredCategoryId e title são obrigatórios' }, { status: 400 })
  }

  const sc = await db.sponsoredCategory.findUnique({ where: { id: body.sponsoredCategoryId } })
  if (!sc) return NextResponse.json({ error: 'Categoria patrocinada não encontrada' }, { status: 404 })

  // Check active billing cycle for this user
  const activeCycle = await db.enterpriseBillingCycle.findFirst({
    where: {
      sponsoredCategoryId: sc.id,
      userId: user.id,
      status: 'ACTIVE',
    },
  })
  if (!activeCycle) {
    return NextResponse.json({
      error: 'Você não tem ciclo de cobrança ativo nesta categoria. Entre em contato com o comercial.',
    }, { status: 403 })
  }

  // Enforce maxRotatingAds
  const activeAds = await db.enterpriseAd.count({
    where: { sponsoredCategoryId: sc.id, ownerId: user.id, status: { in: ['ACTIVE', 'PENDING', 'PAUSED'] } },
  })
  if (activeAds >= sc.maxRotatingAds) {
    return NextResponse.json({
      error: `Você atingiu o limite de ${sc.maxRotatingAds} anúncio(s) nesta categoria. Exclua um para criar outro.`,
    }, { status: 400 })
  }

  const ad = await db.enterpriseAd.create({
    data: {
      sponsoredCategoryId: sc.id,
      ownerId: user.id,
      title: body.title,
      subtitle: body.subtitle || null,
      logoUrl: body.logoUrl || null,
      imageUrl: body.imageUrl || null,
      videoUrl: body.videoUrl || null,
      linkUrl: body.linkUrl || null,
      ctaText: body.ctaText || null,
      status: 'PENDING', // always starts pending admin approval
      order: body.order || 0,
    },
  })

  // Notify admin (find any MASTER/ADMIN user)
  const admin = await db.user.findFirst({ where: { role: 'MASTER' } })
  if (admin) {
    await db.notification.create({
      data: {
        userId: admin.id,
        type: 'SYSTEM',
        title: '🎯 Novo anúncio Enterprise para revisão',
        message: `${link.companyName} enviou um novo anúncio para "${sc.categoryId}". Aprove ou rejeite no painel admin.`,
        link: 'admin',
      },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, ad })
}
