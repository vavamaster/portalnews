import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import { db } from './db'
import { getSecuritySecret } from './security-secret'

type AuditActor = { id: string; email: string }

function requestIpHash(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
  if (!ip) return null
  const salt = getSecuritySecret('AUDIT_HASH_SECRET')
  return crypto.createHmac('sha256', salt).update(ip).digest('hex')
}

export async function auditAdminAction(
  req: NextRequest,
  actor: AuditActor,
  action: string,
  resource: string,
  resourceId?: string | null,
  details?: Record<string, unknown>,
) {
  try {
    await db.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action,
        resource,
        resourceId: resourceId || null,
        details: details ? JSON.stringify(details) : null,
        ipHash: requestIpHash(req),
      },
    })
  } catch (error) {
    console.error('[admin-audit] Falha ao registrar ação:', error)
  }
}
