import { NextRequest, NextResponse } from 'next/server'
import { requireMasterOrRespond } from '@/lib/api-helpers'
import { getAllGateways, saveGatewayConfig, type GatewayConfig, type GatewayProvider } from '@/lib/payment-gateway'
import { auditAdminAction } from '@/lib/admin-audit'

const SECRET_FIELDS = ['apiKey', 'secretKey', 'webhookSecret', 'accessToken'] as const
const maskSecret = (value: string) => value ? `********${value.slice(-4)}` : ''
const publicGateway = (gateway: GatewayConfig) => ({
  ...gateway,
  ...Object.fromEntries(SECRET_FIELDS.map(field => [field, maskSecret(gateway[field])])),
})

// GET — list all gateway configs
export async function GET(req: NextRequest) {
  const { user, response } = await requireMasterOrRespond(req)
  if (response) return response
  const gateways = await getAllGateways()
  return NextResponse.json({ gateways: gateways.map(publicGateway) })
}

// PUT — update a gateway config
export async function PUT(req: NextRequest) {
  const { user, response } = await requireMasterOrRespond(req)
  if (response) return response

  const body = await req.json()
  const { provider, ...data } = body

  if (!provider || !['ASAAS', 'MERCADO_PAGO', 'STRIPE'].includes(provider)) {
    return NextResponse.json({ error: 'Provider inválido' }, { status: 400 })
  }

  const existing = (await getAllGateways()).find(gateway => gateway.provider === provider)
  const keepOrReplace = (field: typeof SECRET_FIELDS[number]) => {
    const value = typeof data[field] === 'string' ? data[field] : ''
    return value.startsWith('********') ? existing?.[field] || '' : value
  }
  const config: GatewayConfig = {
    provider: provider as GatewayProvider,
    displayName: data.displayName || provider,
    apiKey: keepOrReplace('apiKey'),
    secretKey: keepOrReplace('secretKey'),
    webhookSecret: keepOrReplace('webhookSecret'),
    accessToken: keepOrReplace('accessToken'),
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
  await auditAdminAction(req, user, 'UPDATE', 'PAYMENT_GATEWAY', provider, {
    enabled: config.isEnabled,
    sandbox: config.isSandbox,
    isDefault: config.isDefault,
  })
  return NextResponse.json({ ok: true, gateway: publicGateway(config) })
}
