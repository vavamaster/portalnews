import assert from 'node:assert/strict'

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'

const crossSite = await fetch(`${baseUrl}/api/seo`, {
  method: 'PUT',
  headers: {
    'content-type': 'application/json',
    origin: 'https://attacker.invalid',
    'sec-fetch-site': 'cross-site',
  },
  body: '{}',
})
assert.equal(crossSite.status, 403, 'mutação cross-site deve ser bloqueada antes da autenticação')

const sameOrigin = await fetch(`${baseUrl}/api/seo`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json', origin: baseUrl },
  body: '{}',
})
assert.equal(sameOrigin.status, 401, 'mutação same-origin deve chegar à autenticação normal')

const serverToServer = await fetch(`${baseUrl}/api/seo`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: '{}',
})
assert.equal(serverToServer.status, 401, 'cliente sem Origin deve continuar disponível para integrações autenticadas')

console.log('Cross-site mutation protection passed.')
