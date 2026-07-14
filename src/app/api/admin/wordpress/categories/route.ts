import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { handleApiError } from '@/lib/api-helpers'

// GET /api/admin/wordpress/categories?connectionId=xxx
// Returns WordPress categories with post counts — for summary cards in the import UI
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const connectionId = url.searchParams.get('connectionId')
  if (!connectionId) return NextResponse.json({ error: 'connectionId é obrigatório' }, { status: 400 })

  const conn = await db.wPConnection.findUnique({ where: { id: connectionId } })
  if (!conn) return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 })

  try {
    const headers: Record<string, string> = { 'User-Agent': 'PortalNews-Import/1.0' }
    if (conn.username && conn.appPassword) {
      const auth = Buffer.from(`${conn.username}:${conn.appPassword}`).toString('base64')
      headers.Authorization = `Basic ${auth}`
    }

    const res = await fetch(`${conn.siteUrl}/wp-json/wp/v2/categories?per_page=100&_fields=id,name,slug,count,description`, {
      headers,
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) return NextResponse.json({ error: `WordPress retornou HTTP ${res.status}` }, { status: 502 })

    const wpCategories = await res.json()
    const mappings = await db.wPCategoryMapping.findMany({ where: { connectionId } })
    const mappingMap = new Map(mappings.map(m => [m.wpCategory, m.categoryId]))
    const portalCats = await db.category.findMany()
    const portalCatMap = new Map(portalCats.map(c => [c.id, c]))

    const result = wpCategories
      .filter((cat: any) => cat.count > 0)
      .map((cat: any) => {
        const mappedCategoryId = mappingMap.get(cat.name)
        const portalCat = mappedCategoryId ? portalCatMap.get(mappedCategoryId) : null
        const autoMatched = !portalCat ? portalCats.find(c =>
          c.name.toLowerCase() === cat.name.toLowerCase() ||
          c.slug.toLowerCase() === cat.slug.toLowerCase()
        ) : null

        return {
          wpId: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description || '',
          postCount: cat.count,
          mappedTo: portalCat ? { id: portalCat.id, name: portalCat.name } : null,
          autoMatch: autoMatched ? { id: autoMatched.id, name: autoMatched.name } : null,
          needsMapping: !portalCat && !autoMatched,
        }
      })
      .sort((a: any, b: any) => b.postCount - a.postCount)

    return NextResponse.json({
      categories: result,
      totalPosts: result.reduce((sum: number, c: any) => sum + c.postCount, 0),
    })
  } catch (e: any) {
    return handleApiError(e, 'wp categories list')
  }
}
