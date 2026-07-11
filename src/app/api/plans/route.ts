import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/plans - public list of plans
export async function GET() {
  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })
  return NextResponse.json({ plans })
}
