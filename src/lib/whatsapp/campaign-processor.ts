/**
 * WhatsApp Campaign Processor — sends campaign messages respecting anti-block rules.
 *
 * Flow:
 *   1. Cron calls processPendingCampaigns() every 5 minutes
 *   2. For each campaign with status SCHEDULED and scheduledAt <= now:
 *      a. Build recipient list (from campaign.listId or all verified subscribers)
 *      b. Set status to SENDING
 *   3. For each campaign with status SENDING:
 *      a. Check anti-block (rate limit, quiet hours, warmup)
 *      b. If not allowed, skip and wait for next cron tick
 *      c. Pick next N PENDING recipients (batch)
 *      d. For each, render message (with variants for A/B), apply footer, send
 *      e. Update recipient status (SENT/FAILED)
 *      f. Sleep random delay between sends
 *      g. Update campaign metrics
 *      h. Auto-pause if too many errors
 *      i. Mark campaign SENT when all recipients done
 */

import { db } from '../db'
import {
  getAntiBlockConfig,
  canSendNow,
  getRandomDelay,
  applyOptOutFooter,
  generateMessageVariants,
  renderTemplate,
  shouldAutoPause,
} from './anti-block'
import { sendTextMessage, sendImageMessage } from './baileys-client'

const BATCH_SIZE = 10 // recipients per cron tick (conservative)

/**
 * Process all scheduled/sending campaigns.
 * Called by cron every 5 minutes.
 */
export async function processPendingCampaigns(): Promise<{
  processed: number
  sent: number
  failed: number
  paused: number
  errors: string[]
}> {
  const result = { processed: 0, sent: 0, failed: 0, paused: 0, errors: [] as string[] }
  const now = new Date()

  try {
    // === Step 1: Activate scheduled campaigns whose time has come ===
    const scheduled = await db.whatsAppCampaign.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      include: { list: true, article: { include: { category: true } } },
    })

    for (const campaign of scheduled) {
      try {
        await activateCampaign(campaign)
        result.processed++
      } catch (e: any) {
        result.errors.push(`Activate ${campaign.id}: ${e.message}`)
      }
    }

    // === Step 2: Process SENDING campaigns ===
    const sending = await db.whatsAppCampaign.findMany({
      where: { status: 'SENDING' },
      include: { list: true, article: { include: { category: true } } },
    })

    for (const campaign of sending) {
      try {
        const campaignResult = await processCampaignBatch(campaign)
        result.sent += campaignResult.sent
        result.failed += campaignResult.failed
        if (campaignResult.paused) result.paused++
      } catch (e: any) {
        result.errors.push(`Process ${campaign.id}: ${e.message}`)
      }
    }
  } catch (e: any) {
    result.errors.push(`Fatal: ${e.message}`)
  }

  return result
}

/**
 * Activate a scheduled campaign: build recipient list + set SENDING.
 */
async function activateCampaign(campaign: any) {
  // Build recipient list
  let subscribers: any[] = []
  if (campaign.listId) {
    // Send to specific list
    const listEntries = await db.whatsAppSubscriberListEntry.findMany({
      where: { listId: campaign.listId },
      include: { subscriber: true },
    })
    subscribers = listEntries
      .map(e => e.subscriber)
      .filter(s => s.isActive && s.isVerified)
  } else {
    // Send to all verified active subscribers
    subscribers = await db.whatsAppSubscriber.findMany({
      where: { isActive: true, isVerified: true },
    })
  }

  if (subscribers.length === 0) {
    // No recipients — mark as SENT (vacuous truth)
    await db.whatsAppCampaign.update({
      where: { id: campaign.id },
      data: { status: 'SENT', startedAt: new Date(), completedAt: new Date(), totalRecipients: 0 },
    })
    await db.whatsAppLog.create({
      data: { type: 'NOTIFICATION', message: `Campanha "${campaign.name}" ativada sem destinatários — marcada como enviada` },
    }).catch(() => {})
    return
  }

  // Create recipient records (dedupe by phoneNumber)
  const seen = new Set<string>()
  const recipients = subscribers
    .map(s => {
      if (seen.has(s.phoneNumber)) return null
      seen.add(s.phoneNumber)
      return { subscriberId: s.id, phoneNumber: s.phoneNumber }
    })
    .filter((r): r is { subscriberId: string; phoneNumber: string } => r !== null)

  // Assign message variants for A/B testing
  const cfg = await getAntiBlockConfig()
  const variantCount = cfg.enableVariants ? 2 : 1

  await db.$transaction(async (tx) => {
    await tx.whatsAppCampaignRecipient.createMany({
      data: recipients.map((r, i) => ({
        campaignId: campaign.id,
        subscriberId: r.subscriberId,
        phoneNumber: r.phoneNumber,
        messageVariant: cfg.enableVariants ? (i % variantCount) + 1 : 0,
      })),
    })
    await tx.whatsAppCampaign.update({
      where: { id: campaign.id },
      data: { status: 'SENDING', startedAt: new Date(), totalRecipients: recipients.length },
    })
  })

  await db.whatsAppLog.create({
    data: { type: 'NOTIFICATION', message: `Campanha "${campaign.name}" ativada com ${recipients.length} destinatários` },
  }).catch(() => {})
}

/**
 * Process a batch of recipients for a SENDING campaign.
 * Respects anti-block rules.
 */
async function processCampaignBatch(campaign: any): Promise<{ sent: number; failed: number; paused: boolean }> {
  const result = { sent: 0, failed: 0, paused: false }
  const cfg = await getAntiBlockConfig()

  // === Check auto-pause conditions ===
  const pauseCheck = await shouldAutoPause(campaign.id, cfg)
  if (pauseCheck.shouldPause) {
    await db.whatsAppCampaign.update({
      where: { id: campaign.id },
      data: { status: 'PAUSED' },
    })
    await db.whatsAppLog.create({
      data: { type: 'ERROR', message: `Campanha "${campaign.name}" auto-pausada: ${pauseCheck.reason}` },
    }).catch(() => {})
    result.paused = true
    return result
  }

  // === Check anti-block (rate limit + quiet hours + warmup) ===
  const sendCheck = await canSendNow(cfg)
  if (!sendCheck.allowed) {
    // Skip this tick — will retry next cron run
    await db.whatsAppLog.create({
      data: { type: 'STATUS_UPDATE', message: `Campanha "${campaign.name}" aguardando: ${sendCheck.reason}` },
    }).catch(() => {})
    return result
  }

  // === Generate message variants ===
  const variants = cfg.enableVariants
    ? generateMessageVariants(campaign.message, 2)
    : [campaign.message]

  // === Pick next batch of PENDING recipients ===
  const batch = await db.whatsAppCampaignRecipient.findMany({
    where: { campaignId: campaign.id, status: 'PENDING' },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
    include: { subscriber: true },
  })

  if (batch.length === 0) {
    // All recipients processed — mark campaign as SENT
    await db.whatsAppCampaign.update({
      where: { id: campaign.id },
      data: { status: 'SENT', completedAt: new Date() },
    })
    await db.whatsAppLog.create({
      data: { type: 'NOTIFICATION', message: `Campanha "${campaign.name}" concluída` },
    }).catch(() => {})
    return result
  }

  // === Send each message with random delay between sends ===
  for (const recipient of batch) {
    // Re-check rate limit before each send (in case batch exceeds limit)
    if (result.sent > 0) {
      const recheck = await canSendNow(cfg)
      if (!recheck.allowed) {
        await db.whatsAppLog.create({
          data: { type: 'STATUS_UPDATE', message: `Campanha "${campaign.name}" pausada no batch: ${recheck.reason}` },
        }).catch(() => {})
        break
      }
    }

    try {
      // Render template with subscriber data
      const subscriberName = recipient.subscriber?.name || ''
      const articleTitle = campaign.article?.title || ''
      const articleCategory = campaign.article?.category?.name || ''
      const articleLink = campaign.articleId ? `${process.env.NEXT_PUBLIC_SITE_URL || ''}/article/${campaign.article?.slug || ''}` : ''

      const baseVariant = variants[recipient.messageVariant - 1] || variants[0] || campaign.message
      const rendered = renderTemplate(baseVariant, {
        name: subscriberName,
        title: articleTitle,
        link: articleLink,
        category: articleCategory,
        phone: recipient.phoneNumber,
      })

      const finalMessage = applyOptOutFooter(rendered, cfg)

      // Send (image + caption or text)
      let sendResult: { success: boolean; externalId?: string; error?: string }
      if (campaign.imageUrl && campaign.imageUrl.startsWith('http')) {
        sendResult = await sendImageMessage(recipient.phoneNumber, campaign.imageUrl, finalMessage)
      } else if (campaign.article?.coverImage) {
        sendResult = await sendImageMessage(recipient.phoneNumber, campaign.article.coverImage, finalMessage)
      } else {
        sendResult = await sendTextMessage(recipient.phoneNumber, finalMessage)
      }

      if (sendResult.success) {
        await db.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'SENT', externalId: sendResult.externalId || null, sentAt: new Date() },
        })
        await db.whatsAppCampaign.update({
          where: { id: campaign.id },
          data: { sentCount: { increment: 1 } },
        })
        // Update subscriber's lastMessageAt + messagesReceived
        if (recipient.subscriberId) {
          await db.whatsAppSubscriber.update({
            where: { id: recipient.subscriberId },
            data: { lastMessageAt: new Date(), messagesReceived: { increment: 1 } },
          }).catch(() => {})
        }
        result.sent++
      } else {
        await db.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'FAILED', error: sendResult.error || 'Unknown error' },
        })
        await db.whatsAppCampaign.update({
          where: { id: campaign.id },
          data: { failedCount: { increment: 1 } },
        })
        result.failed++
      }
    } catch (e: any) {
      await db.whatsAppCampaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'FAILED', error: e.message },
      }).catch(() => {})
      await db.whatsAppCampaign.update({
        where: { id: campaign.id },
        data: { failedCount: { increment: 1 } },
      }).catch(() => {})
      result.failed++
    }

    // Sleep random delay between sends (skip after last send in batch)
    if (result.sent + result.failed < batch.length) {
      const delay = getRandomDelay(cfg)
      await new Promise(resolve => setTimeout(resolve, Math.min(delay, 60_000))) // cap at 60s per send in cron
    }
  }

  return result
}

/**
 * Create a campaign automatically when an article is published.
 * Called from /api/posts/route.ts on publish.
 */
export async function createArticleCampaign(
  articleId: string,
  article: { title: string; slug: string; coverImage: string | null; category: { name: string; slug: string } | null; excerpt: string | null }
): Promise<{ campaignId: string | null; reason?: string }> {
  try {
    const cfg = await getAntiBlockConfig()

    // Check if WhatsApp is connected
    const waConfig = await db.whatsAppConfig.findFirst()
    if (!waConfig?.isConnected) {
      return { campaignId: null, reason: 'WhatsApp não conectado' }
    }

    // Don't auto-create if no subscribers exist
    const subscriberCount = await db.whatsAppSubscriber.count({
      where: { isActive: true, isVerified: true },
    })
    if (subscriberCount === 0) {
      return { campaignId: null, reason: 'Nenhum inscrito verificado' }
    }

    // Find a list matching the article's category (if any)
    let targetList: any = null
    if (article.category?.slug) {
      targetList = await db.whatsAppSubscriberList.findFirst({
        where: { categorySlug: article.category.slug, isAuto: true },
      })
    }

    // Build message
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://portal-news.example.com'
    const articleLink = `${siteUrl}/article/${article.slug}`
    const message = `📰 *${article.title}${article.category ? ` — ${article.category.name}` : ''}*\n\n${article.excerpt || 'Nova matéria publicada no portal.'}\n\nLeia completa: ${articleLink}`

    // Schedule for next allowed time (if currently in quiet hours, schedule for tomorrow morning)
    const now = new Date()
    let scheduledAt = new Date(now)
    if (cfg.quietHoursStart !== cfg.quietHoursEnd) {
      const hour = now.getHours()
      const inQuiet = cfg.quietHoursStart < cfg.quietHoursEnd
        ? (hour >= cfg.quietHoursStart && hour < cfg.quietHoursEnd)
        : (hour >= cfg.quietHoursStart || hour < cfg.quietHoursEnd)
      if (inQuiet) {
        scheduledAt = new Date(now)
        // Schedule for quietHoursEnd today (or tomorrow if already past)
        scheduledAt.setHours(cfg.quietHoursEnd, 0, 0, 0)
        if (scheduledAt <= now) {
          scheduledAt.setDate(scheduledAt.getDate() + 1)
        }
        // Add 30 min buffer to ensure we're past quiet hours
        scheduledAt = new Date(scheduledAt.getTime() + 30 * 60_000)
      } else {
        // Schedule 5 min from now (give article time to be visible on site)
        scheduledAt = new Date(now.getTime() + 5 * 60_000)
      }
    } else {
      scheduledAt = new Date(now.getTime() + 5 * 60_000)
    }

    const campaign = await db.whatsAppCampaign.create({
      data: {
        name: `Auto: ${article.title.slice(0, 50)}`,
        type: 'ARTICLE',
        message,
        imageUrl: article.coverImage || null,
        articleId,
        listId: targetList?.id || null,
        status: 'SCHEDULED',
        scheduledAt,
        createdBy: 'system',
      },
    })

    await db.whatsAppLog.create({
      data: {
        type: 'NOTIFICATION',
        message: `Campanha automática criada para matéria "${article.title}" — agendada para ${scheduledAt.toLocaleString('pt-BR')}${targetList ? ` (lista: ${targetList.name})` : ' (todos os inscritos)'}`,
      },
    }).catch(() => {})

    return { campaignId: campaign.id }
  } catch (e: any) {
    console.error('[WhatsApp Campaign] createArticleCampaign error:', e)
    return { campaignId: null, reason: e.message }
  }
}

/**
 * Pause a campaign (admin action).
 */
export async function pauseCampaign(campaignId: string): Promise<{ ok: boolean }> {
  await db.whatsAppCampaign.update({
    where: { id: campaignId },
    data: { status: 'PAUSED' },
  })
  return { ok: true }
}

/**
 * Resume a paused campaign.
 */
export async function resumeCampaign(campaignId: string): Promise<{ ok: boolean }> {
  await db.whatsAppCampaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING' },
  })
  return { ok: true }
}

/**
 * Cancel a campaign (cannot be resumed).
 */
export async function cancelCampaign(campaignId: string): Promise<{ ok: boolean }> {
  await db.$transaction([
    db.whatsAppCampaign.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' },
    }),
    // Mark all PENDING recipients as SKIPPED
    db.whatsAppCampaignRecipient.updateMany({
      where: { campaignId, status: 'PENDING' },
      data: { status: 'SKIPPED' },
    }),
  ])
  return { ok: true }
}

/**
 * Process incoming unsubscribe replies (PARAR, SAIR, UNSUBSCRIBE, STOP).
 * Called from baileys-client.ts when an incoming message is received.
 */
export async function processUnsubscribeReply(
  phoneNumber: string,
  messageBody: string
): Promise<boolean> {
  const body = messageBody.trim().toUpperCase()
  const unsubscribeKeywords = ['PARAR', 'SAIR', 'UNSUBSCRIBE', 'STOP', 'DESCADASTRAR', 'CANCELAR']
  if (!unsubscribeKeywords.includes(body)) return false

  const subscriber = await db.whatsAppSubscriber.findFirst({
    where: { phoneNumber },
  })
  if (!subscriber) return false

  await db.whatsAppSubscriber.update({
    where: { id: subscriber.id },
    data: {
      isActive: false,
      unsubscribedAt: new Date(),
      unsubscribeReason: 'USER_REQUEST',
    },
  })

  // Send confirmation
  try {
    const { sendTextMessage } = await import('./baileys-client')
    await sendTextMessage(phoneNumber, '✅ Você foi descadastrado com sucesso. Não enviaremos mais mensagens. Para reativar, acesse o portal.')
  } catch {}

  await db.whatsAppLog.create({
    data: {
      type: 'MESSAGE_RECEIVED',
      phoneNumber,
      message: `Descadastro automático processado`,
    },
  }).catch(() => {})

  return true
}
