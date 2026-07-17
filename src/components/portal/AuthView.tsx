'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useApiError } from '@/hooks/use-api-error'
import {
  Mail, Lock, User as UserIcon, Sparkles, Award, Coins, Flame,
  Eye, EyeOff, ArrowRight, CheckCircle2, Loader2, TrendingUp,
} from 'lucide-react'

interface AuthViewProps {
  mode: 'login' | 'register'
  seoSettings?: Record<string, string>
}

export function AuthView({ mode: initialMode, seoSettings = {} }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null)
  const [socialProviders, setSocialProviders] = useState({ google: false, facebook: false })
  const { setView, setUser } = useAppStore()
  const { toast } = useToast()
  const apiError = useApiError()

  const siteName = seoSettings.site_name || 'Portal de Notícias'
  const siteInitials = siteName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  const siteLogo = seoSettings.site_logo_dark || seoSettings.site_logo || ''
  const logoStyle = seoSettings.logo_style || 'logo-text'
  const showBrandText = logoStyle !== 'logo'
  const hasSocialLogin = socialProviders.google || socialProviders.facebook

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const ref = params.get('ref')
      if (ref) {
        setReferralCode(ref.toUpperCase())
        fetch(`/api/referral?code=${encodeURIComponent(ref)}`)
          .then(r => r.json())
          .then(data => {
            if (data.valid && data.referrer) setReferrerName(data.referrer.name)
          })
          .catch(() => {})
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    fetch('/api/auth/social/config', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setSocialProviders({
        google: data.providers?.google === true,
        facebook: data.providers?.facebook === true,
      }))
      .catch(() => setSocialProviders({ google: false, facebook: false }))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const errorCode = url.searchParams.get('oauth_error')
    if (!errorCode) return
    const messages: Record<string, string> = {
      configuration: 'O login social ainda não está configurado corretamente.',
      cancelled: 'O acesso pela rede social foi cancelado.',
      state: 'A tentativa de login expirou ou não pôde ser validada. Tente novamente.',
      email_required: 'O provedor não liberou um email válido para concluir o cadastro.',
      account_conflict: 'Esta conta social está vinculada a outro usuário.',
      invalid_profile: 'O provedor retornou dados de perfil incompletos.',
      provider: 'A rede social recusou a autenticação. Tente novamente.',
      callback: 'Não foi possível concluir o login social.',
    }
    toast({
      title: 'Login social não concluído',
      description: messages[errorCode] || messages.callback,
      variant: 'destructive',
    })
    url.searchParams.delete('oauth_error')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [toast])

  const handleSocial = (provider: 'google' | 'facebook') => {
    setSocialLoading(provider)
    const url = new URL(`/api/auth/social/${provider}`, window.location.origin)
    if (referralCode) url.searchParams.set('ref', referralCode)
    window.location.assign(url.toString())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body: any = { email, password }
      if (mode === 'register') {
        body.name = name
        if (referralCode) body.referralCode = referralCode
      }
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        setUser(data.user)
        toast({
          title: mode === 'login' ? 'Bem-vindo!' : 'Conta criada!',
          description: mode === 'register' ? `${data.user.name} — você ganhou pontos iniciais!` : `${data.user.name}`,
        })
        setView({ name: 'home' })
      }
    } catch (e: any) {
      apiError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const passwordStrength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 6) s++
    if (password.length >= 10) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return Math.min(s, 4)
  })()

  const strengthLabels = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte']
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500']

  return (
    <div className="relative min-h-[60vh] overflow-hidden bg-zinc-50 px-4 py-8 sm:px-6 sm:py-12 dark:bg-zinc-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-70 dark:opacity-30"
        style={{ background: 'radial-gradient(circle at top, color-mix(in srgb, var(--primary) 18%, transparent), transparent 68%)' }}
      />
      <div className="relative mx-auto flex w-full max-w-lg flex-col items-stretch">
        {/* === Card principal === */}
        <div className="min-w-0 w-full overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-[0_24px_70px_-28px_rgba(15,23,42,0.38)] dark:border-zinc-800 dark:bg-zinc-900">
          {/* Header com gradiente */}
          <div className="bg-gradient-to-br from-primary via-primary to-blue-700 px-6 py-7 text-center text-white">
            <div className="mb-5 flex min-h-11 min-w-0 max-w-full items-center justify-center gap-2.5">
              {siteLogo ? (
                  <img
                    src={siteLogo}
                    alt={siteName}
                    className={`${showBrandText ? 'max-w-[55%]' : 'max-w-full'} h-11 min-w-0 w-auto object-contain drop-shadow-sm`}
                    onError={(event) => {
                      const image = event.currentTarget
                      const fallbackLogo = seoSettings.site_logo || ''
                      if (fallbackLogo && image.dataset.fallbackAttempted !== 'true') {
                        image.dataset.fallbackAttempted = 'true'
                        image.src = fallbackLogo
                        image.style.filter = 'brightness(0) invert(1)'
                      } else image.style.display = 'none'
                    }}
                  />
              ) : (
                  <div className="text-2xl text-white" style={{ fontWeight: 750 }}>{siteInitials}</div>
              )}
              {showBrandText && <span className="min-w-0 truncate text-lg" style={{ fontWeight: 650 }}>{siteName}</span>}
            </div>
            <h1 className="mb-1 text-2xl tracking-tight sm:text-[1.7rem]" style={{ fontWeight: 650 }}>
              {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h1>
            <p className="text-sm leading-relaxed text-blue-100">
              {mode === 'login'
                ? 'Acesse para comentar, reagir e ganhar pontos'
                : 'Leia, reaja e acumule pontos para trocar por créditos'}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {/* Benefícios (só registro) */}
            {mode === 'register' && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/70 dark:bg-amber-950/35">
                <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-amber-900 dark:text-amber-200">
                  <Sparkles className="h-3.5 w-3.5" /> Bônus de cadastro:
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="min-w-0 rounded-lg bg-white p-2 dark:bg-zinc-900">
                    <Award className="h-4 w-4 text-amber-500 mx-auto mb-0.5" />
                    <div className="text-[11px] leading-tight text-zinc-600 dark:text-zinc-300">Pontos por leitura</div>
                  </div>
                  <div className="min-w-0 rounded-lg bg-white p-2 dark:bg-zinc-900">
                    <Coins className="h-4 w-4 text-emerald-500 mx-auto mb-0.5" />
                    <div className="text-[11px] leading-tight text-zinc-600 dark:text-zinc-300">Créditos grátis</div>
                  </div>
                  <div className="min-w-0 rounded-lg bg-white p-2 dark:bg-zinc-900">
                    <Flame className="h-4 w-4 text-orange-500 mx-auto mb-0.5" />
                    <div className="text-[11px] leading-tight text-zinc-600 dark:text-zinc-300">Anuncie grátis</div>
                  </div>
                </div>
              </div>
            )}

            {hasSocialLogin && (
              <>
                <div className="mb-5 space-y-2.5">
                  {socialProviders.google && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => handleSocial('google')}
                      disabled={socialLoading !== null}
                    >
                      {socialLoading === 'google' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Continuar com Google
                        </>
                      )}
                    </Button>
                  )}
                  {socialProviders.facebook && (
                    <Button
                      type="button"
                      className="h-11 w-full rounded-xl border border-transparent bg-[#1877F2] text-white hover:bg-[#0d6ae0]"
                      onClick={() => handleSocial('facebook')}
                      disabled={socialLoading !== null}
                    >
                      {socialLoading === 'facebook' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4 fill-current" aria-hidden="true">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                          Continuar com Facebook
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-[0.16em]">
                    <span className="bg-white px-3 text-zinc-400 dark:bg-zinc-900">ou use seu email</span>
                  </div>
                </div>
              </>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <Label htmlFor="name" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Nome completo</Label>
                  <div className="relative mt-1">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      id="name" type="text" value={name}
                      onChange={(e) => setName(e.target.value)} required
                      autoComplete="name"
                      placeholder="Seu nome" className="h-11 rounded-xl border-zinc-200 bg-zinc-50/70 pl-10 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950/50"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="email" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required
                    autoComplete="email"
                    placeholder="seu@email.com" className="h-11 rounded-xl border-zinc-200 bg-zinc-50/70 pl-10 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950/50"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="password" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Senha</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="password" type={showPassword ? 'text' : 'password'}
                    value={password} onChange={(e) => setPassword(e.target.value)} required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Sua senha'}
                    className="h-11 rounded-xl border-zinc-200 bg-zinc-50/70 pl-10 pr-10 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Password strength meter (só registro) */}
                {mode === 'register' && password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i < passwordStrength ? strengthColors[passwordStrength] : 'bg-zinc-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {strengthLabels[passwordStrength]}
                      {passwordStrength >= 3 && ' ✓'}
                    </p>
                  </div>
                )}
              </div>

              {/* Referral (só registro) */}
              {mode === 'register' && (
                <div>
                  <Label htmlFor="referral" className="text-xs text-zinc-600">Código de indicação (opcional)</Label>
                  <Input
                    id="referral" value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="Ex: ADMIN1234" className="mt-1 h-11 rounded-xl uppercase"
                  />
                  {referrerName && (
                    <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Indicado por <strong>{referrerName}</strong> — bônus garantido!
                    </p>
                  )}
                </div>
              )}

              <Button type="submit" className="mt-1 h-11 w-full rounded-xl bg-primary shadow-sm hover:bg-blue-700" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processando...</>
                ) : (
                  <>
                    {mode === 'login' ? 'Entrar' : 'Criar conta'}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </form>

            {/* Toggle login/register */}
            <div className="mt-6 border-t border-zinc-100 pt-5 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              {mode === 'login' ? (
                <>Não tem conta?{' '}
                  <button onClick={() => setMode('register')} className="text-primary font-medium hover:underline">
                    Criar agora
                  </button>
                </>
              ) : (
                <>Já tem conta?{' '}
                  <button onClick={() => setMode('login')} className="text-primary font-medium hover:underline">
                    Entrar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* === Side info card (abaixo do form) === */}
        {mode === 'register' && (
          <aside className="mt-4 w-full rounded-xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
            <div className="flex items-start gap-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
              <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
              <span>
                <strong className="text-zinc-900 dark:text-zinc-100">Como funciona:</strong> Leia notícias (+10 pts), reaja (+5 pts), faça check-in diário (+30 pts).
                Troque pontos por créditos e use para anúncios grátis no portal.
              </span>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
