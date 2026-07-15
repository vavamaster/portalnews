import { db } from './db'
import { generateToken, getSessionFromRequest, SESSION_COOKIE_NAME } from './auth'

export { SESSION_COOKIE_NAME }

export async function getCurrentUser(req: Request) {
  const token = await getSessionFromRequest(req)
  if (!token) return null
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  return session.user
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  await db.session.create({
    data: { userId, token, expiresAt },
  })
  await db.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  })
  return token
}

export async function destroySession(req: Request) {
  const token = await getSessionFromRequest(req)
  if (!token) return
  await db.session.deleteMany({ where: { token } }).catch(() => {})
}

export async function requireUser(req: Request) {
  const user = await getCurrentUser(req)
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

export async function requireAdmin(req: Request) {
  const user = await requireUser(req)
  if (!['MASTER', 'ADMIN'].includes(user.role)) throw new Error('FORBIDDEN')
  return user
}

export async function requireEditor(req: Request) {
  const user = await requireUser(req)
  if (!['MASTER', 'ADMIN', 'EDITOR'].includes(user.role)) throw new Error('FORBIDDEN')
  return user
}

function isSecureRequest(req: Request): boolean {
  const forwardedProtocol = req.headers.get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase()

  if (forwardedProtocol === 'https') return true
  if (forwardedProtocol === 'http') return false

  try {
    return new URL(req.url).protocol === 'https:'
  } catch {
    return false
  }
}

export function setSessionCookie(token: string, req: Request): string {
  const secure = isSecureRequest(req) ? '; Secure' : ''
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${secure}`
}
