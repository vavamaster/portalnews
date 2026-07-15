import { db } from '@/lib/db'

export interface LicenseStatus {
  hasKey: boolean
  key: string
  raw: string
  valid: boolean
  status: string
  message: string
  data: Record<string, unknown> | null
  checkedAt: string | null
  stale: boolean
}

export type PublicLicenseStatus = Omit<LicenseStatus, 'key' | 'raw' | 'data'>

const TTL_VALID = 60 * 1000
const TTL_INVALID = 5 * 60 * 1000

const BLOCKING_STATUSES = new Set([
  'expired',
  'suspended',
  'unauthorized_domain',
  'invalid',
  'invalid_format',
  'mismatch',
  'no_key',
  'not_validated',
  'api_unreachable',
])

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const [keyRow, cacheRow] = await Promise.all([
    db.seoSetting.findUnique({ where: { key: 'license_key' } }),
    db.seoSetting.findUnique({ where: { key: 'license_status_cache' } }),
  ])

  const licenseKey = keyRow?.value || ''
  let cache: Record<string, unknown> | null = null
  if (cacheRow?.value) {
    try {
      cache = JSON.parse(cacheRow.value) as Record<string, unknown>
    } catch {
      cache = null
    }
  }

  const status = typeof cache?.status === 'string'
    ? cache.status.toLowerCase()
    : (licenseKey ? 'not_validated' : 'no_key')
  const checkedAt = typeof cache?.checkedAt === 'string' ? cache.checkedAt : null
  const cacheValid = cache?.valid === true
  const valid = Boolean(licenseKey) && cacheValid && !BLOCKING_STATUSES.has(status)

  let stale = Boolean(licenseKey && !checkedAt)
  if (checkedAt) {
    const checkedAtMs = new Date(checkedAt).getTime()
    stale = !Number.isFinite(checkedAtMs)
      || Date.now() - checkedAtMs > (valid ? TTL_VALID : TTL_INVALID)
  }

  return {
    hasKey: Boolean(licenseKey),
    key: maskLicenseKey(licenseKey),
    raw: licenseKey,
    valid,
    status,
    message: typeof cache?.message === 'string'
      ? cache.message
      : (licenseKey ? 'Chave configurada, mas ainda não validada.' : 'Nenhuma chave configurada.'),
    data: isRecord(cache?.data) ? cache.data : null,
    checkedAt,
    stale,
  }
}

export function getPublicLicenseStatus(status: LicenseStatus): PublicLicenseStatus {
  return {
    hasKey: status.hasKey,
    valid: status.valid,
    status: status.status,
    message: status.message,
    checkedAt: status.checkedAt,
    stale: status.stale,
  }
}

function maskLicenseKey(key: string): string {
  if (!key) return ''
  const parts = key.split('-')
  if (parts.length !== 4) return '••••••••'
  return `${parts[0]}-${parts[1]}-••••-${parts[3]}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
