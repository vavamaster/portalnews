import crypto from 'crypto'

// Simple hash (no external deps). Good enough for demo.
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [salt, hash] = (stored || '').split(':')
    if (!salt || !hash) return false
    const newHash = crypto.scryptSync(password, salt, 64).toString('hex')
    const hashBuf = Buffer.from(hash, 'hex')
    const newHashBuf = Buffer.from(newHash, 'hex')
    // Buffers must have the same length for timingSafeEqual
    if (hashBuf.length !== newHashBuf.length || hashBuf.length === 0) return false
    return crypto.timingSafeEqual(hashBuf, newHashBuf)
  } catch {
    return false
  }
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Cookie name — generic so the portal is brand-agnostic.
const SESSION_COOKIE_NAME = 'portal_token'

export async function getSessionFromRequest(req: Request) {
  // Try Authorization header first, then cookie
  const authHeader = req.headers.get('authorization')
  let token: string | null = null
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }
  if (!token) {
    const cookie = req.headers.get('cookie') || ''
    const cookieRegex = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)
    const match = cookie.match(cookieRegex)
    if (match) {
      token = match[1]
    }
  }
  if (!token) return null
  return token
}

export { SESSION_COOKIE_NAME }
