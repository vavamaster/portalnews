import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ user: null })

  // Check if user has Enterprise access (linked as a company)
  const enterpriseLink = await db.enterpriseUserLink.findUnique({
    where: { userId: user.id },
    select: { companyName: true, isActive: true },
  })

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      points: user.points,
      credits: user.credits,
      bio: user.bio,
      lastCheckInAt: user.lastCheckInAt,
      checkInStreak: user.checkInStreak,
      verificationStatus: user.verificationStatus,
      verificationType: user.verificationType,
      referralCode: user.referralCode,
      referredById: user.referredById,
      hasEnterpriseAccess: Boolean(enterpriseLink?.isActive),
      enterpriseCompanyName: enterpriseLink?.companyName || null,
    },
  })
}
