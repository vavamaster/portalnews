import { NextRequest, NextResponse } from 'next/server'

// Social login endpoint — DISABLED for security.
// The previous mock implementation accepted any email/name from the client
// without OAuth verification, allowing login as any user.
// To enable: implement real OAuth with Google/Facebook SDK.
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'Login social temporariamente desativado. Use email e senha. Para integrar OAuth real (Google/Facebook), configure as credenciais no admin.' },
    { status: 503 }
  )
}
