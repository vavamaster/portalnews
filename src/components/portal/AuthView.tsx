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

export function AuthView({ mode: initialMode }: { mode: 'login' | 'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)
  const [seoSettings, setSeoSettings] = useState<Record<string, string>>({})
  const { setView, setUser } = useAppStore()
  const { toast } = useToast()
  const apiError = useApiError()

  // Load SEO settings to render brand dynamically
  useEffect(() => {
    fetch('/api/seo').then(r => r.json()).then(d => setSeoSettings(d.settings || {})).catch(() => {})
  }, [])

  const siteName = seoSettings.site_name || 'Portal de Notícias'
  const siteInitials = siteName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  const siteLogo = seoSettings.site_logo || ''

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

  const handleSocial = async (provider: 'google' | 'facebook') => {
    setSocialLoading(provider)
    const fakeName = provider === 'google' ? 'Usuário Google' : 'Usuário Facebook'
    const fakeEmail = `${provider}_${Date.now()}@example.com`
    const fakeId = `${provider}_${Date.now()}`
    const fakeAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fakeName)}&backgroundColor=${provider === 'google' ? '4285F4' : '1877F2'}&textColor=fff`
    try {
      const res = await fetch('/api/auth/social', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, name: fakeName, email: fakeEmail, providerId: fakeId, avatar: fakeAvatar }),
      })
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        setUser(data.user)
        toast({ title: `Login com ${provider === 'google' ? 'Google' : 'Facebook'}!` })
        setView({ name: 'home' })
      }
    } catch (e: any) {
      apiError(e.message)
    } finally {
      setSocialLoading(null)
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-8 sm:py-12 px-4 bg-gradient-to-br from-zinc-50 to-blue-50/30">
      <div className="w-full max-w-md">
        {/* === Card principal === */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden">
          {/* Header com gradiente */}
          <div className="bg-gradient-to-br from-primary to-blue-700 px-6 py-8 text-center text-white">
            <div className="inline-flex items-center gap-2 mb-3">
              {siteLogo ? (
                <img src={siteLogo} alt={siteName} className="h-9 w-auto rounded-lg bg-white/10" />
              ) : (
                <div className="bg-white/20 backdrop-blur text-white text-xl px-2.5 py-1 rounded-lg" style={{ fontWeight: 700 }}>{siteInitials}</div>
              )}
              <span className="text-lg" style={{ fontWeight: 600 }}>{siteName}</span>
            </div>
            <h1 className="text-xl sm:text-2xl mb-1" style={{ fontWeight: 600 }}>
              {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h1>
            <p className="text-blue-100 text-sm">
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

            {/* Social login */}
            <div className="space-y-2 mb-4">
              <Button
                type="button" variant="outline" className="w-full h-10"
                onClick={() => handleSocial('google')}
                disabled={socialLoading !== null}
              >
                {socialLoading === 'google' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="text-sm">Continuar com Google</span>
                  </>
                )}
              </Button>
              <Button
                type="button" variant="outline"
                className="w-full h-10 bg-[#1877F2] hover:bg-[#0d6ae0] text-white border-transparent"
                onClick={() => handleSocial('facebook')}
                disabled={socialLoading !== null}
              >
                {socialLoading === 'facebook' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current mr-2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span className="text-sm">Continuar com Facebook</span>
                  </>
                )}
              </Button>
            </div>

            {/* Divisor */}
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200" /></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-white px-3 text-zinc-400">ou com email</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'register' && (
                <div>
                  <Label htmlFor="name" className="text-xs text-zinc-600">Nome completo</Label>
                  <div className="relative mt-1">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      id="name" type="text" value={name}
                      onChange={(e) => setName(e.target.value)} required
                      placeholder="Seu nome" className="pl-10 h-10"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="email" className="text-xs text-zinc-600">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required
                    placeholder="seu@email.com" className="pl-10 h-10"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs text-zinc-600">Senha</Label>
                  {mode === 'login' && (
                    <button type="button" className="text-[11px] text-primary hover:underline">
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="password" type={showPassword ? 'text' : 'password'}
                    value={password} onChange={(e) => setPassword(e.target.value)} required
                    placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                    className="pl-10 pr-10 h-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
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
                    placeholder="Ex: ADMIN1234" className="mt-1 uppercase h-10"
                  />
                  {referrerName && (
                    <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Indicado por <strong>{referrerName}</strong> — bônus garantido!
                    </p>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full h-10 bg-primary hover:bg-blue-700 mt-1" disabled={loading}>
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
            <div className="text-center text-sm text-zinc-600 mt-5 pt-4 border-t border-zinc-100">
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
