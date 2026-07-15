import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000'
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const emails = [
  `session-http-${suffix}@example.test`,
  `session-https-${suffix}@example.test`,
]

async function register(email, headers = {}) {
  return fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({
      name: 'Teste de sessão',
      email,
      password: 'SessionTest123!',
    }),
  })
}

try {
  const httpResponse = await register(emails[0])
  assert.equal(httpResponse.status, 200, await httpResponse.text())
  const httpCookie = httpResponse.headers.get('set-cookie') || ''
  assert.match(httpCookie, /^portal_token=[^;]+;/)
  assert.match(httpCookie, /; HttpOnly;/i)
  assert.match(httpCookie, /; SameSite=Lax;/i)
  assert.doesNotMatch(httpCookie, /; Secure(?:;|$)/i)

  const token = httpCookie.match(/^portal_token=([^;]+)/)?.[1]
  assert.ok(token, 'Cookie de sessão não retornou um token')

  const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: `portal_token=${token}` },
  })
  assert.equal(meResponse.status, 200)
  const me = await meResponse.json()
  assert.equal(me.user?.email, emails[0])

  const httpsResponse = await register(emails[1], { 'x-forwarded-proto': 'https' })
  assert.equal(httpsResponse.status, 200, await httpsResponse.text())
  const httpsCookie = httpsResponse.headers.get('set-cookie') || ''
  assert.match(httpsCookie, /; Secure(?:;|$)/i)

  console.log('Session cookie verification passed for HTTP and HTTPS.')
} finally {
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
}
