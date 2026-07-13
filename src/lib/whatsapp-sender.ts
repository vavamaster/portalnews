import { db } from './db'

/**
 * WhatsApp Sender — high-level notification helpers used by the rest of the app.
 *
 * This is a thin wrapper over the Baileys client (src/lib/whatsapp/baileys-client.ts)
 * that:
 *   1. Loads the active WhatsAppConfig from the DB
 *   2. Checks if connected
 *   3. Delegates to the appropriate Baileys function (text or image)
 *   4. Logs all attempts to WhatsAppLog for audit trail
 *
 * For direct send (admin UI test message), use the Baileys client directly via
 * /api/admin/whatsapp/send — this module is for "send a notification to the
 * configured notifyPhone" use cases.
 */

interface WhatsAppConfig {
  id: string
  phoneNumber: string
  sessionName: string
  isConnected: boolean
  connectionStatus: string
  notifyPhone: string | null
}

/**
 * Get the current WhatsApp config (singleton from DB).
 */
export async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  return await db.whatsAppConfig.findFirst()
}

/**
 * Send a text notification to the configured notifyPhone (or the connected chip
 * if notifyPhone is null/empty). Returns success/failure.
 *
 * Used by: cron/ai-autonews (publish + review notifications), classifieds lead
 * notifications, etc.
 */
export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Log the message attempt (always, even if not connected)
    await db.whatsAppLog.create({
      data: {
        type: 'NOTIFICATION',
        phoneNumber: to,
        message,
        data: JSON.stringify({ sessionName: config.sessionName, connected: config.isConnected }),
      },
    })

    if (!config.isConnected) {
      console.debug('[WhatsApp] Not connected — message logged only:', message.substring(0, 100))
      return { success: false, error: 'WhatsApp not connected' }
    }

    // Delegate to Baileys client
    const { sendTextMessage } = await import('./whatsapp/baileys-client')
    const result = await sendTextMessage(to, message)

    if (!result.success) {
      await db.whatsAppLog.create({
        data: {
          type: 'ERROR',
          phoneNumber: to,
          message: `Failed to send: ${result.error || 'unknown'}`,
        },
      })
    }

    return result
  } catch (e: any) {
    console.error('[WhatsApp] Send error:', e)
    await db.whatsAppLog.create({
      data: {
        type: 'ERROR',
        phoneNumber: to,
        message: `Failed to send: ${e.message}`,
      },
    })
    return { success: false, error: e.message }
  }
}

/**
 * Send a notification with an image (e.g., article cover + headline).
 * Falls back to text-only if imageUrl is empty or invalid.
 */
export async function sendWhatsAppMessageWithImage(
  config: WhatsAppConfig,
  to: string,
  message: string,
  imageUrl: string,
  caption: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.whatsAppLog.create({
      data: {
        type: 'NOTIFICATION',
        phoneNumber: to,
        message: `${message} [IMAGE: ${imageUrl}]`,
        data: JSON.stringify({ imageUrl, caption, sessionName: config.sessionName }),
      },
    })

    if (!config.isConnected) {
      return { success: false, error: 'WhatsApp not connected' }
    }

    // If no image URL or invalid, fall back to text-only
    if (!imageUrl || !imageUrl.startsWith('http')) {
      return sendWhatsAppMessage(config, to, `${caption}\n\n${message}`)
    }

    const { sendImageMessage } = await import('./whatsapp/baileys-client')
    const result = await sendImageMessage(to, imageUrl, `${caption}\n\n${message}`)

    if (!result.success) {
      await db.whatsAppLog.create({
        data: {
          type: 'ERROR',
          phoneNumber: to,
          message: `Failed to send image: ${result.error || 'unknown'}`,
        },
      })
    }

    return result
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

/**
 * Convenience: send a notification to the admin/owner's notify phone.
 * Used by AI auto-news, review queue, lead notifications, etc.
 */
export async function notifyAdmin(
  message: string,
  imageUrl?: string,
  caption?: string
): Promise<{ success: boolean; error?: string }> {
  const config = await getWhatsAppConfig()
  if (!config) return { success: false, error: 'WhatsApp config not found' }
  if (!config.isConnected) return { success: false, error: 'WhatsApp not connected' }

  const target = config.notifyPhone || config.phoneNumber
  if (!target) return { success: false, error: 'No target phone number configured' }

  if (imageUrl) {
    return sendWhatsAppMessageWithImage(config, target, message, imageUrl, caption || '')
  }
  return sendWhatsAppMessage(config, target, message)
}
