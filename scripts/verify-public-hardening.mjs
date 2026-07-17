import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(path.resolve('.env')) } catch {}
}

const db = new PrismaClient()
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const suffix = crypto.randomBytes(8).toString('hex')
const newsletterEmail = `rate-limit-${suffix}@invalid.local`
const newsletterIp = '198.51.100.41'
const classifiedIp = '198.51.100.42'

function limitKey(scope, ip, subject) {
  const secret = process.env.AUTH_THROTTLE_SECRET
    || process.env.APP_SECURITY_SECRET
  assert.ok(secret, 'AUTH_THROTTLE_SECRET ou APP_SECURITY_SECRET deve estar configurado')
  return crypto.createHmac('sha256', secret).update(`${scope}:${ip}:${subject}`).digest('hex')
}

const throttleKeys = [
  limitKey('newsletter-ip', newsletterIp, 'subscribe'),
  limitKey('newsletter-email', '', newsletterEmail),
  limitKey('classified-contact-guest', classifiedIp, 'lead'),
]

async function post(pathname, ip, body) {
  return fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

try {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await post('/api/newsletter', newsletterIp, { email: newsletterEmail, source: 'security-test' })
    assert.equal(response.status, attempt <= 3 ? 200 : 429, `newsletter tentativa ${attempt}`)
  }

  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await post('/api/classifieds/nao-existe/contact', classifiedIp, {
      senderName: 'Teste de limite', message: 'Mensagem válida para testar o limitador.', channel: 'PANEL',
    })
    assert.equal(response.status, attempt <= 3 ? 404 : 429, `classificado tentativa ${attempt}`)
  }

  const cronRoutes = [
    'src/app/api/cron/auto-news/route.ts',
    'src/app/api/cron/ai-autonews/route.ts',
    'src/app/api/cron/enterprise-check/route.ts',
    'src/app/api/cron/renew-subscriptions/route.ts',
    'src/app/api/cron/whatsapp-campaigns/route.ts',
  ]
  for (const route of cronRoutes) {
    const source = await fs.readFile(path.resolve(route), 'utf8')
    assert.equal(source.includes("searchParams.get('key')"), false, `${route} não deve aceitar segredo na URL`)
    assert.equal(source.includes('requireCronBearer'), true, `${route} deve usar autenticação compartilhada`)
  }

  console.log('Public route rate limits and header-only cron authentication passed.')
} finally {
  await db.newsletterSubscriber.deleteMany({ where: { email: newsletterEmail } })
  await db.loginThrottle.deleteMany({ where: { key: { in: throttleKeys } } })
  await db.$disconnect()
}
