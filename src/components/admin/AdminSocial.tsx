'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Loader2, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Download,
  ExternalLink, Search, FileText, Image as ImageIcon, Globe,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const PROVIDERS = [
  { value: 'FACEBOOK', label: 'Facebook', icon: '📘', color: 'blue',
    fields: [
      { key: 'pageId', label: 'Page ID', placeholder: '1234567890' },
      { key: 'pageAccessToken', label: 'Page Access Token', placeholder: 'EAAB...', type: 'password' },
    ],
    docs: 'https://developers.facebook.com/docs/pages-access-tokens',
  },
  { value: 'INSTAGRAM', label: 'Instagram', icon: '📸', color: 'pink',
    fields: [
      { key: 'igUserId', label: 'Instagram Business Account ID', placeholder: '1789...' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'IGQVJ...', type: 'password' },
    ],
    docs: 'https://developers.facebook.com/docs/instagram-api',
  },
  { value: 'TWITTER', label: 'X (Twitter)', icon: '🐦', color: 'sky',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'xxxx' },
      { key: 'apiKeySecret', label: 'API Key Secret', placeholder: 'xxxx', type: 'password' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'xxxx' },
      { key: 'accessTokenSecret', label: 'Access Token Secret', placeholder: 'xxxx', type: 'password' },
    ],
    docs: 'https://developer.twitter.com/en/portal/dashboard',
  },
  { value: 'TELEGRAM', label: 'Telegram', icon: '✈️', color: 'cyan',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF...', type: 'password' },
      { key: 'channelId', label: 'Channel ID', placeholder: '@meucanal ou -100123...' },
    ],
    docs: 'https://core.telegram.org/bots/api',
  },
  { value: 'WHATSAPP', label: 'WhatsApp (Baileys)', icon: '💬', color: 'green',
    fields: [
      { key: 'sessionName', label: 'Session Name', placeholder: 'portal-session' },
    ],
    docs: 'https://github.com/WhiskeySockets/Baileys',
  },
]

export function AdminSocial() {
  const { toast } = useToast()
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
      for (const p of PROVIDERS) {
        const existing = (d.configs || []).find((c: any) => c.provider === p.value)
        const creds = existing ? JSON.parse(existing.credentials || '{}') : {}
        newForms[p.value] = {
          isEnabled: existing?.isEnabled ?? false,
          autoPublish: existing?.autoPublish ?? true,
          ...creds,
        }
      }
      setForms(newForms)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async (provider: string) => {
    const p = PROVIDERS.find(p => p.value === provider)!
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
        autoPublish: formData.autoPublish,
      }),
    })
    const d = await r.json()
    if (d.error) { toast({ title: 'Erro', description: d.error, variant: 'destructive' }) }
    else { toast({ title: `✓ ${p.label} salvo` }); load() }
  }

  if (loading) return <div className="text-zinc-500 flex items-center gap-2 py-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>

  return (
    <div className="space-y-3">
      {/* Provider cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROVIDERS.map(p => {
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
                </div>
              )}
            </div>
          )
        })}
      </div>

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
