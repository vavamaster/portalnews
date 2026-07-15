import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-helpers'
import { getCurrentUser } from '@/lib/session'
import { getLicenseStatus, getPublicLicenseStatus } from '@/lib/license'

// GET /api/license/status
// Returns the cached license status (and the configured key, masked).
// If the cache is stale (older than TTL), the cache.valid flag is still returned
// but a `stale: true` flag is included so the client knows it should call /validate.
//
export async function GET(req: NextRequest) {
  try {
    const [license, user] = await Promise.all([
      getLicenseStatus(),
      getCurrentUser(req),
    ])
    const isAdmin = Boolean(user && ['MASTER', 'ADMIN'].includes(user.role))
    const payload = isAdmin ? license : getPublicLicenseStatus(license)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  } catch (e: any) {
    return handleApiError(e, 'license status')
  }
}
