import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { generateReferralCode } from '@/lib/achievements'

// GET - returns user's referral code, stats, and how to use
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Faça login' }, { status: 401 })

  const url = new URL(req.url)
  const code = url.searchParams.get('code')

  // If code passed, return referrer info (for registration flow)
  if (code) {
    const referrer = await db.user.findUnique({ where: { referralCode: code.toUpperCase() } })
    if (!referrer) return NextResponse.json({ error: 'Código inválido' }, { status: 404 })
    return NextResponse.json({
      valid: true,
      referrer: { id: referrer.id, name: referrer.name, avatar: referrer.avatar },
    })
  }

  // Get user's referral data
  const u = await db.user.findUnique({
    where: { id: user.id },
    include: {
      referrals: { select: { id: true, name: true, avatar: true, createdAt: true, referralBonusAwarded: true } },
      referredBy: { select: { id: true, name: true, referralCode: true } },
    },
  })
  if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    referralCode: u.referralCode,
    referralsCount: u.referrals.length,
    referrals: u.referrals,
    referredBy: u.referredBy,
    bonusPerReferral: 50,
  })
}

// POST - generate/regenerate referral code (if not exists)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Faça login' }, { status: 401 })

  const u = await db.user.findUnique({ where: { id: user.id } })
  if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (u.referralCode) {
    return NextResponse.json({ referralCode: u.referralCode, alreadyExists: true })
  }

  const code = generateReferralCode(u.name)
  await db.user.update({ where: { id: user.id }, data: { referralCode: code } })

  return NextResponse.json({ referralCode: code, alreadyExists: false })
}
