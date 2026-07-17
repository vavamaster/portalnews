import crypto from 'crypto'
import { getSecuritySecret } from './security-secret'

const PREFIX = 'enc:v1:'

function encryptionKey(context: string) {
  return crypto.createHash('sha256')
    .update(`${getSecuritySecret('CREDENTIAL_ENCRYPTION_SECRET')}:${context}`)
    .digest()
}

export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptSecret(value: string, context: string) {
  if (!value || isEncryptedSecret(value)) return value
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(context), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`
}

export function decryptSecret(value: string | null | undefined, context: string) {
  if (!value || !isEncryptedSecret(value)) return value || ''
  const parts = value.slice(PREFIX.length).split(':')
  if (parts.length !== 3) throw new Error('Credencial criptografada inválida.')
  const [ivRaw, tagRaw, encryptedRaw] = parts
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(context), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function isCredentialSecretField(key: string) {
  return /(token|secret|password|apiKey)/i.test(key)
}

export function decodeCredentialJson(raw: string | null | undefined, namespace: string) {
  const parsed = JSON.parse(raw || '{}') as Record<string, unknown>
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [
    key,
    isCredentialSecretField(key) && typeof value === 'string'
      ? decryptSecret(value, `${namespace}:${key}`)
      : value,
  ]))
}

export function encodeCredentialJson(credentials: Record<string, unknown>, namespace: string) {
  return JSON.stringify(Object.fromEntries(Object.entries(credentials).map(([key, value]) => [
    key,
    isCredentialSecretField(key) && typeof value === 'string' && value
      ? encryptSecret(value, `${namespace}:${key}`)
      : value,
  ])))
}
