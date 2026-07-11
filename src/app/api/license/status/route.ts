import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/license/status
// Returns the cached license status (and the configured key, masked).
// If the cache is stale (older than TTL), the cache.valid flag is still returned
// but a `stale: true` flag is included so the client knows it should call /validate.
//
// Cache TTL: 1 minute if valid, 5 minutes if invalid.

const TTL_VALID = 60 * 1000       // 1 minute
const TTL_INVALID = 5 * 60 * 1000 // 5 minutes

export async function GET(req: NextRequest) {
  try {
    const [keyRow, cacheRow] = await Promise.all([
      db.seoSetting.findUnique({ where: { key: 'license_key' } }),
      db.seoSetting.findUnique({ where: { key: 'license_status_cache' } }),
    ])

    const licenseKey = keyRow?.value || ''
    let cache: any = null
    if (cacheRow?.value) {
      try { cache = JSON.parse(cacheRow.value) } catch {}
    }

    // Compute staleness
    let stale = false
    if (cache?.checkedAt) {
      const age = Date.now() - new Date(cache.checkedAt).getTime()
      const ttl = cache.valid ? TTL_VALID : TTL_INVALID
      stale = age > ttl
    } else if (licenseKey) {
      // We have a key but no cache — definitely stale (needs first validation)
      stale = true
    }

    // Mask the license key for display: VS-ABCD-EFGH-1234 → VS-ABCD-••••-1234
    const maskedKey = maskKey(licenseKey)

    return NextResponse.json({
      hasKey: Boolean(licenseKey),
      key: maskedKey,
      raw: licenseKey,
      valid: Boolean(cache?.valid),
      status: cache?.status || (licenseKey ? 'not_validated' : 'no_key'),
      message: cache?.message || (licenseKey ? 'Chave configurada mas ainda não validada.' : 'Nenhuma chave configurada.'),
      data: cache?.data || null,
      checkedAt: cache?.checkedAt || null,
      stale,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function maskKey(key: string): string {
  if (!key) return ''
  // VS-ABCD-EFGH-1234 → VS-ABCD-••••-1234
  const parts = key.split('-')
  if (parts.length !== 4) return key
  return `${parts[0]}-${parts[1]}-••••-${parts[3]}`
}
