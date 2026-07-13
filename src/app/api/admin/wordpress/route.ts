import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond } from '@/lib/api-helpers'

// GET /api/admin/wordpress — list connections + import logs
export async function GET(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response

  const [connections, recentLogs] = await Promise.all([
    db.wPConnection.findMany({ orderBy: { createdAt: 'desc' } }),
    db.wPImportLog.findMany({ take: 20, orderBy: { createdAt: 'desc' } }),
  ])

  return NextResponse.json({ connections, recentLogs })
}

// Helper: build auth headers if credentials exist
function buildAuthHeader(username?: string | null, appPassword?: string | null): Record<string, string> | null {
  if (!username || !appPassword) return null
  const auth = Buffer.from(`${username}:${appPassword}`).toString('base64')
  return { Authorization: `Basic ${auth}` }
}

// Helper: probe WordPress site — tries with auth first, falls back to public API
// Returns { ok, mode, wpUser?, error? }
async function probeWordPressSite(siteUrl: string, username?: string, appPassword?: string): Promise<{
  ok: boolean
  mode: 'authenticated' | 'readonly' | 'failed'
  wpUser?: { name: string; slug: string }
  error?: string
}> {
  // 1. Try authenticated first (if credentials provided)
  if (username && appPassword) {
    try {
      const authHeaders = buildAuthHeader(username, appPassword)!
      const res = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
        headers: { ...authHeaders, 'User-Agent': 'PortalNews-Import/1.0' },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const wpUser = await res.json()
        return { ok: true, mode: 'authenticated', wpUser: { name: wpUser.name, slug: wpUser.slug } }
      }
      // 401/403 = auth failed, try public mode below
    } catch {
      // network error, try public mode below
    }
  }

  // 2. Try public read-only mode — fetch posts list (most WP sites allow this)
  try {
    const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
      headers: { 'User-Agent': 'PortalNews-Import/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      return { ok: true, mode: 'readonly' }
    }
    if (res.status === 401) {
      return { ok: false, mode: 'failed', error: 'WordPress requer autenticação e as credenciais fornecidas foram rejeitadas' }
    }
    if (res.status === 403) {
      return { ok: false, mode: 'failed', error: 'WordPress bloqueou o acesso (403). Pode ser firewall/WAF bloqueando application passwords. Verifique se a API REST está pública.' }
    }
    return { ok: false, mode: 'failed', error: `WordPress retornou HTTP ${res.status}` }
  } catch (e: any) {
    return { ok: false, mode: 'failed', error: `Erro ao conectar: ${e.message}` }
  }
}

// POST /api/admin/wordpress — create or update connection
export async function POST(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response

  const body = await req.json()
  if (!body.siteUrl) {
    return NextResponse.json({ error: 'siteUrl é obrigatório' }, { status: 400 })
  }

  // Normalize URL (remove trailing slash)
  const siteUrl = body.siteUrl.replace(/\/+$/, '')
  const username = body.username || null
  const appPassword = body.appPassword || null

  // Probe the site — try auth first, fall back to read-only
  const probe = await probeWordPressSite(siteUrl, username || undefined, appPassword || undefined)

  if (!probe.ok) {
    return NextResponse.json({ error: probe.error || 'Falha na conexão' }, { status: 400 })
  }

  // Upsert connection
  const conn = await db.wPConnection.upsert({
    where: { id: body.id || 'new' },
    update: {
      siteUrl,
      username,
      appPassword,
      isActive: true,
    },
    create: {
      siteUrl,
      username,
      appPassword,
      isActive: true,
    },
  })

  return NextResponse.json({
    ok: true,
    connection: conn,
    mode: probe.mode, // 'authenticated' | 'readonly'
    wpUser: probe.wpUser,
  })
}

// DELETE /api/admin/wordpress — delete connection
export async function DELETE(req: NextRequest) {
  const { user, response } = await requireAdminOrRespond(req)
  if (response) return response

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  await db.wPConnection.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
