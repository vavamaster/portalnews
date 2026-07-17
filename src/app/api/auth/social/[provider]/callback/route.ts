import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSession, setSessionCookie } from '@/lib/session'
import {
  findOrCreateSocialUser,
  getFacebookEndpoint,
  getOAuthCookieNames,
  getSocialLoginConfig,
  isSocialLoginProvider,
  SocialAuthError,
  type SocialIdentity,
  type SocialLoginProvider,
} from '@/lib/social-auth'

const FETCH_TIMEOUT_MS = 12_000

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function clearOAuthCookies(response: NextResponse, provider: SocialLoginProvider) {
  const names = getOAuthCookieNames(provider)
  for (const name of Object.values(names)) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: `/api/auth/social/${provider}`,
      maxAge: 0,
    })
  }
}

function portalRedirect(redirectUri: string, path: string, params?: Record<string, string>) {
  const url = new URL(path, redirectUri)
  for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value)
  return url
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new SocialAuthError('provider', 'O provedor recusou a solicitação de autenticação.')
  return data as T
}

async function getGoogleIdentity(
  code: string,
  verifier: string,
  credentials: Awaited<ReturnType<typeof getSocialLoginConfig>>['credentials'],
  redirectUri: string,
): Promise<SocialIdentity> {
  const token = await fetchJson<{ access_token?: string; error?: string }>('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId!.trim(),
      client_secret: credentials.clientSecret!.trim(),
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })
  if (!token.access_token) throw new SocialAuthError('provider', 'O Google não retornou um token de acesso.')

  const profile = await fetchJson<{
    sub?: string
    email?: string
    email_verified?: boolean
    name?: string
    picture?: string
  }>('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    throw new SocialAuthError('email_required', 'O Google não retornou um email verificado.')
  }
  return {
    provider: 'google',
    providerAccountId: profile.sub,
    email: profile.email,
    name: profile.name || profile.email.split('@')[0],
    avatar: profile.picture || null,
  }
}

async function getFacebookIdentity(
  code: string,
  credentials: Awaited<ReturnType<typeof getSocialLoginConfig>>['credentials'],
  redirectUri: string,
): Promise<SocialIdentity> {
  const tokenUrl = new URL(getFacebookEndpoint(credentials, '/oauth/access_token'))
  tokenUrl.search = new URLSearchParams({
    client_id: credentials.appId!.trim(),
    client_secret: credentials.appSecret!.trim(),
    redirect_uri: redirectUri,
    code,
  }).toString()
  const token = await fetchJson<{ access_token?: string }>(tokenUrl.toString())
  if (!token.access_token) throw new SocialAuthError('provider', 'O Facebook não retornou um token de acesso.')

  const profileUrl = new URL(getFacebookEndpoint(credentials, '/me'))
  profileUrl.search = new URLSearchParams({
    fields: 'id,name,email,picture.type(large)',
    access_token: token.access_token,
  }).toString()
  const profile = await fetchJson<{
    id?: string
    name?: string
    email?: string
    picture?: { data?: { url?: string } }
  }>(profileUrl.toString())
  if (!profile.id || !profile.email) {
    throw new SocialAuthError('email_required', 'Autorize o acesso ao email da sua conta do Facebook.')
  }
  return {
    provider: 'facebook',
    providerAccountId: profile.id,
    email: profile.email,
    name: profile.name || profile.email.split('@')[0],
    avatar: profile.picture?.data?.url || null,
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await params
  if (!isSocialLoginProvider(rawProvider)) {
    return new NextResponse(null, {
      status: 307,
      headers: { Location: '/entrar?oauth_error=provider' },
    })
  }
  const provider = rawProvider
  const { credentials, ready, validation } = await getSocialLoginConfig(provider)
  if (!ready || !validation.ok) {
    const response = new NextResponse(null, {
      status: 307,
      headers: { Location: '/entrar?oauth_error=configuration' },
    })
    clearOAuthCookies(response, provider)
    return response
  }

  const fail = (code: string) => {
    const response = NextResponse.redirect(portalRedirect(validation.redirectUri, '/entrar', { oauth_error: code }))
    clearOAuthCookies(response, provider)
    return response
  }

  if (req.nextUrl.searchParams.get('error')) return fail('cancelled')

  const code = req.nextUrl.searchParams.get('code') || ''
  const receivedState = req.nextUrl.searchParams.get('state') || ''
  const cookieNames = getOAuthCookieNames(provider)
  const storedState = req.cookies.get(cookieNames.state)?.value || ''
  if (!code || !receivedState || !storedState || !safeCompare(receivedState, storedState)) {
    return fail('state')
  }

  try {
    const identity = provider === 'google'
      ? await (async () => {
          const verifier = req.cookies.get(cookieNames.verifier)?.value || ''
          if (!verifier) throw new SocialAuthError('state', 'O verificador PKCE não foi encontrado.')
          return getGoogleIdentity(code, verifier, credentials, validation.redirectUri)
        })()
      : await getFacebookIdentity(code, credentials, validation.redirectUri)
    const user = await findOrCreateSocialUser(
      identity,
      req.cookies.get(cookieNames.referral)?.value,
    )
    const token = await createSession(user.id)
    const response = NextResponse.redirect(portalRedirect(validation.redirectUri, '/'))
    clearOAuthCookies(response, provider)
    response.headers.append('set-cookie', setSessionCookie(token, req))
    return response
  } catch (error) {
    console.error(`[social-auth:${provider}]`, error instanceof Error ? error.message : error)
    return fail(error instanceof SocialAuthError ? error.code : 'callback')
  }
}
