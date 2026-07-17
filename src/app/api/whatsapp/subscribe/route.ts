import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createAndSendOtp, verifyOtp } from '@/lib/whatsapp/otp'
import { handleApiError } from '@/lib/api-helpers'
import { consumeRequestLimit } from '@/lib/request-rate-limit'

/**
 * Public WhatsApp subscription API.
 *
 * POST /api/whatsapp/subscribe
 *   { action: 'request_otp', phoneNumber, name? }
 *   { action: 'verify_otp', phoneNumber, code, listIds?: string[], name? }
 *   { action: 'request_unsubscribe_otp', phoneNumber }
 *   { action: 'verify_unsubscribe_otp', phoneNumber, code }
 *
 * GET /api/whatsapp/subscribe — list subscribeable lists
 */

export async function GET(req: NextRequest) {
  const lists = await db.whatsAppSubscriberList.findMany({
    where: { isDefault: false },
    select: { id: true, name: true, description: true, color: true, categorySlug: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ lists })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action || 'request_otp'

    if (action === 'request_otp') {
      const { phoneNumber, name } = body
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return NextResponse.json({ error: 'phoneNumber é obrigatório' }, { status: 400 })
      }
      const normalized = phoneNumber.replace(/\D/g, '')
      if (normalized.length < 10 || normalized.length > 15) {
        return NextResponse.json({ error: 'Número inválido (use DDI+DDD+numero, ex: 5566999990000)' }, { status: 400 })
      }
      const existing = await db.whatsAppSubscriber.findUnique({ where: { phoneNumber: normalized } })
      if (existing?.isActive && existing?.isVerified) {
        return NextResponse.json({
          error: 'Este número já está inscrito. Para descadastrar, responda PARAR no WhatsApp.',
          alreadySubscribed: true,
        }, { status: 409 })
      }
      const phoneLimit = await consumeRequestLimit(req, {
        scope: 'whatsapp-otp-phone', subject: normalized, includeIp: false, limit: 3, windowSeconds: 10 * 60,
      })
      const ipLimit = await consumeRequestLimit(req, {
        scope: 'whatsapp-otp-ip', subject: 'subscribe', limit: 10, windowSeconds: 60 * 60,
      })
      if (!phoneLimit.allowed || !ipLimit.allowed) {
        const retryAfter = Math.max(phoneLimit.retryAfter, ipLimit.retryAfter)
        return NextResponse.json(
          { error: 'Muitas solicitações de código. Aguarde antes de tentar novamente.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        )
      }
      const result = await createAndSendOtp(normalized, 'SUBSCRIBE')
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ ok: true, otpId: result.otpId, message: 'Código enviado via WhatsApp' })
    }

    if (action === 'verify_otp') {
      const { phoneNumber, code, listIds, name } = body
      if (!phoneNumber || !code) {
        return NextResponse.json({ error: 'phoneNumber e code são obrigatórios' }, { status: 400 })
      }
      const normalized = phoneNumber.replace(/\D/g, '')
      const verifyResult = await verifyOtp(normalized, code, 'SUBSCRIBE')
      if (!verifyResult.ok) {
        return NextResponse.json({ error: verifyResult.error }, { status: 400 })
      }
      const subscriber = await db.whatsAppSubscriber.upsert({
        where: { phoneNumber: normalized },
        create: {
          phoneNumber: normalized,
          name: name || null,
          isVerified: true,
          verifiedAt: new Date(),
          optInSource: 'WIDGET',
          isActive: true,
        },
        update: {
          isVerified: true,
          verifiedAt: new Date(),
          isActive: true,
          unsubscribedAt: null,
          unsubscribeReason: null,
          ...(name ? { name } : {}),
        },
      })
      const defaultList = await db.whatsAppSubscriberList.findFirst({ where: { isDefault: true } })
      if (defaultList) {
        await db.whatsAppSubscriberListEntry.upsert({
          where: { subscriberId_listId: { subscriberId: subscriber.id, listId: defaultList.id } },
          create: { subscriberId: subscriber.id, listId: defaultList.id },
          update: {},
        }).catch(() => {})
      }
      if (Array.isArray(listIds) && listIds.length > 0) {
        for (const listId of listIds) {
          await db.whatsAppSubscriberListEntry.upsert({
            where: { subscriberId_listId: { subscriberId: subscriber.id, listId } },
            create: { subscriberId: subscriber.id, listId },
            update: {},
          }).catch(() => {})
        }
      }
      return NextResponse.json({ ok: true, subscriberId: subscriber.id, message: 'Inscrição confirmada!' })
    }

    if (action === 'request_unsubscribe_otp') {
      const { phoneNumber } = body
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return NextResponse.json({ error: 'phoneNumber é obrigatório' }, { status: 400 })
      }
      const normalized = phoneNumber.replace(/\D/g, '')
      if (normalized.length < 10 || normalized.length > 15) {
        return NextResponse.json({ error: 'Número inválido' }, { status: 400 })
      }
      const subscriber = await db.whatsAppSubscriber.findUnique({ where: { phoneNumber: normalized } })
      if (!subscriber?.isActive) return NextResponse.json({ ok: true, message: 'Número não está inscrito' })

      const phoneLimit = await consumeRequestLimit(req, {
        scope: 'whatsapp-unsubscribe-phone', subject: normalized, includeIp: false, limit: 3, windowSeconds: 10 * 60,
      })
      const ipLimit = await consumeRequestLimit(req, {
        scope: 'whatsapp-otp-ip', subject: 'unsubscribe', limit: 10, windowSeconds: 60 * 60,
      })
      if (!phoneLimit.allowed || !ipLimit.allowed) {
        const retryAfter = Math.max(phoneLimit.retryAfter, ipLimit.retryAfter)
        return NextResponse.json(
          { error: 'Muitas solicitações de código. Aguarde antes de tentar novamente.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        )
      }

      const result = await createAndSendOtp(normalized, 'UNSUBSCRIBE')
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ ok: true, otpId: result.otpId, verificationRequired: true })
    }

    if (action === 'verify_unsubscribe_otp') {
      const { phoneNumber, code } = body
      if (typeof phoneNumber !== 'string' || typeof code !== 'string') {
        return NextResponse.json({ error: 'phoneNumber e code são obrigatórios' }, { status: 400 })
      }
      const normalized = phoneNumber.replace(/\D/g, '')
      const verification = await verifyOtp(normalized, code, 'UNSUBSCRIBE')
      if (!verification.ok) return NextResponse.json({ error: verification.error }, { status: 400 })

      const subscriber = await db.whatsAppSubscriber.findUnique({ where: { phoneNumber: normalized } })
      if (!subscriber) return NextResponse.json({ ok: true, message: 'Descadastro processado' })
      await db.whatsAppSubscriber.update({
        where: { id: subscriber.id },
        data: {
          isActive: false,
          unsubscribedAt: new Date(),
          unsubscribeReason: 'USER_REQUEST',
        },
      })
      return NextResponse.json({ ok: true, message: 'Você foi descadastrado com sucesso' })
    }

    if (action === 'unsubscribe') {
      return NextResponse.json({ error: 'Confirmação por código é obrigatória para o descadastro' }, { status: 400 })
    }

    return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 })
  } catch (e: any) {
    return handleApiError(e, 'whatsapp subscribe')
  }
}
