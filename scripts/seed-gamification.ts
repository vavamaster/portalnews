import { db } from '../src/lib/db'
import { ACHIEVEMENTS, seedAchievements, generateReferralCode } from '../src/lib/achievements'

async function main() {
  console.log('🌱 Seeding gamification extras...')

  // ---------- ACHIEVEMENTS ----------
  await seedAchievements()
  console.log('✅ Achievements seeded:', ACHIEVEMENTS.length)

  // ---------- COUPONS ----------
  const coupons = [
    {
      code: 'BEMVINDO10',
      type: 'PERCENT',
      value: 10,
      minAmountCents: 0,
      maxRedemptions: -1,
      validFrom: new Date(),
      validUntil: null,
      isActive: true,
      description: '10% OFF em qualquer plano - boas-vindas!',
      appliesTo: 'SUBSCRIPTION',
      firstTimeOnly: true,
    },
    {
      code: 'ALTA15',
      type: 'PERCENT',
      value: 15,
      minAmountCents: 4990,
      maxRedemptions: 100,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isActive: true,
      description: '15% OFF em planos Profissional ou superior',
      appliesTo: 'SUBSCRIPTION',
      firstTimeOnly: false,
    },
    {
      code: 'BLACK40',
      type: 'PERCENT',
      value: 40,
      minAmountCents: 9900,
      maxRedemptions: 50,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      description: '40% OFF no plano Empresa (Black Friday)',
      appliesTo: 'SUBSCRIPTION',
      firstTimeOnly: false,
    },
    {
      code: 'BOOST5',
      type: 'FIXED',
      value: 500, // R$ 5,00 in cents (used as points credit if applied to boost)
      minAmountCents: 0,
      maxRedemptions: -1,
      validFrom: new Date(),
      validUntil: null,
      isActive: true,
      description: '5 créditos extras ao usar boost',
      appliesTo: 'BOOST',
      firstTimeOnly: true,
    },
  ]
  for (const c of coupons) {
    await db.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    })
  }
  console.log('✅ Coupons seeded:', coupons.length)

  // ---------- REFERRAL CODES for existing users ----------
  const users = await db.user.findMany({ where: { referralCode: null } })
  for (const u of users) {
    const code = generateReferralCode(u.name)
    await db.user.update({ where: { id: u.id }, data: { referralCode: code } })
  }
  console.log('✅ Referral codes generated for', users.length, 'users')

  // ---------- SEO updates for gamification ----------
  const seoDefaults = [
    { key: 'checkin_base_points', value: '10' },
    { key: 'checkin_streak_3_multiplier', value: '1.5' },
    { key: 'checkin_streak_7_multiplier', value: '2' },
    { key: 'checkin_streak_30_multiplier', value: '3' },
    { key: 'referral_bonus_points', value: '50' },
    { key: 'review_bonus_points', value: '5' },
    { key: 'profile_complete_bonus_points', value: '30' },
  ]
  for (const s of seoDefaults) {
    await db.seoSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value },
    })
  }
  console.log('✅ SEO gamification defaults seeded')

  // ---------- Sample notifications for admin ----------
  const admin = await db.user.findUnique({ where: { email: 'admin@portal.com' } })
  if (admin) {
    const existingNotifs = await db.notification.count({ where: { userId: admin.id } })
    if (existingNotifs === 0) {
      await db.notification.createMany({
        data: [
          { userId: admin.id, type: 'SYSTEM', title: 'Bem-vindo ao painel!', message: 'Sistema de gamificação ativo. Conquistas, cupons e check-in disponíveis.', link: 'profile' },
          { userId: admin.id, type: 'ACHIEVEMENT', title: 'Conquista: PROFILE_COMPLETE!', message: '+30 pontos por completar seu perfil', link: 'profile' },
          { userId: admin.id, type: 'COUPON', title: 'Cupom BEMVINDO10 disponível', message: '10% OFF na primeira assinatura. Compartilhe com seus clientes!' },
        ],
      })
    }
  }

  console.log('✅ Gamification seed complete!')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
