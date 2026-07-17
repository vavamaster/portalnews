import crypto from 'crypto'
import { db } from '@/lib/db'
import { generateReferralCode } from '@/lib/achievements'
import { getSiteNameAsync } from '@/lib/seo-helpers'
import { defaultAvatar, safeJsonArray, safeJsonParse } from '@/lib/utils'
import { decodeCredentialJson } from '@/lib/secret-storage'

export type SocialLoginProvider = 'google' | 'facebook'

export interface SocialLoginCredentials {
  clientId?: string
  clientSecret?: string
  appId?: string
  appSecret?: string
  redirectUri?: string
  graphVersion?: string
}

export interface SocialIdentity {
  provider: SocialLoginProvider
  providerAccountId: string
  email: string
  name: string
  avatar?: string | null
}

interface LinkedSocialAccount {
  provider: SocialLoginProvider
  id: string
  linkedAt?: string
}

const PROVIDER_DB_KEYS: Record<SocialLoginProvider, string> = {
  google: 'GOOGLE_LOGIN',
  facebook: 'FACEBOOK_LOGIN',
}

const CALLBACK_PATHS: Record<SocialLoginProvider, string> = {
  google: '/api/auth/social/google/callback',
  facebook: '/api/auth/social/facebook/callback',
}

export class SocialAuthError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
  }
}

export function isSocialLoginProvider(value: string): value is SocialLoginProvider {
  return value === 'google' || value === 'facebook'
}

export function getSocialProviderDbKey(provider: SocialLoginProvider) {
  return PROVIDER_DB_KEYS[provider]
}

export function getSocialCallbackPath(provider: SocialLoginProvider) {
  return CALLBACK_PATHS[provider]
}

export function getOAuthCookieNames(provider: SocialLoginProvider) {
  return {
    state: `portal_oauth_state_${provider}`,
    verifier: `portal_oauth_verifier_${provider}`,
    referral: `portal_oauth_ref_${provider}`,
  }
}

export function createOAuthState() {
  return crypto.randomBytes(32).toString('base64url')
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export async function getSocialLoginConfig(provider: SocialLoginProvider) {
  const config = await db.socialConfig.findUnique({
    where: { provider: getSocialProviderDbKey(provider) },
  })
  let credentials: SocialLoginCredentials = {}
  try {
    credentials = decodeCredentialJson(config?.credentials, `social:${config?.provider || getSocialProviderDbKey(provider)}`) as SocialLoginCredentials
  } catch (error) {
    console.error(`[social auth] Falha ao abrir credenciais de ${provider}:`, error)
  }
  const validation = validateSocialLoginConfig(provider, credentials)
  return {
    config,
    credentials,
    ready: Boolean(config?.isEnabled && validation.ok),
    validation,
  }
}

export function validateSocialLoginConfig(
  provider: SocialLoginProvider,
  credentials: SocialLoginCredentials,
): { ok: true; redirectUri: string } | { ok: false; error: string } {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
  const clientId = text(provider === 'google' ? credentials.clientId : credentials.appId)
  const clientSecret = text(provider === 'google' ? credentials.clientSecret : credentials.appSecret)
  if (!clientId || !clientSecret) {
    return { ok: false, error: 'Informe o identificador e a chave secreta do aplicativo.' }
  }

  const redirectUri = text(credentials.redirectUri)
  if (!redirectUri) return { ok: false, error: 'Informe a URL de callback.' }

  try {
    const url = new URL(redirectUri)
    const localHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHost)) {
      return { ok: false, error: 'A URL de callback deve usar HTTPS, exceto em localhost.' }
    }
    if (url.username || url.password || url.search || url.hash) {
      return { ok: false, error: 'A URL de callback não pode conter credenciais, parâmetros ou fragmentos.' }
    }
    if (url.pathname.replace(/\/+$/, '') !== getSocialCallbackPath(provider)) {
      return { ok: false, error: `A URL de callback deve terminar em ${getSocialCallbackPath(provider)}.` }
    }
    const graphVersion = text(credentials.graphVersion)
    if (provider === 'facebook' && graphVersion && !/^v\d+\.\d+$/.test(graphVersion)) {
      return { ok: false, error: 'A versão da Graph API deve seguir o formato v00.0.' }
    }
    return { ok: true, redirectUri: url.toString() }
  } catch {
    return { ok: false, error: 'URL de callback inválida.' }
  }
}

export function getFacebookEndpoint(credentials: SocialLoginCredentials, path: string) {
  const version = typeof credentials.graphVersion === 'string' ? credentials.graphVersion.trim() : ''
  const versionPath = version ? `/${version}` : ''
  return `https://graph.facebook.com${versionPath}${path}`
}

async function uniqueReferralCode(name: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = attempt === 0 ? '' : crypto.randomBytes(2).toString('hex')
    const code = generateReferralCode(`${name}${suffix}`)
    const existing = await db.user.findUnique({ where: { referralCode: code }, select: { id: true } })
    if (!existing) return code
  }
  return generateReferralCode(`${name}${Date.now()}`)
}

function parseLinkedAccounts(value: string | null): LinkedSocialAccount[] {
  return safeJsonArray<LinkedSocialAccount>(value).filter(account => (
    isSocialLoginProvider(account?.provider) && typeof account.id === 'string' && account.id
  ))
}

export async function findOrCreateSocialUser(identity: SocialIdentity, referralCode?: string | null) {
  const email = identity.email.trim().toLowerCase()
  const name = identity.name.trim().slice(0, 120)
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new SocialAuthError('email_required', 'O provedor não retornou um email válido.')
  }
  if (!identity.providerAccountId || identity.providerAccountId.length > 255 || !name) {
    throw new SocialAuthError('invalid_profile', 'O provedor retornou um perfil inválido.')
  }

  const possibleAccountOwners = await db.user.findMany({
    where: { socialAccounts: { contains: JSON.stringify(identity.providerAccountId) } },
    take: 20,
  })
  const accountOwner = possibleAccountOwners.find(user => (
    parseLinkedAccounts(user.socialAccounts).some(account => (
      account.provider === identity.provider && account.id === identity.providerAccountId
    ))
  ))
  const emailOwner = await db.user.findUnique({ where: { email } })

  if (accountOwner && emailOwner && accountOwner.id !== emailOwner.id) {
    throw new SocialAuthError('account_conflict', 'A conta social e o email pertencem a usuários diferentes.')
  }

  const existing = accountOwner || emailOwner
  if (existing) {
    const linkedAccounts = parseLinkedAccounts(existing.socialAccounts)
    const providerAccount = linkedAccounts.find(account => account.provider === identity.provider)
    if (providerAccount && providerAccount.id !== identity.providerAccountId) {
      throw new SocialAuthError('account_conflict', 'Já existe outra conta deste provedor vinculada ao usuário.')
    }
    if (!providerAccount) {
      linkedAccounts.push({
        provider: identity.provider,
        id: identity.providerAccountId,
        linkedAt: new Date().toISOString(),
      })
    }

    return db.user.update({
      where: { id: existing.id },
      data: {
        socialAccounts: JSON.stringify(linkedAccounts),
        avatar: existing.avatar || identity.avatar || defaultAvatar(existing.name),
      },
    })
  }

  let referredById: string | null = null
  if (referralCode) {
    const referrer = await db.user.findUnique({
      where: { referralCode: referralCode.trim().toUpperCase() },
      select: { id: true },
    })
    referredById = referrer?.id || null
  }

  const user = await db.user.create({
    data: {
      email,
      name,
      password: null,
      role: 'READER',
      avatar: identity.avatar || defaultAvatar(name),
      socialAccounts: JSON.stringify([{
        provider: identity.provider,
        id: identity.providerAccountId,
        linkedAt: new Date().toISOString(),
      } satisfies LinkedSocialAccount]),
      referralCode: await uniqueReferralCode(name),
      referredById,
    },
  })

  const siteName = await getSiteNameAsync()
  await db.notification.create({
    data: {
      userId: user.id,
      type: 'SYSTEM',
      title: `Bem-vindo ao ${siteName}, ${name}!`,
      message: 'Sua conta foi criada com login social. Complete seu perfil, leia notícias e ganhe pontos.',
      link: 'profile',
    },
  }).catch(() => {})

  if (referredById) {
    await db.notification.create({
      data: {
        userId: referredById,
        type: 'REFERRAL',
        title: 'Novo indicado cadastrado!',
        message: `${name} se cadastrou com seu código usando login social.`,
        link: 'profile',
      },
    }).catch(() => {})
  }

  return user
}
