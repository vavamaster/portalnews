import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond, handleApiError } from '@/lib/api-helpers'

// GET /api/admin/whatsapp/stats — dashboard metrics
export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdminOrRespond(req)
    if (response) return response

    const now = new Date()
    const last7Days = new Date(now.getTime() - 7 * 86400_000)
    const last30Days = new Date(now.getTime() - 30 * 86400_000)

    const [
      totalSubscribers,
      activeSubscribers,
      verifiedSubscribers,
      unsubscribedTotal,
      newSubscribers7d,
      newSubscribers30d,
      totalLists,
      totalCampaigns,
      campaignsSent,
      campaignsSending,
      campaignsScheduled,
      campaignsPaused,
      totalRecipients,
      sentCount,
      deliveredCount,
      readCount,
      failedCount,
      messagesSent7d,
      recentImports,
    ] = await Promise.all([
      db.whatsAppSubscriber.count(),
      db.whatsAppSubscriber.count({ where: { isActive: true } }),
      db.whatsAppSubscriber.count({ where: { isActive: true, isVerified: true } }),
      db.whatsAppSubscriber.count({ where: { isActive: false, unsubscribeReason: 'USER_REQUEST' } }),
      db.whatsAppSubscriber.count({ where: { createdAt: { gte: last7Days } } }),
      db.whatsAppSubscriber.count({ where: { createdAt: { gte: last30Days } } }),
      db.whatsAppSubscriberList.count(),
      db.whatsAppCampaign.count(),
      db.whatsAppCampaign.count({ where: { status: 'SENT' } }),
      db.whatsAppCampaign.count({ where: { status: 'SENDING' } }),
      db.whatsAppCampaign.count({ where: { status: 'SCHEDULED' } }),
      db.whatsAppCampaign.count({ where: { status: 'PAUSED' } }),
      db.whatsAppCampaignRecipient.count(),
      db.whatsAppCampaignRecipient.count({ where: { status: 'SENT' } }),
      db.whatsAppCampaignRecipient.count({ where: { status: 'DELIVERED' } }),
      db.whatsAppCampaignRecipient.count({ where: { status: 'READ' } }),
      db.whatsAppCampaignRecipient.count({ where: { status: 'FAILED' } }),
      db.whatsAppMessage.count({ where: { direction: 'OUTGOING', createdAt: { gte: last7Days } } }),
      db.whatsAppImportBatch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    // Subscriber growth chart (last 14 days)
    const growth: { date: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400_000)
      const dateStr = d.toISOString().slice(0, 10)
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const endOfDay = new Date(startOfDay.getTime() + 86400_000)
      const count = await db.whatsAppSubscriber.count({
        where: { createdAt: { gte: startOfDay, lt: endOfDay } },
      })
      growth.push({ date: dateStr, count })
    }

    const deliveryRate = totalRecipients > 0 ? (deliveredCount / totalRecipients) * 100 : 0
    const readRate = totalRecipients > 0 ? (readCount / totalRecipients) * 100 : 0
    const failureRate = totalRecipients > 0 ? (failedCount / totalRecipients) * 100 : 0
    const unsubscribeRate = totalSubscribers > 0 ? (unsubscribedTotal / totalSubscribers) * 100 : 0

    return NextResponse.json({
      subscribers: {
        total: totalSubscribers,
        active: activeSubscribers,
        verified: verifiedSubscribers,
        unsubscribed: unsubscribedTotal,
        new7d: newSubscribers7d,
        new30d: newSubscribers30d,
        unsubscribeRate: parseFloat(unsubscribeRate.toFixed(2)),
      },
      lists: { total: totalLists },
      campaigns: {
        total: totalCampaigns,
        sent: campaignsSent,
        sending: campaignsSending,
        scheduled: campaignsScheduled,
        paused: campaignsPaused,
      },
      messages: {
        totalRecipients,
        sent: sentCount,
        delivered: deliveredCount,
        read: readCount,
        failed: failedCount,
        sent7d: messagesSent7d,
        deliveryRate: parseFloat(deliveryRate.toFixed(2)),
        readRate: parseFloat(readRate.toFixed(2)),
        failureRate: parseFloat(failureRate.toFixed(2)),
      },
      growth,
      recentImports,
    })
  } catch (e: any) {
    return handleApiError(e, 'whatsapp stats')
  }
}
