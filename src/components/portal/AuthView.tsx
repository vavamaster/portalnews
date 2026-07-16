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
  const { setView, setUser } = useAppStore()
  const { toast } = useToast()
  const apiError = useApiError()

  const siteName = seoSettings.site_name || 'Portal de Notícias'
  const siteInitials = siteName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  const siteLogo = seoSettings.site_logo_dark || seoSettings.site_logo || ''
  const logoStyle = seoSettings.logo_style || 'logo-text'
  const showBrandText = logoStyle !== 'logo'

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
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-zinc-50 px-4 py-8 sm:py-12 dark:bg-zinc-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-70 dark:opacity-30"
        style={{ background: 'radial-gradient(circle at top, color-mix(in srgb, var(--primary) 18%, transparent), transparent 68%)' }}
      />
      <div className="relative mx-auto flex w-full max-w-md items-center justify-center">
        {/* === Card principal === */}
        <div className="w-full overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-[0_24px_70px_-28px_rgba(15,23,42,0.38)] dark:border-zinc-800 dark:bg-zinc-900">
          {/* Header com gradiente */}
          <div className="bg-gradient-to-br from-primary via-primary to-blue-700 px-6 py-7 text-center text-white">
            <div className="mb-4 flex justify-center">
              <div className="inline-flex min-h-12 max-w-full items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 shadow-sm backdrop-blur-sm">
              {siteLogo ? (
                  <img
                    src={siteLogo}
                    alt={siteName}
                    className="h-10 w-auto max-w-[220px] object-contain"
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
                  <div className="rounded-xl bg-white/20 px-3 py-1.5 text-xl text-white backdrop-blur" style={{ fontWeight: 700 }}>{siteInitials}</div>
              )}
                {showBrandText && <span className="text-lg" style={{ fontWeight: 600 }}>{siteName}</span>}
              </div>
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
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
                <div className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Bônus de cadastro:
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <Award className="h-4 w-4 text-amber-500 mx-auto mb-0.5" />
                    <div className="text-[10px] text-zinc-600">Pontos por leitura</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <Coins className="h-4 w-4 text-emerald-500 mx-auto mb-0.5" />
                    <div className="text-[10px] text-zinc-600">Créditos grátis</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <Flame className="h-4 w-4 text-orange-500 mx-auto mb-0.5" />
                    <div className="text-[10px] text-zinc-600">Anuncie grátis</div>
                  </div>
                </div>
              </div>
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
                    placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : 'Sua senha'}
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
          <div className="mt-4 bg-white/60 backdrop-blur border border-zinc-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
              <span>
                <strong className="text-zinc-900">Como funciona:</strong> Leia notícias (+10 pts), reaja (+5 pts), faça check-in diário (+30 pts).
                Troque pontos por créditos e use para anúncios grátis no portal.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
