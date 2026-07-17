import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { isSecureRequest } from '@/lib/session'
import { consumeRequestLimit } from '@/lib/request-rate-limit'
import {
  getClientIp,
  resolveGeoData,
  parseUserAgent,
  parseReferrer,
  classifyPath,
} from '@/lib/analytics'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { path, referrer, statusCode, responseTimeMs } = body

    if (!path || typeof path !== 'string' || !path.startsWith('/') || path.length > 500) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const rateLimit = await consumeRequestLimit(req, {
      scope: 'analytics-track', subject: 'pageview', limit: 300, windowSeconds: 5 * 60,
    })
    if (!rateLimit.allowed) {
      // Tracking must not trigger client retries or affect portal navigation.
      return NextResponse.json({ ok: true, dropped: true }, { status: 202 })
    }

    const sessionId = req.cookies.get('analytics_sid')?.value || generateId()
    const visitorId = req.cookies.get('analytics_vid')?.value || generateId()

    const ip = getClientIp(req)
    const geo = await resolveGeoData(req, ip)

    const ua = req.headers.get('user-agent')
    const device = parseUserAgent(ua)

    const currentHost = req.headers.get('host')
    const ref = parseReferrer(referrer || req.headers.get('referer'), currentHost)

    const { pathType, refSlug } = classifyPath(path)
    const uaTruncated = ua ? ua.substring(0, 500) : null

    await db.pageView.create({
      data: {
        sessionId,
        visitorId,
        path: path.substring(0, 500),
        pathType,
        refSlug: refSlug?.substring(0, 200) || null,
        ipHash: geo.ipHash,
        country: geo.country,
        countryCode: geo.countryCode,
        region: geo.region,
        regionCode: geo.regionCode,
        city: geo.city,
        latitude: geo.latitude,
        longitude: geo.longitude,
        isp: geo.isp,
        userAgent: uaTruncated,
        device: device.device,
        os: device.os,
        browser: device.browser,
        referrer: referrer ? String(referrer).substring(0, 500) : null,
        referrerDomain: ref.referrerDomain,
        referrerType: ref.referrerType,
        statusCode: typeof statusCode === 'number' ? statusCode : 200,
        responseTimeMs: typeof responseTimeMs === 'number' ? responseTimeMs : null,
      },
    }).catch((e) => {
      console.error('[Analytics] track insert failed:', e.message)
    })

    const response = NextResponse.json({ ok: true })
    if (!req.cookies.get('analytics_sid')) {
      response.cookies.set('analytics_sid', sessionId, {
        httpOnly: true,
        secure: isSecureRequest(req),
        sameSite: 'lax',
        maxAge: 30 * 60,
        path: '/',
      })
    }
    if (!req.cookies.get('analytics_vid')) {
      response.cookies.set('analytics_vid', visitorId, {
        httpOnly: true,
        secure: isSecureRequest(req),
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
      })
    }
    return response
  } catch (e: any) {
    console.error('[Analytics] track error:', e.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}${crypto.randomBytes(12).toString('base64url')}`
}
