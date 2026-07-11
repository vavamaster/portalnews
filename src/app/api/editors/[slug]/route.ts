import { NextRequest, NextResponse } from 'next/server'
import { getEditorPublicProfile } from '@/lib/editors'

// GET /api/editors/[slug] - public editor profile
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const profile = await getEditorPublicProfile(slug)
  if (!profile) {
    return NextResponse.json({ error: 'Editor não encontrado ou inativo' }, { status: 404 })
  }
  return NextResponse.json({ profile })
}
