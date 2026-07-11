import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { getAllGateways, saveGatewayConfig, type GatewayConfig, type GatewayProvider } from '@/lib/payment-gateway'

// GET — list all gateway configs
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }
  const gateways = await getAllGateways()
  return NextResponse.json({ gateways })
}

// PUT — update a gateway config
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const { provider, ...data } = body

  if (!provider || !['ASAAS', 'MERCADO_PAGO', 'STRIPE'].includes(provider)) {
    return NextResponse.json({ error: 'Provider inválido' }, { status: 400 })
  }

  const config: GatewayConfig = {
    provider: provider as GatewayProvider,
    displayName: data.displayName || provider,
    apiKey: data.apiKey || '',
    secretKey: data.secretKey || '',
    webhookSecret: data.webhookSecret || '',
    accessToken: data.accessToken || '',
    publicKey: data.publicKey || '',
    isSandbox: data.isSandbox ?? true,
    isEnabled: data.isEnabled ?? false,
    isDefault: data.isDefault ?? false,
    acceptsPix: data.acceptsPix ?? false,
    acceptsBoleto: data.acceptsBoleto ?? false,
    acceptsCreditCard: data.acceptsCreditCard ?? false,
  }

  // If setting as default, unset others
  if (config.isDefault) {
    const all = await getAllGateways()
    for (const g of all) {
      if (g.provider !== config.provider && g.isDefault) {
        await saveGatewayConfig({ ...g, isDefault: false })
      }
    }
  }

  await saveGatewayConfig(config)
  return NextResponse.json({ ok: true, gateway: config })
}
