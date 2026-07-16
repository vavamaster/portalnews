import assert from 'node:assert/strict'

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'

async function request(path, init) {
  return fetch(`${baseUrl}${path}`, init)
}

const plansResponse = await request('/api/plans')
assert.equal(plansResponse.status, 200)
const plansData = await plansResponse.json()
assert.ok(Array.isArray(plansData.plans))
assert.ok(Array.isArray(plansData.gateways))
for (const plan of plansData.plans) {
  assert.equal('asaasPlanId' in plan, false)
  assert.equal('mercadoPagoPlanId' in plan, false)
  assert.equal('stripePriceId' in plan, false)
}
for (const gateway of plansData.gateways) {
  for (const secret of ['apiKey', 'secretKey', 'webhookSecret', 'accessToken', 'publicKey']) {
    assert.equal(secret in gateway, false)
  }
}

const invalidPrice = await request('/api/classifieds?minPrice=abc')
assert.equal(invalidPrice.status, 400)

const missingCategory = await request('/api/classifieds?category=__categoria_inexistente__')
assert.equal(missingCategory.status, 200)
assert.equal((await missingCategory.json()).total, 0)

const listingResponse = await request('/api/classifieds?limit=999')
assert.equal(listingResponse.status, 200)
const listingData = await listingResponse.json()
assert.equal(listingData.limit, 50)
for (const listing of listingData.listings || []) {
  assert.equal(listing.document, null)
  assert.equal('email' in (listing.owner || {}), false)
  assert.equal('asaasPlanId' in (listing.plan || {}), false)
  for (const media of [listing.logoUrl, ...JSON.parse(listing.photos || '[]')].filter(Boolean)) {
    assert.equal(String(media).startsWith('https://uploads/'), false)
  }
}

const anonymousCreate = await request('/api/classifieds', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({}),
})
assert.equal(anonymousCreate.status, 401)

const anonymousReview = await request('/api/reviews', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ listingId: 'x', rating: 5 }),
})
assert.equal(anonymousReview.status, 401)

console.log('Classifieds regression verification passed.')
