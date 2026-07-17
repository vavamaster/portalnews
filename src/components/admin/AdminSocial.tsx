'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import {
  ExternalLink, LogIn, Send,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/ui/skeleton'

interface ProviderField {
  key: string
  label: string
  placeholder: string
  type?: string
  description?: string
}

interface ProviderDefinition {
  value: string
  label: string
  icon: string
  fields: ProviderField[]
  docs: string
  kind: 'login' | 'publish'
  color?: string
  note?: string
}

const OAUTH_PROVIDERS: ProviderDefinition[] = [
  {
    value: 'GOOGLE_LOGIN',
    label: 'Login com Google',
    icon: 'G',
    kind: 'login',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: '000000000000-xxxx.apps.googleusercontent.com' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'GOCSPX-...', type: 'password' },
      {
        key: 'redirectUri',
        label: 'URL de callback',
        placeholder: 'https://seu-dominio.com/api/auth/social/google/callback',
        description: 'Cadastre exatamente esta URL no Google Cloud.',
      },
    ],
    docs: 'https://developers.google.com/identity/protocols/oauth2/web-server',
  },
  {
    value: 'FACEBOOK_LOGIN',
    label: 'Login com Facebook',
    icon: 'f',
    kind: 'login',
    fields: [
      { key: 'appId', label: 'App ID', placeholder: '123456789012345' },
      { key: 'appSecret', label: 'App Secret', placeholder: 'Chave secreta do aplicativo', type: 'password' },
      {
        key: 'redirectUri',
        label: 'URL de callback',
        placeholder: 'https://seu-dominio.com/api/auth/social/facebook/callback',
        description: 'Cadastre exatamente esta URL em URIs de redirecionamento OAuth válidos.',
      },
      {
        key: 'graphVersion',
        label: 'Versão da Graph API (opcional)',
        placeholder: 'Ex.: v25.0',
        description: 'Se vazio, será usada a versão padrão configurada no aplicativo Meta.',
      },
    ],
    docs: 'https://developers.facebook.com/docs/facebook-login/',
  },
]

const PUBLISH_PROVIDERS: ProviderDefinition[] = [
  { value: 'FACEBOOK', label: 'Facebook', icon: '📘', color: 'blue',
    kind: 'publish',
    fields: [
      { key: 'pageId', label: 'Page ID', placeholder: '1234567890' },
      { key: 'pageAccessToken', label: 'Page Access Token', placeholder: 'EAAB...', type: 'password' },
    ],
    docs: 'https://developers.facebook.com/docs/pages-access-tokens',
  },
  { value: 'INSTAGRAM', label: 'Instagram', icon: '📸', color: 'pink',
    kind: 'publish',
    fields: [
      { key: 'igUserId', label: 'Instagram Business Account ID', placeholder: '1789...' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'IGQVJ...', type: 'password' },
    ],
    docs: 'https://developers.facebook.com/docs/instagram-api',
  },
  { value: 'TWITTER', label: 'X (Twitter)', icon: '🐦', color: 'sky',
    kind: 'publish',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'xxxx' },
      { key: 'apiKeySecret', label: 'API Key Secret', placeholder: 'xxxx', type: 'password' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'xxxx' },
      { key: 'accessTokenSecret', label: 'Access Token Secret', placeholder: 'xxxx', type: 'password' },
    ],
    docs: 'https://developer.twitter.com/en/portal/dashboard',
  },
  { value: 'TELEGRAM', label: 'Telegram', icon: '✈️', color: 'cyan',
    kind: 'publish',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF...', type: 'password' },
      { key: 'channelId', label: 'Channel ID', placeholder: '@meucanal ou -100123...' },
    ],
    docs: 'https://core.telegram.org/bots/api',
  },
  { value: 'WHATSAPP', label: 'WhatsApp (Baileys)', icon: '💬', color: 'green',
    kind: 'publish',
    fields: [], // WhatsApp is configured in the dedicated WhatsApp section (AdminWhatsApp)
    docs: '/admin?section=whatsapp',
    note: 'WhatsApp é configurado na seção dedicada "WhatsApp" do painel admin, com QR code, anti-bloqueio, disparos em massa e inscrição de usuários. Clique em "Abrir WhatsApp" para acessar.',
  },
]

const ALL_PROVIDERS = [...OAUTH_PROVIDERS, ...PUBLISH_PROVIDERS]

export function AdminSocial() {
  const { toast } = useToast()
  const { setView } = useAppStore()
  const [configs, setConfigs] = useState<any[]>([])
  const [recentPosts, setRecentPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, any>>({})

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/social')
      const d = await r.json()
      setConfigs(d.configs || [])
      setRecentPosts(d.recentPosts || [])
      // Initialize forms
      const newForms: Record<string, any> = {}
      for (const p of ALL_PROVIDERS) {
        const existing = (d.configs || []).find((c: any) => c.provider === p.value)
        let creds: Record<string, string> = {}
        try { creds = existing ? JSON.parse(existing.credentials || '{}') : {} } catch {}
        const slug = p.value === 'GOOGLE_LOGIN' ? 'google' : p.value === 'FACEBOOK_LOGIN' ? 'facebook' : ''
        const defaultRedirectUri = slug && typeof window !== 'undefined'
          ? `${window.location.origin}/api/auth/social/${slug}/callback`
          : ''
        newForms[p.value] = {
          isEnabled: existing?.isEnabled ?? false,
          autoPublish: p.kind === 'publish' ? existing?.autoPublish ?? true : false,
          ...creds,
          redirectUri: creds.redirectUri || defaultRedirectUri,
        }
      }
      setForms(newForms)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const save = async (provider: string) => {
    const p = ALL_PROVIDERS.find(p => p.value === provider)!
    const formData = forms[provider] || {}
    const credentials: Record<string, string> = {}
    for (const f of p.fields) {
      credentials[f.key] = formData[f.key] || ''
    }

    const r = await fetch('/api/admin/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        displayName: p.label,
        credentials,
        isEnabled: formData.isEnabled,
        autoPublish: p.kind === 'publish' ? formData.autoPublish : false,
      }),
    })
    const d = await r.json()
    if (d.error) { toast({ title: 'Erro', description: d.error, variant: 'destructive' }) }
    else { toast({ title: `✓ ${p.label} salvo` }); load() }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <LogIn className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Login social do portal</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">
              Estas credenciais controlam os botões Google e Facebook exibidos para leitores na tela de entrada.
              As URLs de callback precisam ser cadastradas exatamente nos consoles dos provedores.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {OAUTH_PROVIDERS.map(p => {
            const formData = forms[p.value] || {}
            const isEnabled = formData.isEnabled ?? false
            return (
              <div key={p.value} className={cn(
                'rounded-xl border bg-white p-4 transition-colors',
                isEnabled ? 'border-emerald-300 shadow-sm' : 'border-zinc-200',
              )}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full text-base font-bold',
                      p.value === 'GOOGLE_LOGIN'
                        ? 'border border-zinc-200 bg-white text-[#4285F4]'
                        : 'bg-[#1877F2] text-white',
                    )}>{p.icon}</span>
                    <div>
                      <div className="text-sm font-bold text-zinc-900">{p.label}</div>
                      <div className={cn('text-[10px]', isEnabled ? 'text-emerald-700' : 'text-zinc-400')}>
                        {isEnabled ? 'Ativado no portal' : 'Desativado'}
                      </div>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(event) => setForms({
                        ...forms,
                        [p.value]: { ...formData, isEnabled: event.target.checked },
                      })}
                      className="rounded"
                    />
                    <span className="text-xs text-zinc-600">Ativar</span>
                  </label>
                </div>

                <div className="space-y-2.5">
                  {p.fields.map(field => (
                    <div key={field.key}>
                      <Label className="text-xs">{field.label}</Label>
                      <Input
                        type={field.type || 'text'}
                        value={formData[field.key] || ''}
                        onChange={(event) => setForms({
                          ...forms,
                          [p.value]: { ...formData, [field.key]: event.target.value },
                        })}
                        placeholder={field.placeholder}
                        className="h-9 text-xs"
                        spellCheck={false}
                      />
                      {field.description && <p className="mt-1 text-[10px] text-zinc-500">{field.description}</p>}
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <a
                      href={p.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Documentação oficial
                    </a>
                    <Button size="sm" onClick={() => save(p.value)} className="h-8 px-4 text-xs">
                      Salvar configuração
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Send className="h-4 w-4 text-purple-600" />
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Publicação automática</h3>
            <p className="text-[11px] text-zinc-500">Integrações usadas para distribuir matérias publicadas pelo portal.</p>
          </div>
        </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PUBLISH_PROVIDERS.map(p => {
          const config = configs.find(c => c.provider === p.value)
          const formData = forms[p.value] || {}
          const isEnabled = formData.isEnabled ?? false

          return (
            <div key={p.value} className={cn('border rounded-lg p-4 transition-colors', isEnabled ? 'border-emerald-200 bg-emerald-50/30' : 'border-zinc-200 bg-white')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.icon}</span>
                  <div>
                    <div className="font-bold text-sm text-zinc-900">{p.label}</div>
                    <div className="text-[10px] text-zinc-400">
                      {isEnabled ? '✓ Ativado' : 'Desativado'}
                      {config?.autoPublish && isEnabled ? ' · Auto-publicar' : ''}
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setForms({ ...forms, [p.value]: { ...formData, isEnabled: e.target.checked } })}
                    className="rounded"
                  />
                  <span className="text-xs text-zinc-600">Ativar</span>
                </label>
              </div>

              {isEnabled && (
                <div className="space-y-2">
                  {/* Special case: WhatsApp has no fields here — config is in dedicated section */}
                  {p.fields.length === 0 ? (
                    <>
                      {p.note && (
                        <p className="text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded p-2">
                          {p.note}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs w-full"
                        onClick={() => setView({ name: 'admin', section: 'whatsapp' as any })}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir WhatsApp
                      </Button>
                    </>
                  ) : (
                    <>
                      {p.fields.map(f => (
                        <div key={f.key}>
                          <Label className="text-xs">{f.label}</Label>
                          <Input
                            type={f.type || 'text'}
                            value={formData[f.key] || ''}
                            onChange={(e) => setForms({ ...forms, [p.value]: { ...formData, [f.key]: e.target.value } })}
                            placeholder={f.placeholder}
                            className="h-8 text-xs"
                          />
                          {f.description && <p className="mt-1 text-[10px] text-zinc-500">{f.description}</p>}
                        </div>
                      ))}
                      <label className="flex items-center gap-1.5 cursor-pointer mt-2">
                        <input
                          type="checkbox"
                          checked={formData.autoPublish ?? true}
                          onChange={(e) => setForms({ ...forms, [p.value]: { ...formData, autoPublish: e.target.checked } })}
                          className="rounded"
                        />
                        <span className="text-xs text-zinc-600">Publicar automaticamente quando matéria for publicada</span>
                      </label>
                      <div className="flex items-center justify-between mt-2">
                        <a href={p.docs} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Como obter credenciais
                        </a>
                        <Button size="sm" onClick={() => save(p.value)} className="h-7 text-xs bg-primary">Salvar</Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      </section>

      {/* Recent social posts */}
      {recentPosts.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-lg p-3">
          <Label className="text-xs font-bold mb-2 block">Publicações recentes ({recentPosts.length})</Label>
          <div className="space-y-1">
            {recentPosts.map(sp => (
              <div key={sp.id} className="flex items-center gap-2 text-xs border border-zinc-100 rounded p-2">
                <span className="font-medium text-zinc-900 truncate flex-1">{sp.post?.title || '—'}</span>
                <Badge variant="outline" className="text-[9px]">{sp.provider}</Badge>
                <Badge variant="outline" className={cn('text-[9px]', sp.status === 'PUBLISHED' ? 'text-emerald-700' : sp.status === 'FAILED' ? 'text-red-700' : 'text-amber-700')}>{sp.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
