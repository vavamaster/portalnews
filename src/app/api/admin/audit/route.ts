import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireMasterOrRespond } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const { response } = await requireMasterOrRespond(req)
  if (response) return response
  const url = new URL(req.url)
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(url.searchParams.get('pageSize') || '30', 10) || 30))
  const query = (url.searchParams.get('q') || '').trim().slice(0, 120)
  const where = query ? {
    OR: [
      { actorEmail: { contains: query } },
      { action: { contains: query } },
      { resource: { contains: query } },
      { resourceId: { contains: query } },
    ],
  } : {}
  const [logs, total] = await Promise.all([
    db.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.adminAuditLog.count({ where }),
  ])
  return NextResponse.json({
    logs,
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
  })
}
