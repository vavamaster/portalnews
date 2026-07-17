import { NextResponse } from 'next/server'
import { getSocialLoginConfig } from '@/lib/social-auth'

export async function GET() {
  const [google, facebook] = await Promise.all([
    getSocialLoginConfig('google'),
    getSocialLoginConfig('facebook'),
  ])

  return NextResponse.json(
    {
      providers: {
        google: google.ready,
        facebook: facebook.ready,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  )
}
