import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { getSeoSettings, setSeoSettings } from '@/lib/seo'
import { safeReqJson } from '@/lib/api-helpers'
import { isColorSettingKey, isValidThemeColor } from '@/lib/theme-config'
import { isValidSiteUrl } from '@/lib/seo-urls'

export async function GET() {
  const settings = await getSeoSettings()
  return NextResponse.json(
    { settings: getPublicSeoSettings(settings) },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  )
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const body = await safeReqJson<{ settings?: any }>(req)
  if (!body.ok) return body.response
  const { settings } = body.data
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return NextResponse.json({ error: 'Settings inválidas' }, { status: 400 })
  }
  const normalized: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(settings)) {
    if (!['string', 'number', 'boolean'].includes(typeof rawValue)) {
      return NextResponse.json({ error: `Valor inválido para ${key}` }, { status: 400 })
    }
    const value = String(rawValue).trim()
    if (isColorSettingKey(key) && !isValidThemeColor(value, key.startsWith('header_theme_'))) {
      return NextResponse.json({ error: `Cor inválida em ${key}. Use formato hexadecimal, por exemplo #2563eb.` }, { status: 400 })
    }
    normalized[key] = value
  }

  if (normalized.site_url && !isValidSiteUrl(normalized.site_url)) {
    return NextResponse.json({ error: 'URL do site inválida. Informe uma URL completa iniciando com http:// ou https://.' }, { status: 400 })
  }

  // nav_bg_color is the canonical key. Persist the legacy alias as well so
  // older admin forms cannot override it with a stale value.
  const navBg = normalized.nav_bg_color || normalized.header_theme_nav_bg_color
  if (navBg) {
    normalized.nav_bg_color = navBg
    normalized.header_theme_nav_bg_color = navBg
  }

  await setSeoSettings(normalized)
  return NextResponse.json({ ok: true, settings: getPublicSeoSettings(await getSeoSettings()) })
}

function getPublicSeoSettings(settings: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => {
      const normalizedKey = key.toLowerCase()
      return !normalizedKey.startsWith('gateway_')
        && normalizedKey !== 'license_key'
        && normalizedKey !== 'license_status_cache'
        && !normalizedKey.endsWith('_secret')
        && !normalizedKey.endsWith('_token')
        && !normalizedKey.endsWith('_api_key')
    }),
  )
}
