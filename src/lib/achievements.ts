import { db } from './db'

export interface AchievementConfig {
  slug: string
  name: string
  description: string
  icon: string // lucide icon name
  color: string // tailwind color name
  pointsReward: number
  category: 'ENGAGEMENT' | 'STREAK' | 'CONTENT' | 'SOCIAL' | 'MILESTONE'
}

export const ACHIEVEMENTS: AchievementConfig[] = [
  // Engagement
  { slug: 'FIRST_READ', name: 'Primeira Leitura', description: 'Leu sua primeira notícia', icon: 'BookOpen', color: 'blue', pointsReward: 5, category: 'ENGAGEMENT' },
  { slug: 'FIRST_REACTION', name: 'Primeira Reação', description: 'Reagiu à sua primeira notícia', icon: 'Heart', color: 'rose', pointsReward: 5, category: 'ENGAGEMENT' },
  { slug: 'FIRST_LISTING', name: 'Primeiro Anúncio', description: 'Publicou seu primeiro classificado', icon: 'Megaphone', color: 'amber', pointsReward: 20, category: 'ENGAGEMENT' },
  { slug: 'FIRST_REVIEW', name: 'Primeira Avaliação', description: 'Avaliou seu primeiro anúncio', icon: 'Star', color: 'purple', pointsReward: 5, category: 'ENGAGEMENT' },
  { slug: 'FIRST_FAVORITE', name: 'Primeiro Favorito', description: 'Salvou seu primeiro anúncio', icon: 'Bookmark', color: 'pink', pointsReward: 3, category: 'ENGAGEMENT' },
  // Streak
  { slug: 'STREAK_3', name: 'Pegando Ritmo', description: 'Check-in 3 dias seguidos', icon: 'Flame', color: 'orange', pointsReward: 15, category: 'STREAK' },
  { slug: 'STREAK_7', name: 'Semana Perfeita', description: 'Check-in 7 dias seguidos', icon: 'Flame', color: 'red', pointsReward: 50, category: 'STREAK' },
  { slug: 'STREAK_30', name: 'Mestre da Constância', description: 'Check-in 30 dias seguidos', icon: 'Trophy', color: 'amber', pointsReward: 200, category: 'STREAK' },
  // Content
  { slug: 'READER_10', name: 'Leitor Frequente', description: 'Leu 10 notícias diferentes', icon: 'Newspaper', color: 'sky', pointsReward: 20, category: 'CONTENT' },
  { slug: 'READER_50', name: 'Leitor Ávido', description: 'Leu 50 notícias diferentes', icon: 'Library', color: 'indigo', pointsReward: 100, category: 'CONTENT' },
  { slug: 'READER_100', name: 'Devorador de Notícias', description: 'Leu 100 notícias diferentes', icon: 'GraduationCap', color: 'purple', pointsReward: 250, category: 'CONTENT' },
  // Social
  { slug: 'REFERRAL_1', name: 'Indicador', description: 'Convidou seu 1º amigo que publicou', icon: 'UserPlus', color: 'emerald', pointsReward: 50, category: 'SOCIAL' },
  { slug: 'REFERRAL_5', name: 'Embaixador', description: '5 amigos publicaram via seu convite', icon: 'Users', color: 'teal', pointsReward: 300, category: 'SOCIAL' },
  { slug: 'REVIEW_5', name: 'Crítico', description: 'Avaliou 5 anúncios', icon: 'Star', color: 'amber', pointsReward: 25, category: 'SOCIAL' },
  // Milestone
  { slug: 'PROFILE_COMPLETE', name: 'Perfil Completo', description: 'Completou 100% do perfil', icon: 'CheckCircle2', color: 'emerald', pointsReward: 30, category: 'MILESTONE' },
  { slug: 'VERIFIED', name: 'Verificado', description: 'CPF/CNPJ verificado', icon: 'BadgeCheck', color: 'blue', pointsReward: 50, category: 'MILESTONE' },
  { slug: 'FIRST_SUBSCRIPTION', name: 'Cliente Premium', description: 'Assinou um plano pago', icon: 'Crown', color: 'purple', pointsReward: 30, category: 'MILESTONE' },
  { slug: 'POINTS_500', name: 'Pontuador', description: 'Acumulou 500 pontos na vida', icon: 'Award', color: 'amber', pointsReward: 0, category: 'MILESTONE' },
  { slug: 'POINTS_1000', name: 'Mestre dos Pontos', description: 'Acumulou 1000 pontos na vida', icon: 'Trophy', color: 'amber', pointsReward: 0, category: 'MILESTONE' },
]

export async function seedAchievements() {
  for (const a of ACHIEVEMENTS) {
    await db.achievement.upsert({
      where: { slug: a.slug },
      update: { name: a.name, description: a.description, icon: a.icon, color: a.color, pointsReward: a.pointsReward, category: a.category },
      create: a,
    })
  }
}

// Check & award an achievement for a user. Returns the achievement if newly awarded.
export async function checkAndAwardAchievement(userId: string, slug: string): Promise<{ awarded: boolean; achievement?: AchievementConfig }> {
  const config = ACHIEVEMENTS.find(a => a.slug === slug)
  if (!config) return { awarded: false }

  const achievement = await db.achievement.findUnique({ where: { slug } })
  if (!achievement) return { awarded: false }

  // Check if already awarded — use findFirst with both fields to avoid composite key issues
  const existing = await db.userAchievement.findFirst({
    where: { userId, achievementId: achievement.id },
  }).catch(() => null)

  if (existing) return { awarded: false }

  // Use upsert to handle race conditions (multiple concurrent calls)
  try {
    await db.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId: achievement.id } },
      create: { userId, achievementId: achievement.id },
      update: {}, // no-op if already exists
    })
  } catch {
      // If upsert fails (e.g. composite key issue), try create with catch
      try {
        await db.userAchievement.create({ data: { userId, achievementId: achievement.id } })
      } catch {
        // Already exists — race condition, safe to ignore
        return { awarded: false }
      }
  }

  // Award points + notification
  if (config.pointsReward > 0) {
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { points: { increment: config.pointsReward } },
      }),
      db.pointTransaction.create({
        data: { userId, amount: config.pointsReward, reason: 'ACHIEVEMENT' },
      }),
    ])
  }

  await db.notification.create({
    data: {
      userId,
      type: 'ACHIEVEMENT',
      title: `Conquista desbloqueada: ${config.name}!`,
      message: config.description + (config.pointsReward > 0 ? ` +${config.pointsReward} pontos!` : ''),
      link: 'profile',
    },
  }).catch(() => {})

  return { awarded: true, achievement: config }
}

async function getAchievementId(slug: string): Promise<string> {
  const a = await db.achievement.findUnique({ where: { slug } })
  return a?.id || ''
}

// Auto-check all achievements based on user state
export async function autoCheckAchievements(userId: string): Promise<{ awarded: AchievementConfig[] }> {
  const awarded: AchievementConfig[] = []
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      readingHistory: true,
      reactions: true,
      classifiedListings: true,
      reviews: true,
      favorites: true,
      referrals: true,
      _count: { select: { referrals: true } },
    },
  })
  if (!user) return { awarded: [] }

  const checks: { slug: string; condition: boolean }[] = [
    { slug: 'FIRST_READ', condition: user.readingHistory.length >= 1 },
    { slug: 'FIRST_REACTION', condition: user.reactions.length >= 1 },
    { slug: 'FIRST_LISTING', condition: user.classifiedListings.length >= 1 },
    { slug: 'FIRST_REVIEW', condition: user.reviews.length >= 1 },
    { slug: 'FIRST_FAVORITE', condition: user.favorites.length >= 1 },
    { slug: 'STREAK_3', condition: user.checkInStreak >= 3 },
    { slug: 'STREAK_7', condition: user.checkInStreak >= 7 },
    { slug: 'STREAK_30', condition: user.checkInStreak >= 30 },
    { slug: 'READER_10', condition: user.readingHistory.length >= 10 },
    { slug: 'READER_50', condition: user.readingHistory.length >= 50 },
    { slug: 'READER_100', condition: user.readingHistory.length >= 100 },
    { slug: 'REFERRAL_1', condition: user._count.referrals >= 1 },
    { slug: 'REFERRAL_5', condition: user._count.referrals >= 5 },
    { slug: 'REVIEW_5', condition: user.reviews.length >= 5 },
    { slug: 'PROFILE_COMPLETE', condition: !!user.profileCompletedAt },
    { slug: 'VERIFIED', condition: user.verificationStatus === 'VERIFIED' },
    { slug: 'POINTS_500', condition: user.points >= 500 },
    { slug: 'POINTS_1000', condition: user.points >= 1000 },
  ]

  // also check if user has any active subscription (paid)
  const activeSub = await db.subscription.findFirst({
    where: { userId, status: 'ACTIVE', paymentProvider: { not: 'NONE' } },
  })
  if (activeSub) checks.push({ slug: 'FIRST_SUBSCRIPTION', condition: true })

  for (const { slug, condition } of checks) {
    if (condition) {
      const result = await checkAndAwardAchievement(userId, slug)
      if (result.awarded && result.achievement) {
        awarded.push(result.achievement)
      }
    }
  }

  return { awarded }
}

// Calculate profile completeness percentage
export function calculateProfileCompleteness(user: any): { pct: number; missing: string[] } {
  const checks = [
    { key: 'name', label: 'Nome completo', ok: !!user.name && user.name.length > 2 },
    { key: 'avatar', label: 'Foto de perfil', ok: !!user.avatar },
    { key: 'bio', label: 'Bio', ok: !!user.bio && user.bio.length > 10 },
    { key: 'document', label: 'CPF/CNPJ', ok: !!user.verificationDoc },
    { key: 'verified', label: 'Verificação', ok: user.verificationStatus === 'VERIFIED' },
    { key: 'subscription', label: 'Plano ativo', ok: !!user.subscription },
  ]
  const completed = checks.filter(c => c.ok).length
  const pct = Math.round((completed / checks.length) * 100)
  const missing = checks.filter(c => !c.ok).map(c => c.label)
  return { pct, missing }
}

// Check-in logic with streak multiplier
export async function performCheckIn(userId: string): Promise<{ awarded: number; streak: number; multiplier: number; points: number; newAchievements: any[] }> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  // Already checked in today?
  if (user.lastCheckInAt) {
    const lastCheckIn = new Date(user.lastCheckInAt)
    const lastCheckInDay = new Date(lastCheckIn.getFullYear(), lastCheckIn.getMonth(), lastCheckIn.getDate())
    if (lastCheckInDay.getTime() === today.getTime()) {
      throw new Error('Você já fez check-in hoje. Volte amanhã!')
    }
  }

  // Determine streak
  let newStreak = 1
  if (user.lastCheckInAt) {
    const lastCheckIn = new Date(user.lastCheckInAt)
    const lastCheckInDay = new Date(lastCheckIn.getFullYear(), lastCheckIn.getMonth(), lastCheckIn.getDate())
    if (lastCheckInDay.getTime() === yesterday.getTime()) {
      newStreak = (user.checkInStreak || 0) + 1
    }
  }

  // Streak multiplier: 7+ days = 2x, 30+ = 3x
  let multiplier = 1
  if (newStreak >= 30) multiplier = 3
  else if (newStreak >= 7) multiplier = 2
  else if (newStreak >= 3) multiplier = 1.5

  const basePoints = 10
  const pointsToAward = Math.round(basePoints * multiplier)

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        lastCheckInAt: now,
        checkInStreak: newStreak,
        points: { increment: pointsToAward },
      },
    }),
    db.pointTransaction.create({
      data: { userId, amount: pointsToAward, reason: 'DAILY_CHECKIN' },
    }),
    db.notification.create({
      data: {
        userId,
        type: 'CHECKIN',
        title: `Check-in diário realizado! +${pointsToAward} pontos`,
        message: `Sequência: ${newStreak} dia(s). ${multiplier > 1 ? `Multiplicador ${multiplier}x ativo!` : 'Continue para ganhar multiplicador!'}`,
        link: 'profile',
      },
    }),
  ])

  // Auto check achievements (streak ones, etc.)
  const { awarded } = await autoCheckAchievements(userId)

  return {
    awarded: pointsToAward,
    streak: newStreak,
    multiplier,
    points: pointsToAward,
    newAchievements: awarded,
  }
}

// Generate unique referral code
export function generateReferralCode(name: string): string {
  const cleanName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${cleanName}${random}`.padEnd(8, 'X').slice(0, 8)
}

// Award referral bonus when invitee publishes first listing
export async function checkReferralBonus(listingOwnerId: string): Promise<{ awarded: boolean; referrerName?: string }> {
  const owner = await db.user.findUnique({ where: { id: listingOwnerId } })
  if (!owner) return { awarded: false }
  if (owner.referralBonusAwarded) return { awarded: false }
  if (!owner.referredById) return { awarded: false }

  // Check if this is owner's first listing
  const listingCount = await db.classifiedListing.count({ where: { ownerId: listingOwnerId } })
  if (listingCount !== 1) return { awarded: false }

  const referrer = await db.user.findUnique({ where: { id: owner.referredById } })
  if (!referrer) return { awarded: false }

  const bonusPoints = 50

  await db.$transaction([
    db.user.update({
      where: { id: owner.id },
      data: { referralBonusAwarded: true },
    }),
    db.user.update({
      where: { id: referrer.id },
      data: { points: { increment: bonusPoints } },
    }),
    db.pointTransaction.create({
      data: { userId: referrer.id, amount: bonusPoints, reason: 'REFERRAL_LISTING' },
    }),
    db.notification.create({
      data: {
        userId: referrer.id,
        type: 'REFERRAL',
        title: 'Bônus de indicação!',
        message: `${owner.name} publicou o 1º anúncio com seu código. +${bonusPoints} pontos!`,
        link: 'profile',
      },
    }),
  ])

  // Auto-check referral achievements for referrer
  await autoCheckAchievements(referrer.id)

  return { awarded: true, referrerName: referrer.name }
}

// Validate a coupon
export async function validateCoupon(code: string, userId: string, amountCents: number, appliesTo: string): Promise<{ valid: boolean; coupon?: any; discountCents?: number; error?: string }> {
  const coupon = await db.coupon.findUnique({
    where: { code: code.toUpperCase() },
    include: { redemptions: true },
  })
  if (!coupon) return { valid: false, error: 'Cupom não encontrado' }
  if (!coupon.isActive) return { valid: false, error: 'Cupom inativo' }
  if (coupon.validFrom > new Date()) return { valid: false, error: 'Cupom ainda não válido' }
  if (coupon.validUntil && coupon.validUntil < new Date()) return { valid: false, error: 'Cupom expirado' }
  if (coupon.maxRedemptions !== -1 && coupon.currentRedemptions >= coupon.maxRedemptions) return { valid: false, error: 'Cupom esgotado' }
  if (coupon.appliesTo !== 'ALL' && coupon.appliesTo !== appliesTo) return { valid: false, error: `Cupom válido apenas para ${coupon.appliesTo.toLowerCase()}` }
  if (amountCents < coupon.minAmountCents) return { valid: false, error: `Valor mínimo: R$ ${(coupon.minAmountCents / 100).toFixed(2)}` }
  if (coupon.firstTimeOnly) {
    const alreadyRedeemed = coupon.redemptions.some(r => r.userId === userId)
    if (alreadyRedeemed) return { valid: false, error: 'Cupom válido apenas na 1ª compra' }
  }

  let discountCents = 0
  if (coupon.type === 'PERCENT') {
    discountCents = Math.round(amountCents * (coupon.value / 100))
  } else {
    discountCents = Math.round(coupon.value)
  }
  discountCents = Math.min(discountCents, amountCents)

  return { valid: true, coupon, discountCents }
}

// Create a notification helper
export async function notify(userId: string, type: string, title: string, message: string, link?: string) {
  await db.notification.create({
    data: { userId, type, title, message, link },
  })
}
