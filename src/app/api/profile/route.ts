import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { handleApiError } from '@/lib/api-helpers'

// PUT /api/profile - user updates own profile (name, bio, avatar only)
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()

    // Only allow specific fields to be updated by the user themselves
    const allowedFields = ['name', 'bio', 'avatar']
    const update: any = {}
    for (const f of allowedFields) {
      if (body[f] !== undefined) {
        update[f] = body[f]
      }
    }

    // Validate name
    if (update.name !== undefined && (!update.name || update.name.trim().length < 2)) {
      return NextResponse.json({ error: 'Nome deve ter pelo menos 2 caracteres' }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: update,
      select: {
        id: true, email: true, name: true, role: true, avatar: true,
        points: true, credits: true, bio: true,
        lastCheckInAt: true, checkInStreak: true,
        verificationStatus: true, referralCode: true,
      },
    })

    return NextResponse.json({ user: updated })
  } catch (e: any) {
    return handleApiError(e, 'profile update')
  }
}
