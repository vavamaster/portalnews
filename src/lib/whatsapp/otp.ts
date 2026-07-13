/**
 * WhatsApp OTP helper — generate, send, and verify 6-digit codes.
 * Used for double opt-in subscription flow.
 */

import { db } from '../db'
import { sendTextMessage } from './baileys-client'

const OTP_TTL_MINUTES = 10

/**
 * Generate a 6-digit OTP code.
 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Create an OTP record + send it via WhatsApp.
 * Returns the OTP id (not the code) — the code is sent only via WhatsApp.
 */
export async function createAndSendOtp(
  phoneNumber: string,
  purpose: 'SUBSCRIBE' | 'UNSUBSCRIBE' = 'SUBSCRIBE'
): Promise<{ ok: boolean; otpId: string; error?: string }> {
  try {
    // Normalize phone
    const normalized = phoneNumber.replace(/\D/g, '')
    if (normalized.length < 10 || normalized.length > 15) {
      return { ok: false, otpId: '', error: 'Número de telefone inválido' }
    }

    // Invalidate previous unused OTPs for this phone/purpose
    await db.whatsAppOtp.updateMany({
      where: { phoneNumber: normalized, purpose, isUsed: false },
      data: { isUsed: true },
    })

    // Create new OTP
    const code = generateCode()
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000)
    const otp = await db.whatsAppOtp.create({
      data: { phoneNumber: normalized, code, purpose, expiresAt },
    })

    // Send via WhatsApp (if connected)
    const waConfig = await db.whatsAppConfig.findFirst()
    if (!waConfig?.isConnected) {
      return {
        ok: false,
        otpId: otp.id,
        error: 'WhatsApp não está conectado. Conecte o chip no painel admin primeiro.',
      }
    }

    const message = purpose === 'SUBSCRIBE'
      ? `🔔 *Confirme sua inscrição*\n\nSeu código de verificação: *${code}*\n\nValidade: ${OTP_TTL_MINUTES} minutos.\n\nSe você não solicitou esta inscrição, ignore esta mensagem.`
      : `🔓 *Confirme o descadastro*\n\nSeu código: *${code}*\n\nValidade: ${OTP_TTL_MINUTES} minutos.`

    const result = await sendTextMessage(normalized, message)
    if (!result.success) {
      return {
        ok: false,
        otpId: otp.id,
        error: result.error || 'Falha ao enviar código via WhatsApp',
      }
    }

    return { ok: true, otpId: otp.id }
  } catch (e: any) {
    console.error('[WhatsApp OTP] createAndSendOtp error:', e)
    return { ok: false, otpId: '', error: 'Erro interno' }
  }
}

/**
 * Verify an OTP code.
 * Returns { ok: true, phoneNumber } on success.
 */
export async function verifyOtp(
  phoneNumber: string,
  code: string,
  purpose: 'SUBSCRIBE' | 'UNSUBSCRIBE' = 'SUBSCRIBE'
): Promise<{ ok: boolean; error?: string }> {
  try {
    const normalized = phoneNumber.replace(/\D/g, '')
    const otp = await db.whatsAppOtp.findFirst({
      where: {
        phoneNumber: normalized,
        purpose,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otp) {
      return { ok: false, error: 'Nenhum código válido encontrado. Solicite um novo.' }
    }

    if (otp.attempts >= otp.maxAttempts) {
      await db.whatsAppOtp.update({ where: { id: otp.id }, data: { isUsed: true } })
      return { ok: false, error: 'Muitas tentativas. Solicite um novo código.' }
    }

    // Increment attempts
    await db.whatsAppOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    })

    if (otp.code !== code.trim()) {
      return { ok: false, error: 'Código incorreto' }
    }

    // Mark as used
    await db.whatsAppOtp.update({ where: { id: otp.id }, data: { isUsed: true } })
    return { ok: true }
  } catch (e: any) {
    console.error('[WhatsApp OTP] verifyOtp error:', e)
    return { ok: false, error: 'Erro interno' }
  }
}
