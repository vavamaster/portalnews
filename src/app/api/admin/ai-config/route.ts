import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireMasterOrRespond } from '@/lib/api-helpers'
import { PROVIDER_PRESETS } from '@/lib/ai-provider'
import { auditAdminAction } from '@/lib/admin-audit'

const maskApiKey = <T extends { apiKey?: string | null }>(config: T) => ({
  ...config,
  apiKey: config.apiKey ? `********${config.apiKey.slice(-4)}` : null,
})

// GET - list all AI configs
export async function GET(req: NextRequest) {
  const { user, response } = await requireMasterOrRespond(req)
  if (response) return response

  const configs = await db.aIConfig.findMany({ orderBy: { provider: 'asc' } })
  // A8 fix: mask apiKey in response (show only last 4 chars)
  const maskedConfigs = configs.map(maskApiKey)
  return NextResponse.json({ configs: maskedConfigs, presets: PROVIDER_PRESETS })
}

// PUT - update or create config
export async function PUT(req: NextRequest) {
  const { user, response } = await requireMasterOrRespond(req)
  if (response) return response

  const body = await req.json()
  const { id, provider, ...data } = body

  if (!provider) return NextResponse.json({ error: 'Provider obrigatório' }, { status: 400 })

  // A8 fix: if apiKey is masked (starts with ••••), don't overwrite — keep existing
  if (data.apiKey && (data.apiKey.startsWith('••••') || data.apiKey.startsWith('********'))) {
    delete data.apiKey
  }

  // If setting as default, unset others
  if (data.isDefault) {
    await db.aIConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
  }

  const existing = await db.aIConfig.findUnique({ where: { provider } })
  if (existing) {
    const updated = await db.aIConfig.update({ where: { id: existing.id }, data })
    await auditAdminAction(req, user, 'UPDATE', 'AI_CONFIG', existing.id, { provider, fields: Object.keys(data) })
    return NextResponse.json({ config: maskApiKey(updated) })
  }

  const created = await db.aIConfig.create({
    data: { provider, ...data },
  })
  await auditAdminAction(req, user, 'CREATE', 'AI_CONFIG', created.id, { provider })
  return NextResponse.json({ config: maskApiKey(created) })
}

// POST - create new config from preset
export async function POST(req: NextRequest) {
  const { user, response } = await requireMasterOrRespond(req)
  if (response) return response

  const body = await req.json()
  const { provider } = body

  const preset = PROVIDER_PRESETS.find(p => p.provider === provider)
  if (!preset) return NextResponse.json({ error: 'Provider desconhecido' }, { status: 400 })

  const existing = await db.aIConfig.findUnique({ where: { provider } })
  if (existing) return NextResponse.json({ error: 'Provider já existe' }, { status: 400 })

  const config = await db.aIConfig.create({
    data: {
      provider: preset.provider,
      displayName: preset.displayName,
      description: preset.description,
      baseUrl: preset.baseUrl,
      apiKey: null,
      model: preset.model,
      isEnabled: false,
      isDefault: false,
    },
  })
  await auditAdminAction(req, user, 'CREATE', 'AI_CONFIG', config.id, { provider })
  return NextResponse.json({ config })
}
