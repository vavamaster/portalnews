import { NextRequest, NextResponse } from 'next/server'
import {
  createOAuthState,
  createPkcePair,
  getOAuthCookieNames,
  getSocialLoginConfig,
  isSocialLoginProvider,
} from '@/lib/social-auth'

const COOKIE_MAX_AGE = 10 * 60

function cookieOptions(req: NextRequest, path: string) {
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: forwardedProto === 'https' || req.nextUrl.protocol === 'https:',
    path,
    maxAge: COOKIE_MAX_AGE,
  }
}

function loginError(code: string) {
  const query = new URLSearchParams({ oauth_error: code })
  return new NextResponse(null, {
    status: 307,
    headers: { Location: `/entrar?${query.toString()}` },
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await params
  if (!isSocialLoginProvider(rawProvider)) return loginError('provider')

  const provider = rawProvider
  const { credentials, ready, validation } = await getSocialLoginConfig(provider)
  if (!ready || !validation.ok) return loginError('configuration')

  const state = createOAuthState()
  const cookieNames = getOAuthCookieNames(provider)
  const callbackPath = `/api/auth/social/${provider}`
  let authorizationUrl: URL
  let verifier = ''

  if (provider === 'google') {
    const pkce = createPkcePair()
    verifier = pkce.verifier
    authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authorizationUrl.search = new URLSearchParams({
      client_id: credentials.clientId!.trim(),
      redirect_uri: validation.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString()
  } else {
    const version = credentials.graphVersion?.trim()
    authorizationUrl = new URL(`https://www.facebook.com${version ? `/${version}` : ''}/dialog/oauth`)
    authorizationUrl.search = new URLSearchParams({
      client_id: credentials.appId!.trim(),
      redirect_uri: validation.redirectUri,
      response_type: 'code',
      scope: 'email,public_profile',
      state,
    }).toString()
  }

  const response = NextResponse.redirect(authorizationUrl)
  response.cookies.set(cookieNames.state, state, cookieOptions(req, callbackPath))
  if (verifier) response.cookies.set(cookieNames.verifier, verifier, cookieOptions(req, callbackPath))

  const referralCode = req.nextUrl.searchParams.get('ref')?.trim().toUpperCase()
  if (referralCode && /^[A-Z0-9_-]{3,40}$/.test(referralCode)) {
    response.cookies.set(cookieNames.referral, referralCode, cookieOptions(req, callbackPath))
  }
  return response
}
