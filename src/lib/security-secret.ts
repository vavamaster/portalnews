import crypto from 'crypto'

const developmentFallback = crypto.randomBytes(48).toString('base64url')
let warned = false

export function getSecuritySecret(...specificNames: string[]) {
  for (const name of [...specificNames, 'APP_SECURITY_SECRET']) {
    const value = process.env[name]?.trim()
    if (value && value.length >= 32 && !value.includes('substitua')) return value
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Segredo de segurança ausente. Configure ${[...specificNames, 'APP_SECURITY_SECRET'].join(' ou ')}.`)
  }
  if (!warned) {
    warned = true
    console.warn('[security] Usando segredo temporário apenas para desenvolvimento.')
  }
  return developmentFallback
}
