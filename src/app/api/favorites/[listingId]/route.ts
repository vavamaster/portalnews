import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await db.favorite.deleteMany({ where: { userId: user.id, listingId } })
  return NextResponse.json({ ok: true })
}
