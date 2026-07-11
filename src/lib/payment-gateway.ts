import { db } from './db'
import { getSeoSetting } from './seo'

/**
 * Gateway configuration stored in SeoSetting as JSON.
 * Keys: gateway_asaas, gateway_mercado_pago, gateway_stripe
 */

export type GatewayProvider = 'ASAAS' | 'MERCADO_PAGO' | 'STRIPE'

export interface GatewayConfig {
  provider: GatewayProvider
  displayName: string
  apiKey: string
  secretKey: string
  webhookSecret: string
  accessToken: string
  publicKey: string
  isSandbox: boolean
  isEnabled: boolean
  isDefault: boolean
  acceptsPix: boolean
  acceptsBoleto: boolean
  acceptsCreditCard: boolean
}

const DEFAULTS: Record<GatewayProvider, Omit<GatewayConfig, 'apiKey' | 'secretKey' | 'webhookSecret' | 'accessToken' | 'publicKey'>> = {
  ASAAS: {
    provider: 'ASAAS',
    displayName: 'Asaas',
    isSandbox: true,
    isEnabled: false,
    isDefault: false,
    acceptsPix: true,
    acceptsBoleto: true,
    acceptsCreditCard: true,
  },
  MERCADO_PAGO: {
    provider: 'MERCADO_PAGO',
    displayName: 'Mercado Pago',
    isSandbox: true,
    isEnabled: false,
    isDefault: false,
    acceptsPix: true,
    acceptsBoleto: true,
    acceptsCreditCard: true,
  },
  STRIPE: {
    provider: 'STRIPE',
    displayName: 'Stripe',
    isSandbox: true,
    isEnabled: false,
    isDefault: false,
    acceptsPix: false,
    acceptsBoleto: false,
    acceptsCreditCard: true,
  },
}

export async function getGatewayConfig(provider: GatewayProvider): Promise<GatewayConfig | null> {
  const key = `gateway_${provider.toLowerCase()}`
  const raw = await getSeoSetting(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as GatewayConfig
  } catch {
    return null
  }
}

export async function getAllGateways(): Promise<GatewayConfig[]> {
  const providers: GatewayProvider[] = ['ASAAS', 'MERCADO_PAGO', 'STRIPE']
  const configs: GatewayConfig[] = []
  for (const p of providers) {
    const cfg = await getGatewayConfig(p)
    if (cfg) configs.push(cfg)
    else configs.push({ ...DEFAULTS[p], apiKey: '', secretKey: '', webhookSecret: '', accessToken: '', publicKey: '' })
  }
  return configs
}

export async function saveGatewayConfig(config: GatewayConfig): Promise<void> {
  const key = `gateway_${config.provider.toLowerCase()}`
  await db.seoSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(config) },
    create: { key, value: JSON.stringify(config) },
  })
}

export async function getDefaultGateway(): Promise<GatewayConfig | null> {
  // Try default first
  for (const p of ['ASAAS', 'MERCADO_PAGO', 'STRIPE'] as GatewayProvider[]) {
    const cfg = await getGatewayConfig(p)
    if (cfg && cfg.isEnabled && cfg.isDefault) return cfg
  }
  // Fallback to any enabled
  for (const p of ['ASAAS', 'MERCADO_PAGO', 'STRIPE'] as GatewayProvider[]) {
    const cfg = await getGatewayConfig(p)
    if (cfg && cfg.isEnabled) return cfg
  }
  return null
}

// === Base URLs ===

export function getBaseUrl(provider: GatewayProvider, isSandbox: boolean): string {
  switch (provider) {
    case 'ASAAS':
      return isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3'
    case 'MERCADO_PAGO':
      return isSandbox ? 'https://api.mercadopago.com' : 'https://api.mercadopago.com'
    case 'STRIPE':
      return 'https://api.stripe.com/v1'
  }
}

// === Payment Creation ===

export interface CreatePaymentParams {
  userId: string
  userName: string
  userEmail: string
  planName: string
  amountCents: number
  paymentMethod: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  couponCode?: string
}

export interface CreatePaymentResult {
  success: boolean
  provider: GatewayProvider
  externalId: string
  status: string
  pixQrCode?: string
  pixCopyPaste?: string
  boletoUrl?: string
  boletoBarcode?: string
  checkoutUrl?: string
  message: string
}

export async function createPayment(
  gateway: GatewayConfig,
  params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  switch (gateway.provider) {
    case 'ASAAS':
      return createAsaasPayment(gateway, params)
    case 'MERCADO_PAGO':
      return createMercadoPagoPayment(gateway, params)
    case 'STRIPE':
      return createStripePayment(gateway, params)
  }
}

// === ASAAS ===

async function createAsaasPayment(gateway: GatewayConfig, params: CreatePaymentParams): Promise<CreatePaymentResult> {
  const baseUrl = getBaseUrl('ASAAS', gateway.isSandbox)
  const amount = (params.amountCents / 100).toFixed(2)

  try {
    // 1. Create or find customer
    const customerRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': gateway.apiKey,
      },
      body: JSON.stringify({
        name: params.userName,
        email: params.userEmail,
        externalReference: params.userId,
      }),
    })
    const customer = await customerRes.json()
    const customerId = customer.id

    if (!customerId) {
      return { success: false, provider: 'ASAAS', externalId: '', status: 'FAILED', message: 'Erro ao criar cliente no Asaas' }
    }

    // 2. Create payment
    const billingType = params.paymentMethod === 'PIX' ? 'PIX' : params.paymentMethod === 'BOLETO' ? 'BOLETO' : 'CREDIT_CARD'
    const paymentBody: any = {
      customer: customerId,
      billingType,
      value: parseFloat(amount),
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      description: params.planName,
      externalReference: params.userId,
    }

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': gateway.apiKey,
      },
      body: JSON.stringify(paymentBody),
    })
    const payment = await paymentRes.json()

    if (!payment.id) {
      return { success: false, provider: 'ASAAS', externalId: '', status: 'FAILED', message: payment.errors?.[0]?.description || 'Erro ao criar pagamento' }
    }

    return {
      success: true,
      provider: 'ASAAS',
      externalId: payment.id,
      status: 'PENDING',
      pixQrCode: payment.pixQrCode,
      pixCopyPaste: payment.pixCopyPaste,
      boletoUrl: payment.bankSlipUrl,
      boletoBarcode: payment.bankSlipBarcode,
      checkoutUrl: payment.invoiceUrl,
      message: 'Pagamento criado no Asaas',
    }
  } catch (e: any) {
    return { success: false, provider: 'ASAAS', externalId: '', status: 'FAILED', message: e.message }
  }
}

// === MERCADO PAGO ===

async function createMercadoPagoPayment(gateway: GatewayConfig, params: CreatePaymentParams): Promise<CreatePaymentResult> {
  const baseUrl = getBaseUrl('MERCADO_PAGO', gateway.isSandbox)
  const amount = (params.amountCents / 100).toFixed(2)

  try {
    const body: any = {
      transaction_amount: parseFloat(amount),
      description: params.planName,
      payer: {
        email: params.userEmail,
        name: params.userName,
      },
      metadata: { user_id: params.userId },
    }

    if (params.paymentMethod === 'PIX') {
      body.payment_method_id = 'pix'
      const res = await fetch(`${baseUrl}/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gateway.accessToken}`,
        },
        body: JSON.stringify(body),
      })
      const payment = await res.json()
      if (payment.id) {
        return {
          success: true,
          provider: 'MERCADO_PAGO',
          externalId: String(payment.id),
          status: 'PENDING',
          pixQrCode: payment.point_of_interaction?.transaction_data?.qr_code_base64,
          pixCopyPaste: payment.point_of_interaction?.transaction_data?.qr_code,
          message: 'Pagamento PIX criado no Mercado Pago',
        }
      }
    } else {
      // Checkout preference for boleto/card
      const prefBody = {
        items: [{
          title: params.planName,
          unit_price: parseFloat(amount),
          quantity: 1,
          currency_id: 'BRL',
        }],
        payer: { email: params.userEmail, name: params.userName },
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?view=assinatura&status=success`,
          failure: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?view=assinatura&status=failure`,
          pending: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?view=assinatura&status=pending`,
        },
        metadata: { user_id: params.userId },
        auto_return: 'approved',
      }
      const res = await fetch(`${baseUrl}/checkout/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gateway.accessToken}`,
        },
        body: JSON.stringify(prefBody),
      })
      const pref = await res.json()
      if (pref.init_point) {
        return {
          success: true,
          provider: 'MERCADO_PAGO',
          externalId: pref.id,
          status: 'PENDING',
          checkoutUrl: pref.init_point,
          message: 'Preferência de checkout criada no Mercado Pago',
        }
      }
    }

    return { success: false, provider: 'MERCADO_PAGO', externalId: '', status: 'FAILED', message: 'Erro ao criar pagamento' }
  } catch (e: any) {
    return { success: false, provider: 'MERCADO_PAGO', externalId: '', status: 'FAILED', message: e.message }
  }
}

// === STRIPE ===

async function createStripePayment(gateway: GatewayConfig, params: CreatePaymentParams): Promise<CreatePaymentResult> {
  const baseUrl = getBaseUrl('STRIPE', gateway.isSandbox)
  const amount = String(params.amountCents) // Stripe uses cents directly

  try {
    // Create checkout session
    const body = new URLSearchParams({
      'mode': 'payment',
      'line_items[0][price_data][currency]': 'brl',
      'line_items[0][price_data][unit_amount]': amount,
      'line_items[0][price_data][product_data][name]': params.planName,
      'line_items[0][quantity]': '1',
      'success_url': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?view=assinatura&status=success`,
      'cancel_url': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?view=assinatura&status=canceled`,
      'client_reference_id': params.userId,
      'customer_email': params.userEmail,
    })

    const res = await fetch(`${baseUrl}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gateway.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    const session = await res.json()

    if (session.id) {
      return {
        success: true,
        provider: 'STRIPE',
        externalId: session.id,
        status: 'PENDING',
        checkoutUrl: session.url,
        message: 'Sessão de checkout criada no Stripe',
      }
    }

    return { success: false, provider: 'STRIPE', externalId: '', status: 'FAILED', message: session.error?.message || 'Erro ao criar checkout' }
  } catch (e: any) {
    return { success: false, provider: 'STRIPE', externalId: '', status: 'FAILED', message: e.message }
  }
}

// === Recurring subscription creation ===

export async function createRecurringSubscription(
  gateway: GatewayConfig,
  params: CreatePaymentParams & { billingCycle: 'MONTHLY' | 'YEARLY' }
): Promise<CreatePaymentResult> {
  switch (gateway.provider) {
    case 'ASAAS':
      return createAsaasSubscription(gateway, params)
    case 'MERCADO_PAGO':
      // Mercado Pago uses preapproval for recurring
      return createMercadoPagoPreapproval(gateway, params)
    case 'STRIPE':
      return createStripeSubscription(gateway, params)
  }
}

async function createAsaasSubscription(gateway: GatewayConfig, params: any): Promise<CreatePaymentResult> {
  const baseUrl = getBaseUrl('ASAAS', gateway.isSandbox)
  const amount = (params.amountCents / 100).toFixed(2)

  try {
    // Create customer first
    const customerRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': gateway.apiKey },
      body: JSON.stringify({ name: params.userName, email: params.userEmail, externalReference: params.userId }),
    })
    const customer = await customerRes.json()

    // Create subscription
    const subRes = await fetch(`${baseUrl}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': gateway.apiKey },
      body: JSON.stringify({
        customer: customer.id,
        billingType: params.paymentMethod === 'PIX' ? 'PIX' : 'CREDIT_CARD',
        value: parseFloat(amount),
        cycle: params.billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY',
        description: params.planName,
        externalReference: params.userId,
      }),
    })
    const sub = await subRes.json()

    if (sub.id) {
      return {
        success: true, provider: 'ASAAS', externalId: sub.id, status: 'ACTIVE',
        checkoutUrl: sub.invoiceUrl,
        message: `Assinatura recorrente criada no Asaas (${params.billingCycle})`,
      }
    }
    return { success: false, provider: 'ASAAS', externalId: '', status: 'FAILED', message: 'Erro ao criar assinatura' }
  } catch (e: any) {
    return { success: false, provider: 'ASAAS', externalId: '', status: 'FAILED', message: e.message }
  }
}

async function createMercadoPagoPreapproval(gateway: GatewayConfig, params: any): Promise<CreatePaymentResult> {
  const baseUrl = getBaseUrl('MERCADO_PAGO', gateway.isSandbox)
  const amount = (params.amountCents / 100).toFixed(2)

  try {
    const res = await fetch(`${baseUrl}/preapproval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gateway.accessToken}` },
      body: JSON.stringify({
        reason: params.planName,
        external_reference: params.userId,
        payer_email: params.userEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: parseFloat(amount),
          currency_id: 'BRL',
        },
        back_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?view=assinatura&status=success`,
      }),
    })
    const preapproval = await res.json()

    if (preapproval.id) {
      return {
        success: true, provider: 'MERCADO_PAGO', externalId: preapproval.id, status: 'PENDING',
        checkoutUrl: preapproval.init_point,
        message: 'Preapproval criado no Mercado Pago',
      }
    }
    return { success: false, provider: 'MERCADO_PAGO', externalId: '', status: 'FAILED', message: 'Erro ao criar preapproval' }
  } catch (e: any) {
    return { success: false, provider: 'MERCADO_PAGO', externalId: '', status: 'FAILED', message: e.message }
  }
}

async function createStripeSubscription(gateway: GatewayConfig, params: any): Promise<CreatePaymentResult> {
  const baseUrl = getBaseUrl('STRIPE', gateway.isSandbox)

  try {
    // Create product + price + subscription
    // For simplicity, create a checkout session with subscription mode
    const body = new URLSearchParams({
      'mode': 'subscription',
      'line_items[0][price_data][currency]': 'brl',
      'line_items[0][price_data][unit_amount]': String(params.amountCents),
      'line_items[0][price_data][product_data][name]': params.planName,
      'line_items[0][price_data][recurring][interval]': params.billingCycle === 'YEARLY' ? 'year' : 'month',
      'line_items[0][quantity]': '1',
      'success_url': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?view=assinatura&status=success`,
      'cancel_url': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?view=assinatura&status=canceled`,
      'client_reference_id': params.userId,
      'customer_email': params.userEmail,
    })

    const res = await fetch(`${baseUrl}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gateway.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    const session = await res.json()

    if (session.id) {
      return {
        success: true, provider: 'STRIPE', externalId: session.id, status: 'PENDING',
        checkoutUrl: session.url,
        message: 'Assinatura Stripe criada',
      }
    }
    return { success: false, provider: 'STRIPE', externalId: '', status: 'FAILED', message: session.error?.message || 'Erro' }
  } catch (e: any) {
    return { success: false, provider: 'STRIPE', externalId: '', status: 'FAILED', message: e.message }
  }
}
