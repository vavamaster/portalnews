import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// PATCH /api/admin/enterprise-users/[id]
// Toggle isActive (activate/deactivate Enterprise access).
// Body: { isActive?: boolean, companyName?: string }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json()
  const data: any = {}
  if (body.isActive !== undefined) data.isActive = body.isActive
  if (body.companyName !== undefined) data.companyName = body.companyName

  const link = await db.enterpriseUserLink.update({ where: { id }, data })
  return NextResponse.json({ ok: true, link })
}

// DELETE /api/admin/enterprise-users/[id]
// Remove Enterprise access entirely (deletes the EnterpriseUserLink).
// Does NOT delete the user's ads or billing cycles — those remain for historical records.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id } = await params
  await db.enterpriseUserLink.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
