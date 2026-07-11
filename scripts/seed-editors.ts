import { db } from '../src/lib/db'

async function main() {
  console.log('🌱 Seeding editor profiles...')

  // Get the editor demo user
  const editor = await db.user.findUnique({ where: { email: 'editor@portal.com' } })
  if (!editor) {
    console.log('⚠️ Editor user not found')
    return
  }

  // Get categories to assign
  const categories = await db.category.findMany()
  const politicaCat = categories.find(c => c.slug === 'politica')
  const esportesCat = categories.find(c => c.slug === 'esportes')
  const geralCat = categories.find(c => c.slug === 'geral')

  const allowedCatIds = [politicaCat?.id, esportesCat?.id, geralCat?.id].filter(Boolean) as string[]

  // Create editor profile for the demo editor
  const existing = await db.editorProfile.findUnique({ where: { userId: editor.id } })
  if (!existing) {
    await db.editorProfile.create({
      data: {
        userId: editor.id,
        categoriesAllowed: JSON.stringify(allowedCatIds),
        requiresApproval: true,
        canEditOwnPosts: true,
        allowImages: true,
        allowVideos: true,
        allowLinks: true,
        showEditorName: true,
        postLimitDaily: 5,
        postLimitWeekly: 20,
        postLimitMonthly: 50,
        panelAccess: JSON.stringify(['dashboard', 'posts', 'editor']),
        trustLevel: 30, // start as PLENO
        consecutiveApprovals: 5,
        autoApproveThreshold: 10,
        autoRejectAfterHours: 48, // auto-reject after 48h
        autoApproveAfterHours: null,
        level: 'PLENO',
        bioSlug: 'editor-demo',
        bioTitle: 'Editor de Política e Esportes',
        bioAvatar: editor.avatar,
        bioSocialLinks: JSON.stringify({
          twitter: 'https://twitter.com/editordemo',
          website: 'https://editordemo.com',
        }),
        bioShowPhoto: true,
        bioShowBio: true,
        bioShowCategories: true,
        bioShowSocial: true,
        bioShowRecentPosts: true,
        bioShowStats: true,
        bioShowRating: true,
        bioIsActive: true,
      },
    })
    console.log('✅ EditorProfile created for demo editor')
  } else {
    console.log('ℹ️ EditorProfile already exists')
  }

  // Also create a profile for admin (master level, no approval needed)
  const admin = await db.user.findUnique({ where: { email: 'admin@portal.com' } })
  if (admin) {
    const adminProfile = await db.editorProfile.findUnique({ where: { userId: admin.id } })
    if (!adminProfile) {
      await db.editorProfile.create({
        data: {
          userId: admin.id,
          categoriesAllowed: null, // all categories
          requiresApproval: false, // master doesn't need approval
          canEditOwnPosts: true,
          allowImages: true,
          allowVideos: true,
          allowLinks: true,
          showEditorName: true,
          postLimitDaily: -1, // unlimited
          postLimitWeekly: -1,
          postLimitMonthly: -1,
          panelAccess: JSON.stringify(['dashboard', 'posts', 'editor', 'ads', 'categories', 'seo', 'users', 'classifieds']),
          trustLevel: 100,
          level: 'MASTER',
          autoApproveThreshold: 0,
          autoRejectAfterHours: null,
          autoApproveAfterHours: null,
          bioSlug: 'admin-master',
          bioTitle: 'Editor Master & Administrador',
          bioAvatar: admin.avatar,
          bioIsActive: true,
        },
      })
      console.log('✅ EditorProfile created for admin (master)')
    }
  }

  // Create a few sample editor ratings
  if (editor) {
    const ratingsExist = await db.editorRating.count({ where: { editorId: editor.id } })
    if (ratingsExist === 0 && admin) {
      await db.editorRating.createMany({
        data: [
          { editorId: editor.id, raterId: admin.id, rating: 5, comment: 'Excelente editor, sempre pontual e preciso.' },
        ],
      })
      console.log('✅ Sample editor ratings created')
    }
  }

  // SEO settings for editorial system
  await db.seoSetting.upsert({
    where: { key: 'editor_default_auto_approve_threshold' },
    update: { value: '10' },
    create: { key: 'editor_default_auto_approve_threshold', value: '10' },
  })
  await db.seoSetting.upsert({
    where: { key: 'editor_default_auto_reject_hours' },
    update: { value: '48' },
    create: { key: 'editor_default_auto_reject_hours', value: '48' },
  })
  await db.seoSetting.upsert({
    where: { key: 'editor_default_post_limit_daily' },
    update: { value: '5' },
    create: { key: 'editor_default_post_limit_daily', value: '5' },
  })

  console.log('✅ Editorial system seed complete!')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
