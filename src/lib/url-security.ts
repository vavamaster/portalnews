import { isIP } from 'net'
import { lookup } from 'dns/promises'

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '')
  if (normalized === '::1' || normalized === '0.0.0.0') return true
  if (normalized.startsWith('10.') || normalized.startsWith('127.') || normalized.startsWith('169.254.') || normalized.startsWith('192.168.')) return true
  const match172 = normalized.match(/^172\.(\d+)\./)
  if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) return true
  return normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')
}

export async function assertSafeExternalUrl(input: unknown) {
  if (typeof input !== 'string' || input.length > 2_048) throw new Error('URL inválida')
  let url: URL
  try { url = new URL(input) } catch { throw new Error('URL inválida') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL externa inválida')
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw new Error('Endereço interno não permitido')
  if (isIP(hostname) && isPrivateAddress(hostname)) throw new Error('Endereço interno não permitido')
  const resolved = await lookup(hostname, { all: true })
  if (!resolved.length || resolved.some(result => isPrivateAddress(result.address))) throw new Error('Endereço interno não permitido')
  return url
}

export async function safeExternalFetch(input: string, init: RequestInit = {}) {
  let current = await assertSafeExternalUrl(input)
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(current, { ...init, redirect: 'manual' })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get('location')
    if (!location) return response
    current = await assertSafeExternalUrl(new URL(location, current).toString())
  }
  throw new Error('Redirecionamentos excessivos')
}
