import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, destroyAllSessions, SESSION_COOKIE_NAME } from '@/lib/session'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await destroyAllSessions(user.id)
  const response = NextResponse.json({ ok: true })
  response.headers.set('set-cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  return response
}
