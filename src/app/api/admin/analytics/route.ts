import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminOrRespond, handleApiError } from '@/lib/api-helpers'

type Range = '24h' | '7d' | '30d' | '90d' | 'all'
type ReportType = 'overview' | 'countries' | 'cities' | 'paths' | 'referrers' | 'devices' | 'ips' | 'timeline' | 'realtime'

function getRangeStart(range: Range): Date | null {
  if (range === 'all') return null
  const now = Date.now()
  const ms: Record<string, number> = {
    '24h': 24 * 3600_000,
    '7d': 7 * 86400_000,
    '30d': 30 * 86400_000,
    '90d': 90 * 86400_000,
  }
  return new Date(now - (ms[range] || ms['7d']))
}

// Helper: count unique visitors (using groupBy since Prisma distinct needs orderBy with take)
async function countUniqueVisitors(where: any): Promise<number> {
  const result = await db.pageView.groupBy({
    by: ['visitorId'],
    where,
    _count: { visitorId: true },
    orderBy: { visitorId: 'asc' },
    take: 100000,
  })
  return result.length
}

async function countUniqueSessions(where: any): Promise<number> {
  const result = await db.pageView.groupBy({
    by: ['sessionId'],
    where,
    _count: { sessionId: true },
    orderBy: { sessionId: 'asc' },
    take: 100000,
  })
  return result.length
}

export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdminOrRespond(req)
    if (response) return response

    const url = new URL(req.url)
    const range = (url.searchParams.get('range') || '7d') as Range
    const type = (url.searchParams.get('type') || 'overview') as ReportType
    const start = getRangeStart(range)
    const where = start ? { viewedAt: { gte: start } } : {}

    // === OVERVIEW ===
    if (type === 'overview') {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 86400_000)
      const weekAgo = new Date(now.getTime() - 7 * 86400_000)
      const monthAgo = new Date(now.getTime() - 30 * 86400_000)

      const [
        totalViews, uniqueVisitors, uniqueSessions,
        viewsToday, viewsYesterday, viewsWeek, viewsMonth,
        avgResponseTime,
        topCountry, topCity, topReferrer, topPath, topBrowser, topOS, topDevice,
        visitorCounts, sessionCounts,
      ] = await Promise.all([
        db.pageView.count({ where }),
        countUniqueVisitors(where),
        countUniqueSessions(where),
        db.pageView.count({ where: { viewedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } } }),
        db.pageView.count({ where: { viewedAt: { gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()), lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } } }),
        db.pageView.count({ where: { viewedAt: { gte: weekAgo } } }),
        db.pageView.count({ where: { viewedAt: { gte: monthAgo } } }),
        db.pageView.aggregate({ where, _avg: { responseTimeMs: true } }),
        db.pageView.groupBy({ by: ['countryCode', 'country'], where: { ...where, countryCode: { not: null } }, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } }, take: 1 }),
        db.pageView.groupBy({ by: ['city', 'countryCode'], where: { ...where, city: { not: null } }, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } }, take: 1 }),
        db.pageView.groupBy({ by: ['referrerDomain', 'referrerType'], where: { ...where, referrerDomain: { not: null } }, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } }, take: 1 }),
        db.pageView.groupBy({ by: ['path', 'pathType'], where, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } }, take: 1 }),
        db.pageView.groupBy({ by: ['browser'], where: { ...where, browser: { not: null } }, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } }, take: 1 }),
        db.pageView.groupBy({ by: ['os'], where: { ...where, os: { not: null } }, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } }, take: 1 }),
        db.pageView.groupBy({ by: ['device'], where, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } }, take: 1 }),
        db.pageView.groupBy({ by: ['visitorId'], where, _count: { visitorId: true }, orderBy: { visitorId: 'asc' }, take: 10000 }),
        db.pageView.groupBy({ by: ['sessionId'], where, _count: { sessionId: true }, orderBy: { sessionId: 'asc' }, take: 10000 }),
      ])

      const bouncedVisitors = visitorCounts.filter((v: any) => v._count.visitorId === 1).length
      const bounceRate = visitorCounts.length > 0 ? (bouncedVisitors / visitorCounts.length) * 100 : 0
      const avgPagesPerSession = sessionCounts.length > 0
        ? sessionCounts.reduce((sum: number, s: any) => sum + s._count.sessionId, 0) / sessionCounts.length
        : 0
      const growthRate = viewsYesterday > 0
        ? ((viewsToday - viewsYesterday) / viewsYesterday) * 100
        : viewsToday > 0 ? 100 : 0

      return NextResponse.json({
        range, totalViews, uniqueVisitors, uniqueSessions,
        viewsToday, viewsYesterday, viewsWeek, viewsMonth,
        growthRate: parseFloat(growthRate.toFixed(2)),
        bounceRate: parseFloat(bounceRate.toFixed(2)),
        avgPagesPerSession: parseFloat(avgPagesPerSession.toFixed(2)),
        avgResponseTimeMs: Math.round(avgResponseTime._avg.responseTimeMs || 0),
        top: {
          country: topCountry[0] ? { code: topCountry[0].countryCode, name: topCountry[0].country, count: topCountry[0]._count.visitorId } : null,
          city: topCity[0] ? { name: topCity[0].city, countryCode: topCity[0].countryCode, count: topCity[0]._count.visitorId } : null,
          referrer: topReferrer[0] ? { domain: topReferrer[0].referrerDomain, type: topReferrer[0].referrerType, count: topReferrer[0]._count.visitorId } : null,
          path: topPath[0] ? { path: topPath[0].path, type: topPath[0].pathType, count: topPath[0]._count.visitorId } : null,
          browser: topBrowser[0] ? { name: topBrowser[0].browser, count: topBrowser[0]._count.visitorId } : null,
          os: topOS[0] ? { name: topOS[0].os, count: topOS[0]._count.visitorId } : null,
          device: topDevice[0] ? { type: topDevice[0].device, count: topDevice[0]._count.visitorId } : null,
        },
      })
    }

    // === COUNTRIES ===
    if (type === 'countries') {
      const countries = await db.pageView.groupBy({
        by: ['countryCode', 'country', 'latitude', 'longitude'],
        where: { ...where, countryCode: { not: null } },
        _count: { visitorId: true },
        orderBy: { _count: { visitorId: 'desc' } },
        take: 50,
      })
      return NextResponse.json({
        countries: countries.map(c => ({
          countryCode: c.countryCode, country: c.country,
          latitude: c.latitude, longitude: c.longitude,
          views: c._count.visitorId,
          uniqueVisitors: c._count.visitorId, // approximation
        })),
        total: countries.length,
      })
    }

    // === CITIES ===
    if (type === 'cities') {
      const cities = await db.pageView.groupBy({
        by: ['city', 'countryCode', 'country', 'region'],
        where: { ...where, city: { not: null } },
        _count: { visitorId: true },
        orderBy: { _count: { visitorId: 'desc' } },
        take: 100,
      })
      return NextResponse.json({
        cities: cities.map(c => ({ city: c.city, countryCode: c.countryCode, country: c.country, region: c.region, views: c._count.visitorId })),
        total: cities.length,
      })
    }

    // === PATHS ===
    if (type === 'paths') {
      const paths = await db.pageView.groupBy({
        by: ['path', 'pathType', 'refSlug'],
        where, _count: { visitorId: true },
        orderBy: { _count: { visitorId: 'desc' } }, take: 50,
      })
      return NextResponse.json({
        paths: paths.map(p => ({ path: p.path, pathType: p.pathType, refSlug: p.refSlug, views: p._count.visitorId })),
        total: paths.length,
      })
    }

    // === REFERRERS ===
    if (type === 'referrers') {
      const [domains, types] = await Promise.all([
        db.pageView.groupBy({ by: ['referrerDomain', 'referrerType'], where: { ...where, referrerDomain: { not: null } }, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } }, take: 50 }),
        db.pageView.groupBy({ by: ['referrerType'], where, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } } }),
      ])
      return NextResponse.json({
        domains: domains.map(d => ({ domain: d.referrerDomain, type: d.referrerType, views: d._count.visitorId })),
        types: types.map(t => ({ type: t.referrerType, views: t._count.visitorId })),
      })
    }

    // === DEVICES ===
    if (type === 'devices') {
      const [browsers, oss, devices] = await Promise.all([
        db.pageView.groupBy({ by: ['browser'], where: { ...where, browser: { not: null } }, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } }, take: 20 }),
        db.pageView.groupBy({ by: ['os'], where: { ...where, os: { not: null } }, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } }, take: 20 }),
        db.pageView.groupBy({ by: ['device'], where, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } } }),
      ])
      return NextResponse.json({
        browsers: browsers.map(b => ({ name: b.browser, views: b._count.visitorId })),
        oss: oss.map(o => ({ name: o.os, views: o._count.visitorId })),
        devices: devices.map(d => ({ type: d.device, views: d._count.visitorId })),
      })
    }

    // === IPS ===
    if (type === 'ips') {
      const ips = await db.pageView.groupBy({
        by: ['ipHash', 'country', 'countryCode', 'city', 'isp'],
        where, _count: { visitorId: true },
        orderBy: { _count: { visitorId: 'desc' } }, take: 100,
      })
      return NextResponse.json({
        ips: ips.map((ip, i) => ({
          rank: i + 1,
          ipHashShort: ip.ipHash.substring(0, 12) + '...',
          country: ip.country, countryCode: ip.countryCode, city: ip.city, isp: ip.isp,
          views: ip._count.visitorId,
        })),
        total: ips.length,
      })
    }

    // === TIMELINE ===
    if (type === 'timeline') {
      const bucketSize = range === '24h' ? 'hour' : 'day'
      const buckets: { date: string; views: number; visitors: number }[] = []
      const now = new Date()
      const bucketCount = range === '24h' ? 24 : range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 30

      for (let i = bucketCount - 1; i >= 0; i--) {
        let bucketStart: Date, bucketEnd: Date
        if (bucketSize === 'hour') {
          bucketStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - i)
          bucketEnd = new Date(bucketStart.getTime() + 3600_000)
        } else {
          bucketStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
          bucketEnd = new Date(bucketStart.getTime() + 86400_000)
        }
        const bucketWhere = { viewedAt: { gte: bucketStart, lt: bucketEnd } }
        const [views, visitorsArr] = await Promise.all([
          db.pageView.count({ where: bucketWhere }),
          db.pageView.groupBy({ by: ['visitorId'], where: bucketWhere, _count: { visitorId: true }, orderBy: { visitorId: 'asc' }, take: 100000 }),
        ])
        buckets.push({ date: bucketStart.toISOString(), views, visitors: visitorsArr.length })
      }
      return NextResponse.json({ bucketSize, buckets })
    }

    // === REALTIME ===
    if (type === 'realtime') {
      const fiveMinAgo = new Date(Date.now() - 5 * 60_000)
      const realtimeWhere = { viewedAt: { gte: fiveMinAgo } }
      const [activeViews, activeVisitorsArr, activePaths] = await Promise.all([
        db.pageView.count({ where: realtimeWhere }),
        db.pageView.groupBy({ by: ['visitorId'], where: realtimeWhere, _count: { visitorId: true }, orderBy: { visitorId: 'asc' }, take: 10000 }),
        db.pageView.groupBy({ by: ['path', 'pathType'], where: realtimeWhere, _count: { visitorId: true }, orderBy: { _count: { visitorId: 'desc' } }, take: 10 }),
      ])
      return NextResponse.json({
        activeViews,
        activeVisitors: activeVisitorsArr.length,
        activePaths: activePaths.map(p => ({ path: p.path, type: p.pathType, views: p._count.visitorId })),
      })
    }

    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 })
  } catch (e: any) {
    return handleApiError(e, 'analytics GET')
  }
}
