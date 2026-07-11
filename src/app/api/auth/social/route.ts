import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, setSessionCookie } from '@/lib/session'

// Mock social login - in production this would do real OAuth with Google/Facebook
export async function POST(req: NextRequest) {
  try {
    const { provider, name, email, providerId, avatar } = await req.json()
    if (!provider || !email || !name) {
      return NextResponse.json({ error: 'Dados insuficientes para login social' }, { status: 400 })
    }
    const providerKey = `${provider}:${providerId || email}`

    // Try to find existing user with this social account
    const users = await db.user.findMany({ where: { email: email.toLowerCase() } })
    let user = users[0]

    if (!user) {
      // Create new social user
      user = await db.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          role: 'READER',
          avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=2563eb&textColor=fff`,
          socialAccounts: JSON.stringify([{ provider, id: providerId || email }]),
        },
      })
    } else {
      // Merge social account into existing
      const socials = user.socialAccounts ? JSON.parse(user.socialAccounts) : []
      if (!socials.find((s: any) => s.provider === provider && s.id === (providerId || email))) {
        socials.push({ provider, id: providerId || email })
        await db.user.update({
          where: { id: user.id },
          data: { socialAccounts: JSON.stringify(socials) },
        })
      }
    }

    const token = await createSession(user.id)
    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        points: user.points,
        credits: user.credits,
      },
      providerKey,
    })
    res.headers.set('set-cookie', setSessionCookie(token))
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
