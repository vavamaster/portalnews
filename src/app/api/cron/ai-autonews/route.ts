import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCronBearer } from '@/lib/cron-auth'

// Cron job: checks AI News schedules and generates posts.
// Run every hour with Authorization: Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const authError = requireCronBearer(req)
  if (authError) return authError

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay()

  const schedules = await db.aINewsSchedule.findMany({
    where: { isEnabled: true },
  })

  let generated = 0
  let failed = 0
  let skipped = 0

  for (const schedule of schedules) {
    const shouldRun = checkSchedule(schedule, currentHour, currentMinute, currentDayOfWeek)
    if (!shouldRun) { skipped++; continue }

    // Skip if already ran in the last 55 minutes
    if (schedule.lastRunAt) {
      const minutesSinceLastRun = (now.getTime() - schedule.lastRunAt.getTime()) / (1000 * 60)
      if (minutesSinceLastRun < 55) { skipped++; continue }
    }

    try {
      // Generate post using AI
      const { generateArticle, generateSlug } = await import('@/lib/ai-generator')
      const { loadSeoSettings } = await import('@/lib/seo-helpers')

      const scopePrompts: Record<string, string> = {
        LOCAL: `Gere uma matéria LOCAL sobre a cidade. Foque em fatos locais: eventos, obras, políticas públicas, esportes, educação, saúde, cultura.`,
        STATE: `Gere uma matéria sobre o estado com impacto regional. Agronegócio, meio ambiente, políticas estaduais, infraestrutura.`,
        NATIONAL: `Gere uma matéria NACIONAL contextualizada para a região. Economia, política federal, segurança, saúde pública.`,
        WORLD: `Gere uma matéria INTERNACIONAL com conexão local. Commodities, clima, geopolítica, acordos comerciais.`,
        TRENDING: `Gere uma matéria sobre um assunto DO MOMENTO (trending). Algo viral nas redes ou muito buscado.`,
        CUSTOM: schedule.topicHint || `Gere uma matéria sobre um tema relevante.`,
      }

      const scopePrompt = scopePrompts[schedule.scope] || scopePrompts.LOCAL
      const topicHint = schedule.topicHint || ''
      const finalPrompt = `${scopePrompt}\n\nTema sugerido: ${topicHint || 'Escolha um tema relevante'}\nData: ${now.toLocaleDateString('pt-BR')}`

      const article = await generateArticle(finalPrompt, schedule.categorySlug || undefined)

      // Create the post
      const slug = generateSlug(article.title)
      let uniqueSlug = slug
      let i = 1
      while (await db.post.findUnique({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${slug}-${i++}`
      }

      // Find category (C6 fix: validate before create)
      let categoryId: string | null = null
      if (schedule.categorySlug) {
        const cat = await db.category.findUnique({ where: { slug: schedule.categorySlug } })
        if (cat) categoryId = cat.id
      }
      if (!categoryId) {
        const firstCat = await db.category.findFirst({ orderBy: { order: 'asc' } })
        if (firstCat) categoryId = firstCat.id
      }
      if (!categoryId) {
        console.error('[AI AutoNews] Nenhuma categoria encontrada')
        failed++; continue
      }

      const adminUser = await db.user.findFirst({ where: { role: { in: ['MASTER', 'ADMIN'] } } })
      if (!adminUser) {
        console.error('[AI AutoNews] Nenhum usuário admin encontrado')
        failed++; continue
      }
      const status = schedule.autoPublish ? 'PUBLISHED' : 'DRAFT'

      const post = await db.post.create({
        data: {
          slug: uniqueSlug,
          title: article.title,
          subtitle: article.subtitle,
          excerpt: article.excerpt,
          content: article.content,
          tags: article.tags,
          coverImage: article.coverImage,
          gallery: article.gallery.length > 0 ? JSON.stringify(article.gallery) : null,
          customFields: article.customFields ? JSON.stringify(article.customFields) : null,
          seoTitle: article.seoTitle,
          seoDescription: article.seoDescription,
          seoKeywords: article.seoKeywords,
          ogImage: article.coverImage,
          categoryId: categoryId,
          authorId: adminUser.id,
          status,
          publishedAt: status === 'PUBLISHED' ? now : null,
        },
      })

      // Update schedule
      await db.aINewsSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          lastPostId: post.id,
          runCount: { increment: 1 },
        },
      })

      // If autoPublish is true, trigger social publishing + WhatsApp notification
      if (schedule.autoPublish) {
        // Queue social posts
        const socialConfigs = await db.socialConfig.findMany({ where: { isEnabled: true, autoPublish: true } })
        for (const sc of socialConfigs) {
          await db.socialPost.create({
            data: { postId: post.id, provider: sc.provider, status: 'PENDING' },
          })
        }

        // Send WhatsApp notification
        const waConfig = await db.whatsAppConfig.findFirst()
        if (waConfig?.isConnected && waConfig.notifyOnPublish) {
          const { sendWhatsAppMessage } = await import('@/lib/whatsapp-sender')
          const siteUrl = (await loadSeoSettings()).site_url || 'http://localhost:3000'
          const message = `📰 *Nova matéria publicada!*\n\n*${article.title}*\n\n${article.excerpt}\n\n🔗 ${siteUrl}/noticias/${encodeURIComponent(uniqueSlug)}`
          await sendWhatsAppMessage(waConfig, waConfig.notifyPhone || waConfig.phoneNumber, message).catch(() => {})
        }
      } else {
        // Notify admin via WhatsApp that a post needs review
        const waConfig = await db.whatsAppConfig.findFirst()
        if (waConfig?.isConnected && waConfig.notifyOnReview) {
          const { sendWhatsAppMessage } = await import('@/lib/whatsapp-sender')
          const siteUrl = (await loadSeoSettings()).site_url || 'http://localhost:3000'
          const message = `⏳ *Matéria aguardando aprovação*\n\n*${article.title}*\n\nAcesse o painel admin para revisar e publicar.\n\n🔗 ${siteUrl}/admin?section=review`
          await sendWhatsAppMessage(waConfig, waConfig.notifyPhone || waConfig.phoneNumber, message).catch(() => {})
        }
      }

      generated++
    } catch (e: any) {
      console.error(`[AI-AutoNews] Failed: ${e.message}`)
      failed++
    }
  }

  return NextResponse.json({ ok: true, generated, failed, skipped, at: now.toISOString() })
}

function checkSchedule(schedule: any, hour: number, minute: number, dow: number): boolean {
  if (schedule.hour !== hour) return false
  if (schedule.minute !== minute) return false

  switch (schedule.frequency) {
    case 'HOURLY': return true
    case 'DAILY': return true
    case 'WEEKLY':
      if (!schedule.daysOfWeek) return true
      try {
        const days = JSON.parse(schedule.daysOfWeek)
        return Array.isArray(days) && days.includes(dow)
      } catch { return true }
    default: return false
  }
}
