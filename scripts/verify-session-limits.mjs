import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const suffix = crypto.randomBytes(8).toString('hex')
const email = `session-limit-${suffix}@invalid.local`
const password = `Valid-${suffix}`
let userId = null

function passwordHash(value) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(value, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

try {
  const user = await db.user.create({
    data: { name: 'Teste Limite de Sessão', email, password: passwordHash(password), role: 'READER' },
  })
  userId = user.id

  let lastCookie = ''
  for (let index = 0; index < 12; index++) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `127.0.0.${index + 1}`,
      },
      body: JSON.stringify({ email, password }),
    })
    assert.equal(response.status, 200, `login ${index + 1} deve funcionar`)
    lastCookie = response.headers.get('set-cookie')?.split(';')[0] || ''
  }

  assert.equal(await db.session.count({ where: { userId: user.id } }), 10, 'usuário deve manter no máximo 10 sessões')

  const logoutAll = await fetch(`${baseUrl}/api/auth/logout-all`, {
    method: 'POST',
    headers: { cookie: lastCookie },
  })
  assert.equal(logoutAll.status, 200)
  assert.equal(await db.session.count({ where: { userId: user.id } }), 0, 'logout geral deve revogar todas as sessões')

  console.log('Session cap and global logout validation passed.')
} finally {
  if (userId) await db.user.deleteMany({ where: { id: userId } })
  await db.$disconnect()
}
