import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { computeLevel, EDITOR_LEVELS } from '@/lib/editors'

// PUT /api/editor-profile/[userId] - admin updates editor profile
export async function PUT(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const body = await req.json()

  // Convert arrays to JSON strings
  const update: any = {}
  const fields = [
    'requiresApproval', 'canEditOwnPosts', 'allowImages', 'allowVideos', 'allowLinks',
    'showEditorName', 'postLimitDaily', 'postLimitWeekly', 'postLimitMonthly',
    'autoApproveThreshold', 'autoRejectAfterHours', 'autoApproveAfterHours',
    'bioSlug', 'bioTitle', 'bioAvatar',
    'bioShowPhoto', 'bioShowBio', 'bioShowCategories', 'bioShowSocial',
    'bioShowRecentPosts', 'bioShowStats', 'bioShowRating', 'bioIsActive',
    'trustLevel', 'level',
  ]
  for (const f of fields) {
    if (body[f] !== undefined) update[f] = body[f]
  }
  if (body.categoriesAllowed !== undefined) {
    update.categoriesAllowed = body.categoriesAllowed === null ? null : JSON.stringify(body.categoriesAllowed)
  }
  if (body.panelAccess !== undefined) {
    update.panelAccess = JSON.stringify(body.panelAccess)
  }
  if (body.bioSocialLinks !== undefined) {
    update.bioSocialLinks = body.bioSocialLinks === null ? null : JSON.stringify(body.bioSocialLinks)
  }

  // Auto-recompute level from trustLevel if not explicitly provided
  if (update.trustLevel !== undefined && update.level === undefined) {
    update.level = computeLevel(update.trustLevel)
  }

  // Check bioSlug uniqueness
  if (update.bioSlug) {
    const existing = await db.editorProfile.findFirst({
      where: { bioSlug: update.bioSlug, NOT: { userId } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Slug já em uso' }, { status: 400 })
    }
  }

  // Get or create profile
  let profile = await db.editorProfile.findUnique({ where: { userId } })
  if (!profile) {
    profile = await db.editorProfile.create({ data: { userId } })
  }

  const updated = await db.editorProfile.update({
    where: { userId },
    data: update,
  })

  return NextResponse.json({ profile: updated })
}

// DELETE - admin removes editor profile (revert user to READER)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER'].includes(user.role)) {
    return NextResponse.json({ error: 'Apenas MASTER pode remover editores' }, { status: 403 })
  }

  await db.editorProfile.deleteMany({ where: { userId } })
  await db.user.update({ where: { id: userId }, data: { role: 'READER' } })

  return NextResponse.json({ ok: true })
}
