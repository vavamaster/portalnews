import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getOrCreateEditorProfile, getEditorProfileData } from '@/lib/editors'

// GET /api/editor-profile/mine - get current user's editor profile
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const profile = await db.editorProfile.findUnique({
    where: { userId: user.id },
    include: {
      user: { select: { name: true, email: true, avatar: true, bio: true } },
    },
  })

  if (!profile) {
    return NextResponse.json({ profile: null, message: 'Sem perfil de editor' })
  }

  // Parse JSON fields
  const parsed = {
    ...profile,
    categoriesAllowed: profile.categoriesAllowed ? JSON.parse(profile.categoriesAllowed) : null,
    panelAccess: profile.panelAccess ? JSON.parse(profile.panelAccess) : [],
    bioSocialLinks: profile.bioSocialLinks ? JSON.parse(profile.bioSocialLinks) : null,
  }

  // Get rate limit usage
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const [daily, weekly, monthly] = await Promise.all([
    db.post.count({ where: { authorId: user.id, createdAt: { gte: dayAgo } } }),
    db.post.count({ where: { authorId: user.id, createdAt: { gte: weekAgo } } }),
    db.post.count({ where: { authorId: user.id, createdAt: { gte: monthAgo } } }),
  ])

  // Get pending posts count
  const pendingCount = await db.post.count({ where: { authorId: user.id, status: 'PENDING' } })

  return NextResponse.json({
    profile: parsed,
    usage: { daily, weekly, monthly },
    pendingCount,
  })
}

// PUT /api/editor-profile/mine - editor updates own bio visibility settings (only bio fields)
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  // Only allow editor to update bio fields (not permissions, trust, etc.)
  const allowedFields = [
    'bioSlug', 'bioTitle', 'bioAvatar', 'bioSocialLinks',
    'bioShowPhoto', 'bioShowBio', 'bioShowCategories', 'bioShowSocial',
    'bioShowRecentPosts', 'bioShowStats', 'bioShowRating', 'bioIsActive',
  ]

  const update: any = {}
  for (const f of allowedFields) {
    if (body[f] !== undefined) {
      if (f === 'bioSocialLinks' && typeof body[f] === 'object') {
        update[f] = JSON.stringify(body[f])
      } else {
        update[f] = body[f]
      }
    }
  }

  // Check bioSlug uniqueness if changing
  if (update.bioSlug) {
    const existing = await db.editorProfile.findFirst({
      where: { bioSlug: update.bioSlug, NOT: { userId: user.id } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Slug já em uso por outro editor' }, { status: 400 })
    }
  }

  // Get or create profile
  await getOrCreateEditorProfile(user.id)
  const updated = await db.editorProfile.update({
    where: { userId: user.id },
    data: update,
  })

  return NextResponse.json({ profile: updated })
}
