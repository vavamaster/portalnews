'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { Save, Loader2, Check, AlertCircle, CreditCard, Zap, Globe } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { useApiError } from '@/hooks/use-api-error'

interface Gateway {
  provider: string
  displayName: string
  apiKey: string
  secretKey: string
  webhookSecret: string
  accessToken: string
  publicKey: string
  isSandbox: boolean
  isEnabled: boolean
  isDefault: boolean
  acceptsPix: boolean
  acceptsBoleto: boolean
  acceptsCreditCard: boolean
}

const PROVIDER_INFO: Record<string, { icon: any; color: string; docs: string }> = {
  ASAAS: { icon: Zap, color: 'bg-blue-500', docs: 'https://docs.asaas.com' },
  MERCADO_PAGO: { icon: Globe, color: 'bg-cyan-500', docs: 'https://www.mercadopago.com.br/developers' },
  STRIPE: { icon: CreditCard, color: 'bg-purple-500', docs: 'https://stripe.com/docs' },
}

export function AdminGateways() {
  const { toast } = useToast()
  const apiError = useApiError()
  const [gateways, setGateways] = useState<Gateway[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/gateways')
      const data = await res.json()
      setGateways(data.gateways || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const handleSave = async (gw: Gateway) => {
    setSaving(gw.provider)
    try {
      const res = await fetch('/api/admin/gateways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gw),
      })
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        toast({ title: `${gw.displayName} salvo!` })
        load()
      }
    } finally {
      setSaving(null)
    }
  }

  const update = (provider: string, field: string, value: any) => {
    setGateways(prev => prev.map(g => g.provider === provider ? { ...g, [field]: value } : g))
  }

  if (loading) return <LoadingSpinner label="Carregando gateways..." className="py-0" />

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          Configure pelo menos um gateway de pagamento para habilitar cobranças reais.
          Sem gateway configurado, o sistema opera em modo demo (pagamentos simulados).
          Os webhooks são chamados automaticamente pelo gateway quando o pagamento é confirmado.
        </div>
      </div>

      {gateways.map(gw => {
        const info = PROVIDER_INFO[gw.provider] || PROVIDER_INFO.ASAAS
        const Icon = info.icon
        return (
          <div key={gw.provider} className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-white', info.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-zinc-900 text-sm" style={{ fontWeight: 600 }}>{gw.displayName}</div>
                  <div className="text-xs text-zinc-500">{gw.provider}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {gw.isEnabled && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-700" style={{ fontWeight: 600 }}>
                    Ativo
                  </span>
                )}
                {gw.isDefault && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700" style={{ fontWeight: 600 }}>
                    Padrão
                  </span>
                )}
                {gw.isSandbox && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-700" style={{ fontWeight: 600 }}>
                    Sandbox
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3">
              {/* Toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Toggle label="Ativo" checked={gw.isEnabled} onChange={(v) => update(gw.provider, 'isEnabled', v)} />
                <Toggle label="Padrão" checked={gw.isDefault} onChange={(v) => update(gw.provider, 'isDefault', v)} />
                <Toggle label="Sandbox" checked={gw.isSandbox} onChange={(v) => update(gw.provider, 'isSandbox', v)} />
                <Toggle label="PIX" checked={gw.acceptsPix} onChange={(v) => update(gw.provider, 'acceptsPix', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Toggle label="Boleto" checked={gw.acceptsBoleto} onChange={(v) => update(gw.provider, 'acceptsBoleto', v)} />
                <Toggle label="Cartão" checked={gw.acceptsCreditCard} onChange={(v) => update(gw.provider, 'acceptsCreditCard', v)} />
              </div>

              {/* API fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {gw.provider === 'ASAAS' && (
                  <Field label="API Key (access_token)" value={gw.apiKey} onChange={(v) => update(gw.provider, 'apiKey', v)} placeholder="$aact_..." type="password" />
                )}
                {gw.provider === 'MERCADO_PAGO' && (
                  <>
                    <Field label="Access Token" value={gw.accessToken} onChange={(v) => update(gw.provider, 'accessToken', v)} placeholder="APP_USR-..." type="password" />
                    <Field label="Public Key" value={gw.publicKey} onChange={(v) => update(gw.provider, 'publicKey', v)} placeholder="APP_USR-..." />
                  </>
                )}
                {gw.provider === 'STRIPE' && (
                  <>
                    <Field label="Secret Key" value={gw.secretKey} onChange={(v) => update(gw.provider, 'secretKey', v)} placeholder="sk_live_..." type="password" />
                    <Field label="Public Key" value={gw.publicKey} onChange={(v) => update(gw.provider, 'publicKey', v)} placeholder="pk_live_..." />
                  </>
                )}
                <Field label="Webhook Secret" value={gw.webhookSecret} onChange={(v) => update(gw.provider, 'webhookSecret', v)} placeholder="whsec_..." type="password" />
              </div>

              {/* Webhook URL */}
              <div className="bg-zinc-50 rounded-lg p-3 text-xs">
                <div className="text-zinc-500 mb-1">URL do webhook:</div>
                <code className="text-zinc-700 break-all">
                  {typeof window !== 'undefined' ? window.location.origin : 'https://[seu-dominio]'}/api/webhooks/{gw.provider.toLowerCase().replace('_', '')}
                </code>
              </div>

              {/* Save */}
              <div className="flex items-center justify-between pt-2">
                <a href={info.docs} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                  Documentação oficial →
                </a>
                <Button onClick={() => handleSave(gw)} disabled={saving === gw.provider} size="sm" className="bg-primary">
                  {saving === gw.provider ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-zinc-50 rounded-lg px-3 py-2">
      <span className="text-xs text-zinc-700">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <Label className="text-xs text-zinc-600">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-9 text-sm"
      />
    </div>
  )
}
