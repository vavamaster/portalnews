import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireMasterOrRespond } from '@/lib/api-helpers'
import { auditAdminAction } from '@/lib/admin-audit'

const PROVIDERS = new Set(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'TELEGRAM', 'WHATSAPP'])
const isSecretField = (key: string) => /(token|secret|password|apiKey)/i.test(key)
const maskCredential = (value: unknown) => typeof value === 'string' && value
  ? `********${value.slice(-4)}`
  : value

function maskedCredentials(raw: string | null) {
  try {
    const parsed = JSON.parse(raw || '{}') as Record<string, unknown>
    return JSON.stringify(Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, isSecretField(key) ? maskCredential(value) : value])))
  } catch {
    return '{}'
  }
}

// GET /api/admin/social — list all social configs
export async function GET(req: NextRequest) {
  const { user, response } = await requireMasterOrRespond(req)
  if (response) return response

  const configs = await db.socialConfig.findMany({ orderBy: { provider: 'asc' } })
  const recentPosts = await db.socialPost.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    configs: configs.map(config => ({ ...config, credentials: maskedCredentials(config.credentials) })),
    recentPosts,
  })
}

// POST /api/admin/social — create or update config
export async function POST(req: NextRequest) {
  const { user, response } = await requireMasterOrRespond(req)
  if (response) return response

  const body = await req.json()
  const { provider, displayName, credentials, isEnabled, autoPublish } = body

  if (!provider || !PROVIDERS.has(provider)) return NextResponse.json({ error: 'provider inválido' }, { status: 400 })

  const existing = await db.socialConfig.findUnique({ where: { provider } })
  let previousCredentials: Record<string, unknown> = {}
  try { previousCredentials = JSON.parse(existing?.credentials || '{}') } catch {}
  const incomingCredentials = credentials && typeof credentials === 'object' ? credentials : {}
  const mergedCredentials = Object.fromEntries(Object.entries(incomingCredentials).map(([key, value]) => [
    key,
    isSecretField(key) && typeof value === 'string' && value.startsWith('********')
      ? previousCredentials[key] || ''
      : value,
  ]))

  const config = await db.socialConfig.upsert({
    where: { provider },
    update: {
      displayName: displayName || provider,
      credentials: JSON.stringify(mergedCredentials),
      isEnabled: isEnabled ?? true,
      autoPublish: autoPublish ?? true,
    },
    create: {
      provider,
      displayName: displayName || provider,
      credentials: JSON.stringify(mergedCredentials),
      isEnabled: isEnabled ?? true,
      autoPublish: autoPublish ?? true,
    },
  })

  await auditAdminAction(req, user, existing ? 'UPDATE' : 'CREATE', 'SOCIAL_CONFIG', config.id, { provider, enabled: config.isEnabled })
  return NextResponse.json({ ok: true, config: { ...config, credentials: maskedCredentials(config.credentials) } })
}
