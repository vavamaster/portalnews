import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { db } from '../src/lib/db'
import { getAllGateways } from '../src/lib/payment-gateway'
import {
  decodeCredentialJson,
  decryptSecret,
  encodeCredentialJson,
  encryptSecret,
  isEncryptedSecret,
} from '../src/lib/secret-storage'

async function main() {
  const plain = crypto.randomBytes(32).toString('base64url')
  const encrypted = encryptSecret(plain, 'verification')
  assert.equal(isEncryptedSecret(encrypted), true)
  assert.equal(encrypted.includes(plain), false)
  assert.equal(decryptSecret(encrypted, 'verification'), plain)

  const credentialJson = encodeCredentialJson({ clientId: 'public-id', clientSecret: plain }, 'social:TEST')
  assert.equal(credentialJson.includes(plain), false)
  assert.deepEqual(decodeCredentialJson(credentialJson, 'social:TEST'), {
    clientId: 'public-id',
    clientSecret: plain,
  })

  const gatewayRows = await db.seoSetting.findMany({ where: { key: { startsWith: 'gateway_' } } })
  assert.equal(gatewayRows.every(row => isEncryptedSecret(row.value)), true)
  assert.equal((await getAllGateways()).length, 3)
  console.log('Encrypted credential storage passed.')
}

main().finally(() => db.$disconnect())
