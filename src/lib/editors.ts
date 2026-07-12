import { db } from './db'
import { safeJsonParse, safeJsonArray } from './utils'

// ============= EDITOR PROFILE HELPERS =============

export interface EditorProfileData {
  requiresApproval: boolean
  categoriesAllowed: string[] | null // null = all
  postLimitDaily: number // -1 = unlimited
  postLimitWeekly: number
  postLimitMonthly: number
  canEditOwnPosts: boolean
  allowImages: boolean
  allowVideos: boolean
  allowLinks: boolean
  showEditorName: boolean
  panelAccess: string[]
  trustLevel: number
  consecutiveApprovals: number
  autoApproveThreshold: number
  autoRejectAfterHours: number | null
  autoApproveAfterHours: number | null
  level: 'JUNIOR' | 'PLENO' | 'SENIOR' | 'MASTER'
}

// Get editor profile or create with defaults if missing
export async function getOrCreateEditorProfile(userId: string) {
  let profile = await db.editorProfile.findUnique({ where: { userId } })
  if (!profile) {
    profile = await db.editorProfile.create({
      data: { userId },
    })
  }
  return profile
}

export async function getEditorProfileData(userId: string): Promise<EditorProfileData | null> {
  const profile = await db.editorProfile.findUnique({ where: { userId } })
  if (!profile) return null
  return {
    requiresApproval: profile.requiresApproval,
    categoriesAllowed: profile.categoriesAllowed ? safeJsonArray<string>(profile.categoriesAllowed, null as any) : null,
    postLimitDaily: profile.postLimitDaily,
    postLimitWeekly: profile.postLimitWeekly,
    postLimitMonthly: profile.postLimitMonthly,
    canEditOwnPosts: profile.canEditOwnPosts,
    allowImages: profile.allowImages,
    allowVideos: profile.allowVideos,
    allowLinks: profile.allowLinks,
    showEditorName: profile.showEditorName,
    panelAccess: profile.panelAccess ? safeJsonArray<string>(profile.panelAccess, ['dashboard', 'posts', 'editor']) : ['dashboard', 'posts', 'editor'],
    trustLevel: profile.trustLevel,
    consecutiveApprovals: profile.consecutiveApprovals,
    autoApproveThreshold: profile.autoApproveThreshold,
    autoRejectAfterHours: profile.autoRejectAfterHours,
    autoApproveAfterHours: profile.autoApproveAfterHours,
    level: profile.level as any,
  }
}

// Check if editor can publish in a specific category
export async function canEditorPublishInCategory(userId: string, categoryId: string): Promise<{ allowed: boolean; reason?: string }> {
  const profile = await getEditorProfileData(userId)
  if (!profile) return { allowed: true, reason: 'No profile - default allow (admin)' }
  if (profile.categoriesAllowed === null) return { allowed: true }
  if (!profile.categoriesAllowed.includes(categoryId)) {
    return { allowed: false, reason: 'Categoria não permitida para este editor' }
  }
  return { allowed: true }
}

// Check rate limits
export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; reason?: string; usage?: { daily: number; weekly: number; monthly: number } }> {
  const profile = await getEditorProfileData(userId)
  if (!profile) return { allowed: true }
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [daily, weekly, monthly] = await Promise.all([
    db.post.count({ where: { authorId: userId, createdAt: { gte: dayAgo } } }),
    db.post.count({ where: { authorId: userId, createdAt: { gte: weekAgo } } }),
    db.post.count({ where: { authorId: userId, createdAt: { gte: monthAgo } } }),
  ])

  const usage = { daily, weekly, monthly }

  if (profile.postLimitDaily !== -1 && daily >= profile.postLimitDaily) {
    return { allowed: false, reason: `Limite diário atingido (${daily}/${profile.postLimitDaily})`, usage }
  }
  if (profile.postLimitWeekly !== -1 && weekly >= profile.postLimitWeekly) {
    return { allowed: false, reason: `Limite semanal atingido (${weekly}/${profile.postLimitWeekly})`, usage }
  }
  if (profile.postLimitMonthly !== -1 && monthly >= profile.postLimitMonthly) {
    return { allowed: false, reason: `Limite mensal atingido (${monthly}/${profile.postLimitMonthly})`, usage }
  }
  return { allowed: true, usage }
}

// Determine if a new post should be auto-approved based on trust
export async function shouldAutoApprove(userId: string): Promise<{ auto: boolean; reason: string }> {
  const profile = await getEditorProfileData(userId)
  if (!profile) return { auto: false, reason: 'Sem perfil de editor' }

  // If editor doesn't require approval at all
  if (!profile.requiresApproval) {
    return { auto: true, reason: 'Editor não requer aprovação' }
  }

  // Smart trust: if consecutive approvals >= threshold, auto-approve
  if (profile.consecutiveApprovals >= profile.autoApproveThreshold && profile.autoApproveThreshold > 0) {
    return { auto: true, reason: `Auto-aprovação: ${profile.consecutiveApprovals} aprovações consecutivas (limiar: ${profile.autoApproveThreshold})` }
  }

  return { auto: false, reason: 'Aguardando revisão administrativa' }
}

// Compute autoActionAt timestamp based on profile config
export async function computeAutoActionAt(userId: string): Promise<{ autoActionAt: Date | null; autoAction: 'APPROVE' | 'REJECT' | null }> {
  const profile = await getEditorProfileData(userId)
  if (!profile) return { autoActionAt: null, autoAction: null }

  // autoApproveAfterHours takes priority over autoRejectAfterHours if both set
  if (profile.autoApproveAfterHours && profile.autoApproveAfterHours > 0) {
    return {
      autoActionAt: new Date(Date.now() + profile.autoApproveAfterHours * 60 * 60 * 1000),
      autoAction: 'APPROVE',
    }
  }
  if (profile.autoRejectAfterHours && profile.autoRejectAfterHours > 0) {
    return {
      autoActionAt: new Date(Date.now() + profile.autoRejectAfterHours * 60 * 60 * 1000),
      autoAction: 'REJECT',
    }
  }
  return { autoActionAt: null, autoAction: null }
}

// Process a manual review (approve or reject)
export async function processReview(postId: string, reviewerId: string, action: 'APPROVED' | 'REJECTED', reason?: string, notes?: string) {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { author: { include: { editorProfile: true } } },
  })
  if (!post) throw new Error('Post não encontrado')

  const now = new Date()
  const wasAutoEligible = post.autoActionAt !== null

  // Update post
  const updatedPost = await db.post.update({
    where: { id: postId },
    data: {
      status: action === 'APPROVED' ? 'PUBLISHED' : 'REJECTED',
      reviewerId,
      reviewedAt: now,
      autoActionAt: null,
      rejectionReason: action === 'REJECTED' ? reason : null,
      rejectionNotes: action === 'REJECTED' ? notes : null,
      reviewCount: { increment: 1 },
      publishedAt: action === 'APPROVED' ? (post.publishedAt || now) : null,
    },
  })

  // Log the review action
  await db.postReviewLog.create({
    data: {
      postId,
      action,
      reviewerId,
      reason: reason || null,
      notes: notes || null,
    },
  })

  // Update editor's trust profile if author has editorProfile
  if (post.author?.editorProfile) {
    const profile = post.author.editorProfile
    if (action === 'APPROVED') {
      const newConsecutive = profile.consecutiveApprovals + 1
      const newTrustLevel = Math.min(100, profile.trustLevel + 2)
      const newLevel = computeLevel(newTrustLevel)
      await db.editorProfile.update({
        where: { userId: post.authorId },
        data: {
          consecutiveApprovals: newConsecutive,
          totalApproved: { increment: 1 },
          trustLevel: newTrustLevel,
          level: newLevel,
        },
      })
    } else {
      // Rejection resets consecutive counter and lowers trust
      const newTrustLevel = Math.max(0, profile.trustLevel - 5)
      const newLevel = computeLevel(newTrustLevel)
      await db.editorProfile.update({
        where: { userId: post.authorId },
        data: {
          consecutiveApprovals: 0,
          totalRejected: { increment: 1 },
          trustLevel: newTrustLevel,
          level: newLevel,
        },
      })
    }
  }

  // Notify the editor
  await db.notification.create({
    data: {
      userId: post.authorId,
      type: 'SYSTEM',
      title: action === 'APPROVED' ? `Notícia aprovada: "${post.title}"` : `Notícia rejeitada: "${post.title}"`,
      message: action === 'APPROVED'
        ? `Sua notícia foi aprovada e publicada. Parabéns!`
        : `Sua notícia foi rejeitada. Motivo: ${reason || 'Não especificado'}${notes ? `. Notas: ${notes}` : ''}`,
      link: 'advertiser', // could navigate to my-posts
    },
  })

  return updatedPost
}

// Auto-process expired posts (called by cron or on-demand)
export async function processAutoActions(): Promise<{ approved: number; rejected: number }> {
  const now = new Date()
  const expired = await db.post.findMany({
    where: {
      status: 'PENDING',
      autoActionAt: { lte: now, not: null },
    },
    include: { author: { include: { editorProfile: true } } },
    take: 50,
  })

  let approved = 0
  let rejected = 0

  for (const post of expired) {
    // Determine action based on whether autoActionAt was set as approve or reject
    // We need to check the editor profile to know which type of auto-action
    const profile = post.author?.editorProfile
    let action: 'APPROVE' | 'REJECT' = 'REJECT' // default safe
    if (profile?.autoApproveAfterHours && profile.autoApproveAfterHours > 0) {
      action = 'APPROVE'
    } else if (profile?.autoRejectAfterHours && profile.autoRejectAfterHours > 0) {
      action = 'REJECT'
    }

    if (action === 'APPROVE') {
      await db.post.update({
        where: { id: post.id },
        data: {
          status: 'PUBLISHED',
          reviewedAt: now,
          autoActionAt: null,
          publishedAt: post.publishedAt || now,
          reviewCount: { increment: 1 },
        },
      })
      await db.postReviewLog.create({
        data: {
          postId: post.id,
          action: 'AUTO_APPROVED',
          notes: `Auto-aprovado após expiração do prazo de revisão`,
        },
      })
      if (profile) {
        await db.editorProfile.update({
          where: { userId: post.authorId },
          data: {
            totalAutoApproved: { increment: 1 },
            totalApproved: { increment: 1 },
          },
        })
      }
      approved++
    } else {
      await db.post.update({
        where: { id: post.id },
        data: {
          status: 'REJECTED',
          reviewedAt: now,
          autoActionAt: null,
          rejectionReason: 'AUTO_TIMEOUT',
          rejectionNotes: 'Rejeitado automaticamente por falta de revisão no prazo',
          reviewCount: { increment: 1 },
        },
      })
      await db.postReviewLog.create({
        data: {
          postId: post.id,
          action: 'AUTO_REJECTED',
          notes: `Auto-rejeitado por expiração do prazo de revisão`,
        },
      })
      if (profile) {
        await db.editorProfile.update({
          where: { userId: post.authorId },
          data: {
            totalAutoRejected: { increment: 1 },
            totalRejected: { increment: 1 },
            consecutiveApprovals: 0, // reset streak on auto-reject
          },
        })
      }
      rejected++
    }

    // Notify editor
    await db.notification.create({
      data: {
        userId: post.authorId,
        type: 'SYSTEM',
        title: action === 'APPROVE' ? `Notícia auto-aprovada: "${post.title}"` : `Notícia auto-rejeitada: "${post.title}"`,
        message: action === 'APPROVE'
          ? 'Aprovação automática por expiração do prazo de revisão.'
          : 'Rejeição automática por expiração do prazo. Reenvie com ajustes se desejar.',
        link: 'advertiser',
      },
    })
  }

  return { approved, rejected }
}

// Compute editor level from trust level
export function computeLevel(trustLevel: number): 'JUNIOR' | 'PLENO' | 'SENIOR' | 'MASTER' {
  if (trustLevel >= 80) return 'MASTER'
  if (trustLevel >= 50) return 'SENIOR'
  if (trustLevel >= 25) return 'PLENO'
  return 'JUNIOR'
}

// Get editor's public profile data (respecting visibility settings)
export async function getEditorPublicProfile(slug: string) {
  const profile = await db.editorProfile.findUnique({
    where: { bioSlug: slug },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, avatar: true, bio: true,
          posts: {
            where: { status: 'PUBLISHED' },
            select: {
              id: true, slug: true, title: true, excerpt: true, coverImage: true,
              publishedAt: true, views: true, category: true,
            },
            orderBy: { publishedAt: 'desc' },
            take: 6,
          },
          editorRatingsReceived: {
            include: { rater: { select: { id: true, name: true, avatar: true } } },
          },
        },
      },
    },
  })

  if (!profile || !profile.bioIsActive) return null

  const stats = {
    totalPosts: profile.user.posts.length,
    totalApproved: profile.totalApproved,
    trustLevel: profile.trustLevel,
    level: profile.level,
  }

  const avgRating = profile.user.editorRatingsReceived.length > 0
    ? profile.user.editorRatingsReceived.reduce((sum, r) => sum + r.rating, 0) / profile.user.editorRatingsReceived.length
    : 0

  // Build public profile based on visibility settings
  const publicProfile: any = {
    id: profile.userId, // Fix #6: expose userId so EditorProfileView can send editorId to ratings API
    slug: profile.bioSlug,
    name: profile.user.name,
    title: profile.bioTitle,
    level: profile.level,
    stats: profile.bioShowStats ? stats : null,
    rating: profile.bioShowRating ? {
      average: avgRating,
      count: profile.user.editorRatingsReceived.length,
      reviews: profile.user.editorRatingsReceived.slice(0, 5),
    } : null,
    recentPosts: profile.bioShowRecentPosts ? profile.user.posts : [],
  }

  if (profile.bioShowPhoto) publicProfile.avatar = profile.bioAvatar || profile.user.avatar
  if (profile.bioShowBio) publicProfile.bio = profile.user.bio
  if (profile.bioShowCategories) {
    if (profile.categoriesAllowed) {
      const cats = await db.category.findMany({
        where: { id: { in: safeJsonArray<string>(profile.categoriesAllowed) } },
      })
      publicProfile.categories = cats
    } else {
      publicProfile.categories = 'all'
    }
  }
  if (profile.bioShowSocial && profile.bioSocialLinks) {
    publicProfile.socialLinks = safeJsonArray<any>(profile.bioSocialLinks)
  }

  return publicProfile
}

// List all active editors (for /editores page)
export async function listActiveEditors() {
  const profiles = await db.editorProfile.findMany({
    where: { bioIsActive: true, bioSlug: { not: null } },
    include: {
      user: {
        select: {
          id: true, name: true, avatar: true, bio: true,
          _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
          editorRatingsReceived: { select: { rating: true } },
        },
      },
    },
    orderBy: { trustLevel: 'desc' },
  })

  return profiles.map(p => {
    const ratings = p.user.editorRatingsReceived
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0
    return {
      slug: p.bioSlug,
      name: p.user.name,
      avatar: p.bioShowPhoto ? (p.bioAvatar || p.user.avatar) : null,
      bio: p.bioShowBio ? p.user.bio : null,
      title: p.bioTitle,
      level: p.level,
      trustLevel: p.trustLevel,
      totalPosts: p.user._count.posts,
      avgRating,
      ratingsCount: ratings.length,
    }
  })
}

// REJECTION REASONS (categorized)
export const REJECTION_REASONS = [
  { value: 'INADEQUATE', label: 'Conteúdo inadequado' },
  { value: 'PLAGIARISM', label: 'Plágio / direitos autorais' },
  { value: 'FACTUAL_ERROR', label: 'Erro factual / informação incorreta' },
  { value: 'FORMAT', label: 'Problemas de formatação / ortografia' },
  { value: 'DUPLICATE', label: 'Notícia duplicada' },
  { value: 'OFF_TOPIC', label: 'Fora do tema do portal' },
  { value: 'SENSITIVE', label: 'Conteúdo sensível sem fontes' },
  { value: 'OTHER', label: 'Outro motivo' },
] as const

// PANEL SECTIONS for editor access control
export const PANEL_SECTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'posts', label: 'Gerenciar Notícias' },
  { value: 'editor', label: 'Editor de Notícia' },
  { value: 'ads', label: 'Anúncios' },
  { value: 'categories', label: 'Categorias' },
  { value: 'seo', label: 'SEO & Site' },
  { value: 'users', label: 'Usuários' },
  { value: 'classifieds', label: 'Classificados' },
] as const

// EDITOR LEVELS metadata
export const EDITOR_LEVELS = [
  { value: 'JUNIOR', label: 'Júnior', color: 'blue', minTrust: 0, description: 'Editor iniciante, todos os posts passam por revisão' },
  { value: 'PLENO', label: 'Pleno', color: 'emerald', minTrust: 25, description: 'Editor com histórico, confiança crescente' },
  { value: 'SENIOR', label: 'Sênior', color: 'amber', minTrust: 50, description: 'Editor experiente, pode ter aprovação automática' },
  { value: 'MASTER', label: 'Master', color: 'purple', minTrust: 80, description: 'Editor de alta confiança, sem necessidade de aprovação' },
] as const
