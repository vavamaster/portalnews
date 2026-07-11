import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/landing-page/[slug]
// Public endpoint — returns the landing page data for an EXCLUSIVE sponsor.
// Used by the public /empresa/[slug] page.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const lp = await db.enterpriseLandingPage.findUnique({
    where: { slug },
    include: {
      sponsoredCategory: {
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
    },
  })
  if (!lp || !lp.isActive) {
    return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 })
  }

  // Parse JSON fields
  const parse = (s: string | null | undefined) => {
    if (!s) return []
    try { return JSON.parse(s) } catch { return [] }
  }

  return NextResponse.json({
    id: lp.id,
    companyName: lp.companyName,
    slug: lp.slug,
    niche: lp.niche,
    logoUrl: lp.logoUrl,
    primaryColor: lp.primaryColor,
    heroTitle: lp.heroTitle,
    heroSubtitle: lp.heroSubtitle,
    heroImageUrl: lp.heroImageUrl,
    aboutText: lp.aboutText,
    products: parse(lp.productsJson),
    services: parse(lp.servicesJson),
    gallery: parse(lp.galleryJson),
    videoUrls: parse(lp.videoUrlsJson),
    phone: lp.phone,
    whatsapp: lp.whatsapp,
    email: lp.email,
    website: lp.website,
    facebookUrl: lp.facebookUrl,
    instagramUrl: lp.instagramUrl,
    youtubeUrl: lp.youtubeUrl,
    linkedinUrl: lp.linkedinUrl,
    address: lp.address,
    latitude: lp.latitude,
    longitude: lp.longitude,
    city: lp.city,
    state: lp.state,
    zipCode: lp.zipCode,
    seoTitle: lp.seoTitle,
    seoDescription: lp.seoDescription,
    seoKeywords: lp.seoKeywords,
    categoryName: lp.sponsoredCategory.category.name,
  })
}
