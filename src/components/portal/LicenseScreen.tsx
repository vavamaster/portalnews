'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Lock, AlertCircle, ExternalLink, KeyRound } from 'lucide-react'

interface LicenseScreenProps {
  siteName?: string
  siteLogo?: string
}

export function LicenseScreen({ siteName = 'Portal', siteLogo }: LicenseScreenProps) {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  const siteInitials = siteName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else if (!['MASTER', 'ADMIN'].includes(data.user?.role)) {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
        toast({ title: 'Acesso restrito', description: 'Apenas administradores podem acessar durante a manutenção.', variant: 'destructive' })
      } else {
        window.location.href = '/?view=admin&section=seo'
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 px-4">
      <div className="max-w-md w-full">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          {siteLogo ? (
            <img src={siteLogo} alt={siteName} className="h-16 w-auto rounded mx-auto mb-4 opacity-60" />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-zinc-200 text-zinc-400 flex items-center justify-center font-black text-2xl mx-auto mb-4">
              {siteInitials}
            </div>
          )}
          <h1 className="text-2xl font-bold text-zinc-800">{siteName}</h1>
        </div>

        {/* Maintenance card */}
        <div className="bg-white rounded-2xl shadow-lg border border-zinc-100 overflow-hidden">
          <div className="p-8 text-center">
            {/* Animated icon */}
            <div className="relative mx-auto mb-6 w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-amber-50 animate-ping opacity-20"></div>
              <div className="relative h-20 w-20 rounded-full bg-amber-50 border-2 border-amber-100 flex items-center justify-center">
                <svg className="h-10 w-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
              </div>
            </div>

            <h2 className="text-xl font-bold text-zinc-800 mb-2">
              Estamos preparando algo melhor para você
            </h2>
            <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
              Nossa equipe está trabalhando em melhorias no portal para oferecer a melhor experiência.
              Voltaremos em breve com novidades!
            </p>

            {/* Animated dots */}
            <div className="flex items-center justify-center gap-1.5 mb-6">
              <div className="h-2 w-2 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>

            {/* Admin access — subtle */}
            {!showLogin ? (
              <button
                onClick={() => setShowLogin(true)}
                className="text-xs text-zinc-300 hover:text-zinc-500 transition-colors flex items-center gap-1 mx-auto"
              >
                <Lock className="h-3 w-3" /> Acesso restrito
              </button>
            ) : (
              <form onSubmit={handleAdminLogin} className="mt-4 space-y-3 text-left">
                <div className="bg-zinc-50 rounded-lg p-3 mb-2">
                  <p className="text-xs text-zinc-500 text-center">
                    Área exclusiva para administradores
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                    placeholder="admin@exemplo.com"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Senha</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-zinc-800 hover:bg-zinc-900">
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
                  Acessar painel
                </Button>
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 mx-auto block"
                >
                  Voltar
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-300 mt-6">
          © {new Date().getFullYear()} {siteName}. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}

// Admin panel license warning banner
export function LicenseWarningBanner({ status, message }: { status: string; message: string }) {
  const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
    expired: { label: 'Licença Vencida', color: 'red', icon: AlertCircle },
    suspended: { label: 'Licença Suspensa', color: 'amber', icon: AlertCircle },
    unauthorized_domain: { label: 'Domínio Não Autorizado', color: 'orange', icon: AlertCircle },
    invalid: { label: 'Chave Inválida', color: 'red', icon: AlertCircle },
    mismatch: { label: 'Produto Incorreto', color: 'purple', icon: AlertCircle },
  }

  const info = statusLabels[status] || { label: status, color: 'red', icon: AlertCircle }
  const Icon = info.icon

  return (
    <div className={`bg-${info.color}-50 border border-${info.color}-200 rounded-lg p-4 mb-4`}>
      <div className="flex items-start gap-3">
        <div className={`bg-${info.color}-100 rounded-lg p-2 flex-shrink-0`}>
          <Icon className={`h-5 w-5 text-${info.color}-600`} />
        </div>
        <div className="flex-1">
          <div className={`font-bold text-sm text-${info.color}-900`}>{info.label}</div>
          <p className={`text-xs text-${info.color}-700 mt-0.5`}>{message}</p>
          <div className="mt-2 flex items-center gap-2">
            <a
              href="https://vsagencia.net"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-xs font-medium text-${info.color}-700 hover:underline`}
            >
              <KeyRound className="h-3 w-3" />
              Acessar vsagencia.net para regularizar
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
