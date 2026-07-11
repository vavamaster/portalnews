import { NextRequest, NextResponse } from 'next/server'
import { destroySession, SESSION_COOKIE_NAME } from '@/lib/session'

export async function POST(req: NextRequest) {
  await destroySession(req)
  const res = NextResponse.json({ ok: true })
  res.headers.set('set-cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  return res
}
