import { NextRequest, NextResponse } from 'next/server'

// Legacy endpoint kept only to reject the old insecure client-side payload.
// Real OAuth starts at /api/auth/social/google or /api/auth/social/facebook.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Fluxo inválido. Inicie o login pelo botão Google ou Facebook.' },
    { status: 405, headers: { Allow: 'GET' } },
  )
}
