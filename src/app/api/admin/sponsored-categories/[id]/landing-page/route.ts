import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { slugify } from '@/lib/utils'
import { parseEnterpriseLandingPageInput } from '@/lib/enterprise'

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
  const slug = slugify(body.slug)

  // Check slug uniqueness (excluding self if updating)
  const existing = await db.enterpriseLandingPage.findUnique({ where: { slug } })
  if (existing && existing.sponsoredCategoryId !== sc.id) {
    return NextResponse.json({ error: 'Slug já está em uso por outra empresa' }, { status: 400 })
  }

  let parsed: Record<string, unknown>
  try {
    parsed = parseEnterpriseLandingPageInput(body, { allowIsActive: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dados inválidos' }, { status: 400 })
  }
  const data = { ...parsed, slug, isActive: parsed.isActive ?? true }

  const lp = await db.enterpriseLandingPage.upsert({
    where: { sponsoredCategoryId: sc.id },
    update: data as any,
    create: { sponsoredCategoryId: sc.id, ...(data as any) },
  })

  return NextResponse.json({ ok: true, landingPage: lp })
}
