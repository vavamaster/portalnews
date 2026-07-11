import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// POST /api/admin/sponsored-categories/[id]/landing-page
// Admin creates/updates the landing page for an EXCLUSIVE sponsor.
// Body: full landing page fields (see schema).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id } = await params
  const sc = await db.sponsoredCategory.findUnique({ where: { id } })
  if (!sc) return NextResponse.json({ error: 'Sponsor não encontrado' }, { status: 404 })
  if (sc.mode !== 'EXCLUSIVE') {
    return NextResponse.json({ error: 'Landing page só está disponível no modo EXCLUSIVE' }, { status: 400 })
  }

  const body = await req.json()
  if (!body.companyName || !body.slug) {
    return NextResponse.json({ error: 'companyName e slug são obrigatórios' }, { status: 400 })
  }

  // Normalize slug
  const slug = body.slug.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  // Check slug uniqueness (excluding self if updating)
  const existing = await db.enterpriseLandingPage.findUnique({ where: { slug } })
  if (existing && existing.sponsoredCategoryId !== sc.id) {
    return NextResponse.json({ error: 'Slug já está em uso por outra empresa' }, { status: 400 })
  }

  const data = {
    companyName: body.companyName,
    slug,
    niche: body.niche || null,
    logoUrl: body.logoUrl || null,
    primaryColor: body.primaryColor || null,
    heroTitle: body.heroTitle || null,
    heroSubtitle: body.heroSubtitle || null,
    heroImageUrl: body.heroImageUrl || null,
    aboutText: body.aboutText || null,
    productsJson: body.productsJson || null,
    servicesJson: body.servicesJson || null,
    galleryJson: body.galleryJson || null,
    videoUrlsJson: body.videoUrlsJson || null,
    phone: body.phone || null,
    whatsapp: body.whatsapp || null,
    email: body.email || null,
    website: body.website || null,
    facebookUrl: body.facebookUrl || null,
    instagramUrl: body.instagramUrl || null,
    youtubeUrl: body.youtubeUrl || null,
    linkedinUrl: body.linkedinUrl || null,
    address: body.address || null,
    latitude: body.latitude ? parseFloat(body.latitude) : null,
    longitude: body.longitude ? parseFloat(body.longitude) : null,
    city: body.city || null,
    state: body.state || null,
    zipCode: body.zipCode || null,
    seoTitle: body.seoTitle || null,
    seoDescription: body.seoDescription || null,
    seoKeywords: body.seoKeywords || null,
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
  }

  const lp = await db.enterpriseLandingPage.upsert({
    where: { sponsoredCategoryId: sc.id },
    update: data,
    create: { sponsoredCategoryId: sc.id, ...data },
  })

  return NextResponse.json({ ok: true, landingPage: lp })
}
