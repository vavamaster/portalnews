'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Loader2, Save, RefreshCw, MessageCircle, Phone, Send,
  CheckCircle, XCircle, QrCode, AlertCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function AdminWhatsApp() {
  const { toast } = useToast()
  const [config, setConfig] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    phoneNumber: '', notifyOnPublish: true, notifyOnReview: true, notifyPhone: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/whatsapp')
      const d = await r.json()
      setConfig(d.config)
      setLogs(d.recentLogs || [])
      setForm({
        phoneNumber: d.config?.phoneNumber || '',
        notifyOnPublish: d.config?.notifyOnPublish ?? true,
        notifyOnReview: d.config?.notifyOnReview ?? true,
        notifyPhone: d.config?.notifyPhone || '',
      })
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (d.error) { toast({ title: 'Erro', description: d.error, variant: 'destructive' }) }
      else { toast({ title: '✓ Configuração salva' }); load() }
    } finally { setSaving(false) }
  }

  if (loading) return <div className="text-zinc-500 flex items-center gap-2 py-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>

  return (
    <div className="space-y-3">
      {/* Connection status */}
      <div className={cn('border rounded-lg p-4', config?.isConnected ? 'bg-emerald-50 border-emerald-200' : 'bg-zinc-50 border-zinc-200')}>
        <div className="flex items-center gap-3">
          <div className={cn('h-3 w-3 rounded-full', config?.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400')} />
          <div className="flex-1">
            <div className="font-bold text-sm text-zinc-900">
              {config?.isConnected ? 'WhatsApp Conectado' : 'Desconectado'}
            </div>
            <div className="text-xs text-zinc-500">
              {config?.phoneNumber ? `Chip: ${config.phoneNumber}` : 'Nenhum chip configurado'}
              {config?.sessionName && ` · Sessão: ${config.sessionName}`}
            </div>
          </div>
          {config?.isConnected && <Badge className="bg-emerald-100 text-emerald-700">Online</Badge>}
        </div>
      </div>

      {/* Config form */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
        <Label className="text-sm font-bold">Configuração</Label>

        <div>
          <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Número do chip conectado</Label>
          <Input
            value={form.phoneNumber}
            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
            placeholder="5566999990000"
            className="h-8 text-xs mt-1"
          />
          <p className="text-[10px] text-zinc-400 mt-0.5">Número que está conectado via Baileys (com DDI + DDD, sem + ou espaços)</p>
        </div>

        <div>
          <Label className="text-xs flex items-center gap-1"><Send className="h-3 w-3" /> Número para receber notificações</Label>
          <Input
            value={form.notifyPhone}
            onChange={(e) => setForm({ ...form, notifyPhone: e.target.value })}
            placeholder="5566999990000 (deixe vazio para usar o mesmo chip)"
            className="h-8 text-xs mt-1"
          />
          <p className="text-[10px] text-zinc-400 mt-0.5">Pode ser diferente do chip conectado (ex: número do admin)</p>
        </div>

        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={form.notifyOnPublish} onCheckedChange={v => setForm({ ...form, notifyOnPublish: v })} />
            <span className="text-xs">Notificar quando IA publicar matéria (auto-publish)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={form.notifyOnReview} onCheckedChange={v => setForm({ ...form, notifyOnReview: v })} />
            <span className="text-xs">Notificar quando matéria aguardar aprovação</span>
          </label>
        </div>

        <Button onClick={save} disabled={saving} className="bg-primary h-8 text-xs">
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
          Salvar
        </Button>
      </div>

      {/* Baileys setup info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Como conectar o chip (Baileys):</strong>
            <ol className="list-decimal list-inside mt-1 space-y-0.5">
              <li>Instale Baileys: <code className="bg-blue-100 px-1 rounded">npm install @whiskeysockets/baileys</code></li>
              <li>Rode um processo separado que mantém a conexão WhatsApp ativa</li>
              <li>Escaneie o QR Code com o chip que será usado</li>
              <li>O processo Baileys envia mensagens quando o portal chama via API</li>
              <li>Configure o número do chip e o número de notificação acima</li>
            </ol>
            <p className="mt-1">O sistema já está preparado para enviar notificações com título da matéria, excerpt e link (com OG Graph).</p>
          </div>
        </div>
      </div>

      {/* Recent logs */}
      {logs.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-lg p-3">
          <Label className="text-xs font-bold mb-2 block">Notificações recentes ({logs.length})</Label>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {logs.map(l => (
              <div key={l.id} className="flex items-start gap-2 text-xs border border-zinc-100 rounded p-2">
                <span className={cn('flex-shrink-0 mt-0.5', l.type === 'ERROR' ? 'text-red-500' : l.type === 'NOTIFICATION' ? 'text-emerald-500' : 'text-zinc-400')}>
                  {l.type === 'ERROR' ? <XCircle className="h-3 w-3" /> : l.type === 'NOTIFICATION' ? <CheckCircle className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-zinc-700 line-clamp-2">{l.message}</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">{l.phoneNumber} · {new Date(l.createdAt).toLocaleString('pt-BR')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
