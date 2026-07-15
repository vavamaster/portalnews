import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { slugify, uniqueSlug } from '@/lib/utils'
import { findServingEnterpriseCycle, parseEnterpriseLandingPageInput } from '@/lib/enterprise'

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

  // Only the currently contracted company may read/edit this sponsor page.
  const activeCycle = await findServingEnterpriseCycle(sc.id, user.id)
  if (!activeCycle) {
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
  const activeCycle = await findServingEnterpriseCycle(sc.id, user.id)
  if (!activeCycle) {
    return NextResponse.json({ error: 'Você não tem um ciclo ativo nesta categoria' }, { status: 403 })
  }

  // Get the user's company name for slug generation
  const userLink = await db.enterpriseUserLink.findUnique({ where: { userId: user.id } })
  const userCompanyName = userLink?.companyName || user.name

  let data: Record<string, unknown>
  try {
    data = parseEnterpriseLandingPageInput({ ...fields, companyName: fields.companyName || userCompanyName })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dados inválidos' }, { status: 400 })
  }

  // Generate slug from company name (always fresh — no stale slugs from old companies)
  const slugBase = slugify(String(data.companyName || userCompanyName || 'empresa'))
  const slug = await uniqueSlug(slugBase, async (s) => !!(await db.enterpriseLandingPage.findFirst({ where: { slug: s, sponsoredCategoryId: { not: sc.id } } })))

  const lp = await db.enterpriseLandingPage.upsert({
    where: { sponsoredCategoryId: sc.id },
    update: { ...data, slug }, // always update slug to match current company
    create: { sponsoredCategoryId: sc.id, companyName: String(data.companyName || userCompanyName), slug, ...(data as any) },
  })

  return NextResponse.json({ ok: true, landingPage: lp })
}
