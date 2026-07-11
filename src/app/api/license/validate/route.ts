import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// VS Agencia license validation API.
// POST /api/license/validate
// Body: { key?: "VS-XXXX-XXXX-XXXX" }  (if omitted, uses the key stored in DB)
// Returns: { valid, status, message, data: { client_id, product, plan, expires_at, ... } }
//
// The validation result is cached in SeoSetting.license_status_cache as JSON
// with a TTL: 1 minute if valid, 5 minutes if invalid (so the portal recovers
// quickly when the license is reactivated).

const VS_AGENCIA_API = 'https://vsagencia.net/api/v1/validate_license.php'

interface LicenseCache {
  valid: boolean
  status: string
  message: string
  data?: {
    client_id?: number
    product?: string
    plan?: string
    max_users?: number
    is_trial?: boolean
    trial_ends_at?: string | null
    expires_at?: string
    domain?: string
  } | null
  checkedAt: string
  httpCode?: number
}

export async function POST(req: NextRequest) {
  try {
    // Only admins can validate / re-validate the license
    const user = await getCurrentUser(req)
    if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    let licenseKey = (body.key || '').trim().toUpperCase()

    // If no key in body, use the one stored in DB
    if (!licenseKey) {
      const stored = await db.seoSetting.findUnique({ where: { key: 'license_key' } })
      licenseKey = (stored?.value || '').trim().toUpperCase()
    }

    if (!licenseKey) {
      return NextResponse.json({
        valid: false,
        status: 'no_key',
        message: 'Nenhuma chave de licença configurada.',
      })
    }

    // Normalize: ensure VS- prefix and 4-4-4 grouping
    const normalizedKey = normalizeKey(licenseKey)
    if (!normalizedKey) {
      return NextResponse.json({
        valid: false,
        status: 'invalid_format',
        message: 'Formato de chave inválido. Use: VS-XXXX-XXXX-XXXX',
      }, { status: 400 })
    }

    // Persist the key
    await db.seoSetting.upsert({
      where: { key: 'license_key' },
      update: { value: normalizedKey },
      create: { key: 'license_key', value: normalizedKey },
    })

    // Determine the authorized domain (admin-configured site_url, fallback to request host)
    let domain = ''
    try {
      const siteUrlSetting = await db.seoSetting.findUnique({ where: { key: 'site_url' } })
      if (siteUrlSetting?.value) {
        domain = new URL(siteUrlSetting.value).hostname
      } else {
        domain = req.headers.get('host') || ''
      }
    } catch {
      domain = req.headers.get('host') || ''
    }

    // Call VS Agencia API (GET with query string — this is what the API expects)
    const apiUrl = `${VS_AGENCIA_API}?key=${encodeURIComponent(normalizedKey)}&domain=${encodeURIComponent(domain)}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    let vsRes: Response
    try {
      vsRes = await fetch(apiUrl, {
        method: 'GET',
        signal: controller.signal,
      })
    } catch (e: any) {
      clearTimeout(timeout)
      const cache: LicenseCache = {
        valid: false,
        status: 'api_unreachable',
        message: 'Não foi possível contatar o servidor de licenças. Tente novamente.',
        data: null,
        checkedAt: new Date().toISOString(),
      }
      await saveCache(cache)
      return NextResponse.json(cache, { status: 502 })
    }
    clearTimeout(timeout)

    const httpCode = vsRes.status
    let vsData: any
    try {
      vsData = await vsRes.json()
    } catch {
      vsData = { valid: false, message: 'Resposta inválida do servidor de licenças.' }
    }

    // Normalize the response — VS Agencia returns { valid, status, message, data }
    const valid = Boolean(vsData.valid || vsData.success)
    const status = vsData.status || (valid ? 'valid' : 'invalid')
    const message = vsData.message || (valid ? 'Licença válida e ativa.' : 'Licença inválida.')

    const cache: LicenseCache = {
      valid,
      status,
      message,
      data: vsData.data || null,
      checkedAt: new Date().toISOString(),
      httpCode,
    }

    await saveCache(cache)

    return NextResponse.json(cache)
  } catch (e: any) {
    console.error('[License] Validate error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Normalize a license key to "VS-XXXX-XXXX-XXXX" format.
// Accepts: VSXXXX-XXXX-XXXX, VS-XXXX-XXXX-XXXX, vs xxxx xxxx xxxx, etc.
function normalizeKey(raw: string): string | null {
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (!clean.startsWith('VS')) return null
  const rest = clean.slice(2)
  if (!/^[A-Z0-9]{12}$/.test(rest)) return null
  const groups = [rest.slice(0, 4), rest.slice(4, 8), rest.slice(8, 12)]
  return `VS-${groups.join('-')}`
}

async function saveCache(cache: LicenseCache) {
  await db.seoSetting.upsert({
    where: { key: 'license_status_cache' },
    update: { value: JSON.stringify(cache) },
    create: { key: 'license_status_cache', value: JSON.stringify(cache) },
  })
}
