import { NextRequest, NextResponse } from 'next/server'
import { loadSeoSettings, getSiteUrlForUserAgent, getContactEmail } from '@/lib/seo-helpers'

// GET /api/geocode?address=...&city=...&state=...&zipCode=...
// Uses free Nominatim OpenStreetMap API (rate limited 1 req/sec - ok for our use case).
// The User-Agent identifies the portal using the admin-configured site URL + contact email.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const address = url.searchParams.get('address') || ''
    const city = url.searchParams.get('city') || ''
    const state = url.searchParams.get('state') || ''
    const zipCode = url.searchParams.get('zipCode') || ''

    const q = [address, city, state, zipCode, 'Brasil'].filter(Boolean).join(', ')
    if (!q) return NextResponse.json({ error: 'Endereço necessário' }, { status: 400 })

    // Build a polite User-Agent using the admin-configured site URL + contact email.
    const settings = await loadSeoSettings()
    const uaToken = getSiteUrlForUserAgent(settings)
    const contactEmail = getContactEmail(settings)
    const userAgent = `${uaToken} (${contactEmail})`

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
    const res = await fetch(nominatimUrl, {
      headers: { 'User-Agent': userAgent },
    })
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Endereço não encontrado' }, { status: 404 })
    }
    const result = data[0]
    return NextResponse.json({
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      displayName: result.display_name,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
