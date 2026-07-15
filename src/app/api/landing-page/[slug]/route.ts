import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isEnterpriseCycleEligible, safeEnterpriseUrl } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

// GET /api/landing-page/[slug]
// Public endpoint — returns the landing page data for an EXCLUSIVE sponsor.
// Used by the public /empresa/[slug] page.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const lp = await db.enterpriseLandingPage.findUnique({
    where: { slug },
    include: {
      sponsoredCategory: {
        include: {
          category: { select: { id: true, name: true, slug: true } },
          billingCycles: {
            where: { status: 'ACTIVE' },
            include: { user: { select: { enterpriseLink: { select: { isActive: true } } } } },
            orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
          },
        },
      },
    },
  })
  const activeCycle = lp?.sponsoredCategory.billingCycles.find(cycle => (
    cycle.user.enterpriseLink?.isActive && isEnterpriseCycleEligible(cycle)
  ))
  if (!lp || !lp.isActive || !lp.sponsoredCategory.isActive || lp.sponsoredCategory.mode !== 'EXCLUSIVE' || !activeCycle) {
    return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 })
  }

  // Parse JSON fields
  const parse = (s: string | null | undefined) => {
    if (!s) return []
    try {
      const value = JSON.parse(s)
      return Array.isArray(value) ? value : []
    } catch { return [] }
  }
  const products = parse(lp.productsJson).filter(item => item && typeof item === 'object').slice(0, 100).map(item => ({
    name: String(item.name || '').slice(0, 160),
    description: item.description ? String(item.description).slice(0, 1000) : null,
    price: item.price ? String(item.price).slice(0, 80) : null,
    imageUrl: safeEnterpriseUrl(item.imageUrl, { allowRelative: true }),
  })).filter(item => item.name)
  const services = parse(lp.servicesJson).filter(item => item && typeof item === 'object').slice(0, 100).map(item => ({
    name: String(item.name || '').slice(0, 160),
    description: item.description ? String(item.description).slice(0, 1000) : null,
    price: item.price ? String(item.price).slice(0, 80) : null,
  })).filter(item => item.name)
  const gallery = parse(lp.galleryJson).map(item => safeEnterpriseUrl(item, { allowRelative: true })).filter(Boolean)
  const videoUrls = parse(lp.videoUrlsJson).map(item => safeEnterpriseUrl(item, { youtubeOnly: true })).filter(Boolean)

  return NextResponse.json({
    id: lp.id,
    companyName: lp.companyName,
    slug: lp.slug,
    niche: lp.niche,
    logoUrl: safeEnterpriseUrl(lp.logoUrl, { allowRelative: true }),
    primaryColor: lp.primaryColor,
    heroTitle: lp.heroTitle,
    heroSubtitle: lp.heroSubtitle,
    heroImageUrl: safeEnterpriseUrl(lp.heroImageUrl, { allowRelative: true }),
    aboutText: lp.aboutText,
    products,
    services,
    gallery,
    videoUrls,
    phone: lp.phone,
    whatsapp: lp.whatsapp,
    email: lp.email,
    website: safeEnterpriseUrl(lp.website),
    facebookUrl: safeEnterpriseUrl(lp.facebookUrl),
    instagramUrl: safeEnterpriseUrl(lp.instagramUrl),
    youtubeUrl: safeEnterpriseUrl(lp.youtubeUrl),
    linkedinUrl: safeEnterpriseUrl(lp.linkedinUrl),
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
