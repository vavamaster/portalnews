import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const suffix = crypto.randomBytes(8).toString('hex')
let categoryId = null
let userId = null
const receiptKeys = []

async function postMetric(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

try {
  const user = await db.user.create({
    data: { name: 'Teste Enterprise Tracking', email: `enterprise-tracking-${suffix}@invalid.local` },
  })
  userId = user.id

  const category = await db.category.create({
    data: { name: `Categoria Tracking ${suffix}`, slug: `tracking-${suffix}` },
  })
  categoryId = category.id

  const sponsored = await db.sponsoredCategory.create({
    data: { categoryId: category.id, mode: 'ROTATING', isActive: true },
  })
  await db.enterpriseUserLink.create({
    data: { userId: user.id, companyName: 'Empresa de Teste', isActive: true },
  })
  await db.enterpriseBillingCycle.create({
    data: {
      sponsoredCategoryId: sponsored.id,
      userId: user.id,
      type: 'MONTHLY',
      valueCents: 100,
      startAt: new Date(Date.now() - 60_000),
      endAt: new Date(Date.now() + 60 * 60_000),
      status: 'ACTIVE',
    },
  })
  const ad = await db.enterpriseAd.create({
    data: {
      sponsoredCategoryId: sponsored.id,
      ownerId: user.id,
      title: 'Criativo protegido',
      linkUrl: '/contato',
      status: 'ACTIVE',
    },
  })

  const serveResponse = await fetch(`${baseUrl}/api/sponsored-categories/serve?categoryId=${encodeURIComponent(category.id)}`)
  assert.equal(serveResponse.status, 200)
  const served = await serveResponse.json()
  assert.equal(served.sponsored, true)
  assert.equal(served.ads?.[0]?.id, ad.id)
  assert.equal(typeof served.ads?.[0]?.trackingToken, 'string')
  const token = served.ads[0].trackingToken
  receiptKeys.push(
    crypto.createHash('sha256').update(`${token}:impression`).digest('hex'),
    crypto.createHash('sha256').update(`${token}:click`).digest('hex'),
  )

  const missingToken = await postMetric('/api/sponsored-categories/impression', { adId: ad.id })
  assert.equal(missingToken.status, 403, 'impressão sem token deve ser rejeitada')
  assert.equal((await db.enterpriseAd.findUniqueOrThrow({ where: { id: ad.id } })).impressions, 0)

  const tamperedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`
  const tampered = await postMetric('/api/sponsored-categories/impression', { adId: ad.id, token: tamperedToken })
  assert.equal(tampered.status, 403, 'token adulterado deve ser rejeitado')

  const impression = await postMetric('/api/sponsored-categories/impression', { adId: ad.id, token })
  assert.equal(impression.status, 200, 'token válido deve registrar impressão')
  assert.equal((await db.enterpriseAd.findUniqueOrThrow({ where: { id: ad.id } })).impressions, 1)

  const replayImpression = await postMetric('/api/sponsored-categories/impression', { adId: ad.id, token })
  assert.equal(replayImpression.status, 403, 'a mesma impressão não pode ser repetida')
  assert.equal((await db.enterpriseAd.findUniqueOrThrow({ where: { id: ad.id } })).impressions, 1)

  const click = await postMetric('/api/sponsored-categories/click', { adId: ad.id, token })
  assert.equal(click.status, 200, 'o token servido deve permitir um clique')
  assert.equal((await db.enterpriseAd.findUniqueOrThrow({ where: { id: ad.id } })).clicks, 1)

  const replayClick = await postMetric('/api/sponsored-categories/click', { adId: ad.id, token })
  assert.equal(replayClick.status, 403, 'o mesmo clique não pode ser repetido')
  assert.equal((await db.enterpriseAd.findUniqueOrThrow({ where: { id: ad.id } })).clicks, 1)

  console.log('Enterprise ad tracking token validation passed.')
} finally {
  if (receiptKeys.length) await db.adTrackingReceipt.deleteMany({ where: { key: { in: receiptKeys } } })
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } })
  if (userId) await db.user.deleteMany({ where: { id: userId } })
  await db.$disconnect()
}
