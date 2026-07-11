import { NextResponse } from 'next/server'
import { listActiveEditors } from '@/lib/editors'

// GET /api/editors - public list of active editors
export async function GET() {
  const editors = await listActiveEditors()
  return NextResponse.json({ editors })
}
