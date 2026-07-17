import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { testProvider } from '@/lib/ai-provider'
import { safeReqJson } from '@/lib/api-helpers'
import { decryptSecret } from '@/lib/secret-storage'

// POST /api/admin/ai-config/test
// Body: { id: string } — tests the AI provider config by making a simple chat completion
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || user.role !== 'MASTER') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await safeReqJson<{ id?: string }>(req)
  if (!body.ok) return body.response
  const { id } = body.data
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const cfg = await db.aIConfig.findUnique({ where: { id } })
  if (!cfg) return NextResponse.json({ error: 'Config não encontrada' }, { status: 404 })

  try {
    const result = await testProvider({
      id: cfg.id,
      provider: cfg.provider,
      displayName: cfg.displayName,
      baseUrl: cfg.baseUrl,
      apiKey: decryptSecret(cfg.apiKey, `ai:${cfg.provider}`) || null,
      model: cfg.model,
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature,
    })
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[AI config test] failed:', e)
    return NextResponse.json({ success: false, error: 'Falha ao testar o provedor' }, { status: 500 })
  }
}
