import { db } from '../src/lib/db'
import {
  encodeCredentialJson,
  encryptSecret,
  isEncryptedSecret,
} from '../src/lib/secret-storage'

let aiUpdated = 0
let socialUpdated = 0
let gatewayUpdated = 0

async function main() {
try {
  const aiConfigs = await db.aIConfig.findMany({ where: { apiKey: { not: null } } })
  for (const config of aiConfigs) {
    if (!config.apiKey || isEncryptedSecret(config.apiKey)) continue
    await db.aIConfig.update({
      where: { id: config.id },
      data: { apiKey: encryptSecret(config.apiKey, `ai:${config.provider}`) },
    })
    aiUpdated++
  }

  const socialConfigs = await db.socialConfig.findMany()
  for (const config of socialConfigs) {
    const parsed = JSON.parse(config.credentials || '{}') as Record<string, unknown>
    const protectedValue = encodeCredentialJson(parsed, `social:${config.provider}`)
    if (protectedValue === config.credentials) continue
    await db.socialConfig.update({ where: { id: config.id }, data: { credentials: protectedValue } })
    socialUpdated++
  }

  for (const provider of ['ASAAS', 'MERCADO_PAGO', 'STRIPE'] as const) {
    const key = `gateway_${provider.toLowerCase()}`
    const setting = await db.seoSetting.findUnique({ where: { key } })
    if (!setting || isEncryptedSecret(setting.value)) continue
    await db.seoSetting.update({
      where: { key },
      data: { value: encryptSecret(setting.value, `gateway:${provider}`) },
    })
    gatewayUpdated++
  }

  console.log(JSON.stringify({ aiUpdated, socialUpdated, gatewayUpdated }))
} finally {
  await db.$disconnect()
}
}

main().catch(error => {
  console.error('[protect-secrets] Falha:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
