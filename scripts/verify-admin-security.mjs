import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const createdTokens = []
const createdUserIds = []

function assertStatus(name, actual, expected) {
  if (actual !== expected) throw new Error(`${name}: esperado HTTP ${expected}, recebido ${actual}`)
  console.log(`ok - ${name} (${actual})`)
}

async function request(path, role, init = {}) {
  const headers = new Headers(init.headers)
  if (role) headers.set('cookie', `portal_token=${createdTokens.find(item => item.role === role)?.token}`)
  return fetch(`${baseUrl}${path}`, { ...init, headers, redirect: 'manual' })
}

async function sessionFor(role) {
  let user = await db.user.findFirst({ where: { role }, select: { id: true } })
  if (!user) {
    const suffix = crypto.randomBytes(8).toString('hex')
    user = await db.user.create({
      data: { name: `Teste ${role}`, email: `security-${role.toLowerCase()}-${suffix}@invalid.local`, role },
      select: { id: true },
    })
    createdUserIds.push(user.id)
  }
  const token = `security-test-${crypto.randomBytes(24).toString('hex')}`
  await db.session.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 10 * 60_000) } })
  createdTokens.push({ role, token })
}

try {
  await Promise.all(['MASTER', 'ADMIN', 'EDITOR'].map(sessionFor))

  assertStatus('anÃ´nimo nÃ£o lista anÃºncios pendentes', (await request('/api/ads?status=PENDING')).status, 401)
  assertStatus('anÃ´nimo nÃ£o atualiza cotaÃ§Ãµes', (await request('/api/quotes/refresh', null, { method: 'POST' })).status, 401)
  assertStatus('anÃ´nimo nÃ£o abre painel administrativo', (await request('/admin')).status, 307)
  assertStatus('tracking falso Ã© rejeitado', (await request('/api/header-ads/serve', null, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ adId: 'fake', token: 'fake', action: 'click' }),
  })).status, 403)

  assertStatus('editor nÃ£o lista usuÃ¡rios', (await request('/api/users', 'EDITOR')).status, 403)
  assertStatus('admin abre o painel administrativo', (await request('/admin', 'ADMIN')).status, 200)
  assertStatus('admin acessa dashboard', (await request('/api/dashboard', 'ADMIN')).status, 200)
  assertStatus('admin gerencia anÃºncios', (await request('/api/ads?status=ALL', 'ADMIN')).status, 200)
  assertStatus('admin nÃ£o acessa gateways', (await request('/api/admin/gateways', 'ADMIN')).status, 403)
  assertStatus('admin nÃ£o acessa WordPress sensÃ­vel', (await request('/api/admin/wordpress', 'ADMIN')).status, 403)
  assertStatus('admin nÃ£o acessa auditoria', (await request('/api/admin/audit', 'ADMIN')).status, 403)

  assertStatus('master acessa gateways', (await request('/api/admin/gateways', 'MASTER')).status, 200)
  assertStatus('master acessa auditoria', (await request('/api/admin/audit', 'MASTER')).status, 200)
  console.log('Todos os contratos administrativos de seguranÃ§a foram validados.')
} finally {
  if (createdTokens.length) await db.session.deleteMany({ where: { token: { in: createdTokens.map(item => item.token) } } })
  if (createdUserIds.length) await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  await db.$disconnect()
}
