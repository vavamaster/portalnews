import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { findServingEnterpriseCycle, parseEnterpriseAdInput } from '@/lib/enterprise'

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

  const body = await req.json().catch(() => null)
  if (!body || typeof body.sponsoredCategoryId !== 'string' || !body.sponsoredCategoryId.trim()) {
    return NextResponse.json({ error: 'sponsoredCategoryId e title são obrigatórios' }, { status: 400 })
  }

  let creative: Record<string, unknown>
  try {
    creative = parseEnterpriseAdInput(body)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dados inválidos' }, { status: 400 })
  }

  const sc = await db.sponsoredCategory.findUnique({
    where: { id: body.sponsoredCategoryId },
    include: { category: { select: { name: true } } },
  })
  if (!sc) return NextResponse.json({ error: 'Categoria patrocinada não encontrada' }, { status: 404 })
  if (!sc.isActive || sc.mode === 'DISABLED') {
    return NextResponse.json({ error: 'Esta categoria não está disponível para veiculação' }, { status: 409 })
  }

  const activeCycle = await findServingEnterpriseCycle(sc.id, user.id)
  if (!activeCycle) {
    return NextResponse.json({
      error: 'Você não tem ciclo de cobrança ativo nesta categoria. Entre em contato com o comercial.',
    }, { status: 403 })
  }

  // Enforce maxRotatingAds
  const activeAds = await db.enterpriseAd.count({
    where: {
      sponsoredCategoryId: sc.id,
      ...(sc.mode === 'EXCLUSIVE' ? {} : { ownerId: user.id }),
      status: { in: ['ACTIVE', 'PENDING'] },
    },
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
      ...(creative as any),
      status: 'PENDING', // always starts pending admin approval
      order: 0,
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
        message: `${link.companyName} enviou um novo anúncio para "${sc.category.name}". Aprove ou rejeite no painel admin.`,
        link: 'admin',
      },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, ad })
}
