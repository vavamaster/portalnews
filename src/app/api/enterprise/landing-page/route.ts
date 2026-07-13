import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { slugify, uniqueSlug } from '@/lib/utils'

// GET /api/enterprise/landing-page?sponsoredCategoryId=xxx
// Returns the landing page for an EXCLUSIVE sponsor owned by the current user.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const link = await db.enterpriseUserLink.findUnique({ where: { userId: user.id } })
  if (!link || !link.isActive) {
    return NextResponse.json({ error: 'Você não tem acesso Enterprise' }, { status: 403 })
  }

  const url = new URL(req.url)
  const sponsoredCategoryId = url.searchParams.get('sponsoredCategoryId')
  if (!sponsoredCategoryId) {
    return NextResponse.json({ error: 'sponsoredCategoryId é obrigatório' }, { status: 400 })
  }

  const sc = await db.sponsoredCategory.findUnique({
    where: { id: sponsoredCategoryId },
    include: { category: true, landingPage: true },
  })
  if (!sc) return NextResponse.json({ error: 'Categoria patrocinada não encontrada' }, { status: 404 })
  if (sc.mode !== 'EXCLUSIVE') {
    return NextResponse.json({ error: 'Landing page só está disponível no modo EXCLUSIVE' }, { status: 400 })
  }

  // Verify the user is the active sponsor for this category
  const ad = await db.enterpriseAd.findFirst({
    where: { sponsoredCategoryId: sc.id, ownerId: user.id },
  })
  if (!ad) {
    return NextResponse.json({ error: 'Você não tem permissão sobre esta categoria' }, { status: 403 })
  }

  return NextResponse.json({
    sponsor: {
      id: sc.id,
      mode: sc.mode,
      categoryName: sc.category.name,
    },
    landingPage: sc.landingPage,
  })
}

// POST /api/enterprise/landing-page
// Enterprise user updates their landing page.
// Body: { sponsoredCategoryId, ...fields }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const link = await db.enterpriseUserLink.findUnique({ where: { userId: user.id } })
  if (!link || !link.isActive) {
    return NextResponse.json({ error: 'Você não tem acesso Enterprise' }, { status: 403 })
  }

  const body = await req.json()
  const { sponsoredCategoryId, ...fields } = body
  if (!sponsoredCategoryId) return NextResponse.json({ error: 'sponsoredCategoryId é obrigatório' }, { status: 400 })

  const sc = await db.sponsoredCategory.findUnique({ where: { id: sponsoredCategoryId } })
  if (!sc) return NextResponse.json({ error: 'Categoria patrocinada não encontrada' }, { status: 404 })
  if (sc.mode !== 'EXCLUSIVE') {
    return NextResponse.json({ error: 'Landing page só está disponível no modo EXCLUSIVE' }, { status: 400 })
  }

  // Verify ownership — user must have an ACTIVE billing cycle in this sponsor
  const activeCycle = await db.enterpriseBillingCycle.findFirst({
    where: { sponsoredCategoryId: sc.id, userId: user.id, status: 'ACTIVE' },
  })
  if (!activeCycle) {
    return NextResponse.json({ error: 'Você não tem um ciclo ativo nesta categoria' }, { status: 403 })
  }

  // Get the user's company name for slug generation
  const userLink = await db.enterpriseUserLink.findUnique({ where: { userId: user.id } })
  const userCompanyName = userLink?.companyName || user.name

  // Allowed fields (slug can NOT be changed by the user — only admin)
  const allowed = ['companyName', 'niche', 'logoUrl', 'primaryColor', 'heroTitle', 'heroSubtitle',
    'heroImageUrl', 'aboutText', 'productsJson', 'servicesJson', 'galleryJson', 'videoUrlsJson',
    'phone', 'whatsapp', 'email', 'website', 'facebookUrl', 'instagramUrl', 'youtubeUrl',
    'linkedinUrl', 'address', 'latitude', 'longitude', 'city', 'state', 'zipCode',
    'seoTitle', 'seoDescription', 'seoKeywords']
  const data: any = {}
  for (const k of allowed) {
    if (k in fields) data[k] = fields[k]
  }
  if (data.latitude !== undefined) data.latitude = data.latitude ? parseFloat(data.latitude) : null
  if (data.longitude !== undefined) data.longitude = data.longitude ? parseFloat(data.longitude) : null

  // Generate slug from company name (always fresh — no stale slugs from old companies)
  const slugBase = slugify(data.companyName || userCompanyName || 'empresa')
  const slug = await uniqueSlug(slugBase, async (s) => !!(await db.enterpriseLandingPage.findFirst({ where: { slug: s, sponsoredCategoryId: { not: sc.id } } })))

  const lp = await db.enterpriseLandingPage.upsert({
    where: { sponsoredCategoryId: sc.id },
    update: { ...data, slug }, // always update slug to match current company
    create: { sponsoredCategoryId: sc.id, companyName: data.companyName || userCompanyName, slug, ...data },
  })

  return NextResponse.json({ ok: true, landingPage: lp })
}
