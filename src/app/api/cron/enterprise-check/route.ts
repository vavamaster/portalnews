import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Cron job: check Enterprise billing cycles and pause expired ones.
// Run this every hour via external cron: curl https://seusite.com/api/cron/enterprise-check?key=PORTAL-CRON-2024
//
// For each ACTIVE cycle:
//   - MONTHLY: if endAt < now → mark EXPIRED, pause all ads, notify admin
//   - MONTHLY: if endAt < now + 3 days AND adminNotifiedAt is null → notify admin (warning)
//   - IMPRESSIONS: if impressionsUsed >= impressionsLimit → mark EXPIRED, pause all ads, notify admin
//   - IMPRESSIONS: if impressionsUsed >= 80% of limit AND adminNotifiedAt is null → notify admin (warning)

export async function GET(req: NextRequest) {
  // Auth check (same as renew-subscriptions)
  const url = new URL(req.url)
  const queryKey = url.searchParams.get('key')
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'portal-cron-2024'
  const isLocalhost = req.headers.get('host')?.startsWith('localhost')
  if (!isLocalhost) {
    if (queryKey !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
  }

  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  let expired = 0
  let warned = 0

  const activeCycles = await db.enterpriseBillingCycle.findMany({
    where: { status: 'ACTIVE' },
    include: {
      sponsoredCategory: { include: { category: { select: { name: true } } } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  for (const cycle of activeCycles) {
    const sc = cycle.sponsoredCategory
    const categoryName = sc.category.name

    if (cycle.type === 'MONTHLY' && cycle.endAt) {
      // Expired?
      if (cycle.endAt < now) {
        await db.enterpriseBillingCycle.update({
          where: { id: cycle.id },
          data: { status: 'EXPIRED' },
        })
        await db.enterpriseAd.updateMany({
          where: { sponsoredCategoryId: sc.id, ownerId: cycle.userId, status: 'ACTIVE' },
          data: { status: 'PAUSED' },
        })
        // Notify admin
        const admin = await db.user.findFirst({ where: { role: 'MASTER' } })
        if (admin) {
          await db.notification.create({
            data: {
              userId: admin.id,
              type: 'SYSTEM',
              title: '⏰ Ciclo Enterprise expirado',
              message: `O ciclo mensal de "${cycle.user.name}" em "${categoryName}" expirou. Contate para renovação ou libere o espaço para outros anunciantes.`,
              link: 'admin',
            },
          }).catch(() => {})
        }
        // Notify the company user
        await db.notification.create({
          data: {
            userId: cycle.userId,
            type: 'SYSTEM',
            title: '⏰ Seu anúncio Enterprise foi pausado',
            message: `Seu ciclo em "${categoryName}" expirou. Renove para reativar seus anúncios.`,
            link: 'enterprise',
          },
        }).catch(() => {})
        expired++
        continue
      }
      // Warning 3 days before?
      if (cycle.endAt < threeDaysFromNow && !cycle.adminNotifiedAt) {
        await db.enterpriseBillingCycle.update({
          where: { id: cycle.id },
          data: { adminNotifiedAt: now },
        })
        const admin = await db.user.findFirst({ where: { role: 'MASTER' } })
        if (admin) {
          await db.notification.create({
            data: {
              userId: admin.id,
              type: 'SYSTEM',
              title: '⏰ Ciclo Enterprise vence em 3 dias',
              message: `O ciclo de "${cycle.user.name}" em "${categoryName}" vence em ${new Date(cycle.endAt).toLocaleDateString('pt-BR')}. Programe renovação.`,
              link: 'admin',
            },
          }).catch(() => {})
        }
        // Notify the company user too
        await db.notification.create({
          data: {
            userId: cycle.userId,
            type: 'SYSTEM',
            title: '⏰ Renovação próxima',
            message: `Seu anúncio em "${categoryName}" vence em 3 dias. Renove para não interromper.`,
            link: 'enterprise',
          },
        }).catch(() => {})
        warned++
      }
    }

    if (cycle.type === 'IMPRESSIONS' && cycle.impressionsLimit > 0) {
      // Expired?
      if (cycle.impressionsUsed >= cycle.impressionsLimit) {
        await db.enterpriseBillingCycle.update({
          where: { id: cycle.id },
          data: { status: 'EXPIRED' },
        })
        await db.enterpriseAd.updateMany({
          where: { sponsoredCategoryId: sc.id, ownerId: cycle.userId, status: 'ACTIVE' },
          data: { status: 'PAUSED' },
        })
        const admin = await db.user.findFirst({ where: { role: 'MASTER' } })
        if (admin) {
          await db.notification.create({
            data: {
              userId: admin.id,
              type: 'SYSTEM',
              title: '⏰ Impressões esgotadas',
              message: `As impressões contratadas por "${cycle.user.name}" em "${categoryName}" acabaram. Anúncios pausados.`,
              link: 'admin',
            },
          }).catch(() => {})
        }
        await db.notification.create({
          data: {
            userId: cycle.userId,
            type: 'SYSTEM',
            title: '⏰ Impressões esgotadas',
            message: `Suas impressões em "${categoryName}" acabaram. Contrate mais para reativar.`,
            link: 'enterprise',
          },
        }).catch(() => {})
        expired++
        continue
      }
      // Warning at 80%?
      if (cycle.impressionsUsed >= cycle.impressionsLimit * 0.8 && !cycle.adminNotifiedAt) {
        await db.enterpriseBillingCycle.update({
          where: { id: cycle.id },
          data: { adminNotifiedAt: now },
        })
        const admin = await db.user.findFirst({ where: { role: 'MASTER' } })
        if (admin) {
          await db.notification.create({
            data: {
              userId: admin.id,
              type: 'SYSTEM',
              title: '⏰ 80% das impressões usadas',
              message: `"${cycle.user.name}" em "${categoryName}" usou ${cycle.impressionsUsed}/${cycle.impressionsLimit} impressões. Programe renovação.`,
              link: 'admin',
            },
          }).catch(() => {})
        }
        await db.notification.create({
          data: {
            userId: cycle.userId,
            type: 'SYSTEM',
            title: '⏰ 80% das impressões usadas',
            message: `Você usou ${cycle.impressionsUsed}/${cycle.impressionsLimit} impressões em "${categoryName}". Falta pouco.`,
            link: 'enterprise',
          },
        }).catch(() => {})
        warned++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checked: activeCycles.length,
    expired,
    warned,
    at: now.toISOString(),
  })
}
