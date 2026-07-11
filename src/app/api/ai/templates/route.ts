import { NextResponse } from 'next/server'
import { AI_TEMPLATES } from '@/lib/ai-generator'

export async function GET() {
  return NextResponse.json({ templates: AI_TEMPLATES })
}
