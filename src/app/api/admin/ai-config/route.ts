import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { PROVIDER_PRESETS } from '@/lib/ai-provider'

// GET - list all AI configs
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const configs = await db.aIConfig.findMany({ orderBy: { provider: 'asc' } })
  // A8 fix: mask apiKey in response (show only last 4 chars)
  const maskedConfigs = configs.map(c => ({
    ...c,
    apiKey: c.apiKey ? '••••••••' + c.apiKey.slice(-4) : null,
  }))
  return NextResponse.json({ configs: maskedConfigs, presets: PROVIDER_PRESETS })
}

// PUT - update or create config
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const body = await req.json()
  const { id, provider, ...data } = body

  if (!provider) return NextResponse.json({ error: 'Provider obrigatório' }, { status: 400 })

  // A8 fix: if apiKey is masked (starts with ••••), don't overwrite — keep existing
  if (data.apiKey && data.apiKey.startsWith('••••')) {
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
    return NextResponse.json({ config: updated })
  }

  const created = await db.aIConfig.create({
    data: { provider, ...data },
  })
  return NextResponse.json({ config: created })
}

// POST - create new config from preset
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

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
  return NextResponse.json({ config })
}
