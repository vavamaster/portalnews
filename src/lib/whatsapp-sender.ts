import { db } from './db'

// WhatsApp message sender using Baileys.
// In production, this connects to a Baileys session running as a separate process
// (or serverless function). For now, it logs messages and can be extended.
//
// To set up Baileys:
// 1. npm install @whiskeysockets/baileys
// 2. Run a separate Node process that maintains the WhatsApp connection
// 3. This sender communicates with that process via a simple HTTP API or queue
//
// For now, this is a stub that logs to WhatsAppLog and returns success.
// When Baileys is running, replace the stub with actual API calls.

interface WhatsAppConfig {
  id: string
  phoneNumber: string
  sessionName: string
  isConnected: boolean
  notifyPhone: string | null
}

export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Log the message attempt
    await db.whatsAppLog.create({
      data: {
        type: 'NOTIFICATION',
        phoneNumber: to,
        message,
        data: JSON.stringify({ sessionName: config.sessionName }),
      },
    })

    // If not connected, just log and return
    if (!config.isConnected) {
      console.log('[WhatsApp] Not connected — message logged only:', message.substring(0, 100))
      return { success: false, error: 'WhatsApp not connected' }
    }

    // In production, this would call the Baileys process:
    //
    // const { default: makeWASocket, useMultiFileAuthState } = await import('@whiskeysockets/baileys')
    // const { state, saveCreds } = await useMultiFileAuthState(config.sessionName)
    // const sock = makeWASocket({ auth: state })
    // await sock.sendMessage(to.includes('@') ? to : `${to}@s.whatsapp.net`, { text: message })
    // await sock.end()

    // For now, simulate success
    console.log(`[WhatsApp] Message sent to ${to}: ${message.substring(0, 80)}...`)
    return { success: true }
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

// Send a rich message with image (for article notifications with OG image)
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

    // In production with Baileys:
    // const sock = makeWASocket(...)
    // await sock.sendMessage(to, { image: { url: imageUrl }, caption: message })

    console.log(`[WhatsApp] Rich message sent to ${to}`)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
