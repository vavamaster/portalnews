'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn, formatDate } from '@/lib/utils'
import {
  Loader2, Save, RefreshCw, MessageCircle, Phone, Send,
  CheckCircle, XCircle, QrCode, AlertCircle, Power, PowerOff,
  Inbox, Search, Image as ImageIcon, ArrowLeft,
  Plus, Megaphone, Users, ListChecks, ShieldCheck, Pause, Play, X,
  Upload, Eye, Info,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type Status = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'NEED_QR' | 'ERROR'

interface Config {
  id: string
  phoneNumber: string
  sessionName: string
  isConnected: boolean
  connectionStatus: string
  qrCode: string | null
  qrCodeExpiresAt: string | null
  waUserId: string | null
  platform: string | null
  notifyOnPublish: boolean
  notifyOnReview: boolean
  notifyOnLead: boolean
  notifyPhone: string | null
  lastConnectedAt: string | null
  liveStatus?: Status
  liveQrCode?: string | null
}

interface Log {
  id: string
  type: string
  phoneNumber: string | null
  message: string
  createdAt: string
}

interface Contact {
  id: string
  jid: string
  phoneNumber: string
  name: string | null
  pushName: string | null
  profilePicUrl: string | null
  lastMessageAt: string | null
  lastMessage: { body: string | null; type: string; createdAt: string } | null
}

interface Message {
  id: string
  jid: string
  direction: string
  type: string
  body: string | null
  mediaUrl: string | null
  isFromMe: boolean
  status: string
  createdAt: string
}

type Tab = 'settings' | 'inbox' | 'logs' | 'campaigns' | 'subscribers' | 'lists' | 'antiblock'

export function AdminWhatsApp() {
  const { toast } = useToast()
  const [config, setConfig] = useState<Config | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('settings')
  const [form, setForm] = useState<any>({
    phoneNumber: '', notifyOnPublish: true, notifyOnReview: true, notifyOnLead: true, notifyPhone: '',
  })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/whatsapp')
      const d = await r.json()
      setConfig(d.config)
      setLogs(d.recentLogs || [])
      setForm({
        phoneNumber: d.config?.phoneNumber || '',
        notifyOnPublish: d.config?.notifyOnPublish ?? true,
        notifyOnReview: d.config?.notifyOnReview ?? true,
        notifyOnLead: d.config?.notifyOnLead ?? true,
        notifyPhone: d.config?.notifyPhone || '',
      })
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Initial load
  useEffect(() => {
    const id = window.setTimeout(() => { load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  // Poll for status updates every 3s when on settings tab (for QR code + connection status)
  useEffect(() => {
    if (activeTab !== 'settings') {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch('/api/admin/whatsapp')
        const d = await r.json()
        setConfig(d.config)
        setLogs(d.recentLogs || [])
      } catch {}
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeTab])

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', ...form }),
      })
      const d = await r.json()
      if (d.error) { toast({ title: 'Erro', description: d.error, variant: 'destructive' }) }
      else { toast({ title: '✓ Configuração salva' }); load() }
    } finally { setSaving(false) }
  }

  const connect = async () => {
    setConnecting(true)
    try {
      const r = await fetch('/api/admin/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' }),
      })
      const d = await r.json()
      if (d.error) { toast({ title: 'Erro ao conectar', description: d.error, variant: 'destructive' }) }
      else {
        toast({ title: 'Conectando...', description: d.status === 'NEED_QR' ? 'Escaneie o QR code' : 'Aguarde a conexão' })
        load()
      }
    } finally { setConnecting(false) }
  }

  const disconnect = async () => {
    setConnecting(true)
    try {
      const r = await fetch('/api/admin/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      const d = await r.json()
      if (d.error) { toast({ title: 'Erro', description: d.error, variant: 'destructive' }) }
      else { toast({ title: '✓ Desconectado' }); load() }
    } finally { setConnecting(false) }
  }

  const resetSession = async () => {
    if (!window.confirm('Remover a sessao atual e conectar outro WhatsApp? O proximo conectar vai gerar um novo QR Code.')) return
    setConnecting(true)
    try {
      const r = await fetch('/api/admin/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
      const d = await r.json()
      if (d.error || !d.ok) { toast({ title: 'Erro', description: d.error || 'Nao foi possivel trocar a sessao', variant: 'destructive' }) }
      else { toast({ title: 'Sessao removida', description: 'Clique em Conectar para gerar um novo QR Code.' }); load() }
    } finally { setConnecting(false) }
  }

  if (loading) return <div className="text-zinc-500 flex items-center gap-2 py-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>

  const liveStatus: Status = (config?.liveStatus as Status) || (config?.connectionStatus as Status) || 'DISCONNECTED'
  const liveQr = config?.liveQrCode || config?.qrCode
  const qrExpired = config?.qrCodeExpiresAt ? new Date(config.qrCodeExpiresAt) < new Date() : false
  const isConnected = liveStatus === 'CONNECTED'
  const isConnecting = liveStatus === 'CONNECTING' || connecting
  const needsQr = liveStatus === 'NEED_QR' && liveQr && !qrExpired
  const hasSavedSession = Boolean(config?.phoneNumber || config?.waUserId)

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 overflow-x-auto">
        {[
          { id: 'settings' as Tab, label: 'Configuração', icon: Phone },
          { id: 'inbox' as Tab, label: 'Caixa de Entrada', icon: Inbox },
          { id: 'campaigns' as Tab, label: 'Disparos', icon: Megaphone },
          { id: 'subscribers' as Tab, label: 'Inscritos', icon: Users },
          { id: 'lists' as Tab, label: 'Listas', icon: ListChecks },
          { id: 'antiblock' as Tab, label: 'Anti-bloqueio', icon: ShieldCheck },
          { id: 'logs' as Tab, label: 'Logs', icon: MessageCircle },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.id === 'inbox' && contacts.length > 0 && (
              <span className="ml-1 bg-zinc-100 text-zinc-600 text-[10px] rounded-full px-1.5 py-0.5">{contacts.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'settings' && (
        <>
          {/* Connection status */}
          <div className={cn(
            'border rounded-lg p-4',
            isConnected ? 'bg-emerald-50 border-emerald-200' :
            needsQr ? 'bg-amber-50 border-amber-200' :
            liveStatus === 'ERROR' ? 'bg-red-50 border-red-200' :
            'bg-zinc-50 border-zinc-200'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-3 w-3 rounded-full',
                isConnected ? 'bg-emerald-500 animate-pulse' :
                isConnecting ? 'bg-amber-500 animate-pulse' :
                liveStatus === 'ERROR' ? 'bg-red-500' :
                'bg-zinc-400'
              )} />
              <div className="flex-1">
                <div className="font-bold text-sm text-zinc-900">
                  {isConnected ? 'WhatsApp Conectado' :
                   needsQr ? 'Escaneie o QR Code' :
                   isConnecting ? 'Conectando...' :
                   liveStatus === 'ERROR' ? 'Erro de conexão' :
                   'Desconectado'}
                </div>
                <div className="text-xs text-zinc-500">
                  {config?.phoneNumber ? `Chip: ${config.phoneNumber}` : 'Nenhum chip configurado'}
                  {config?.waUserId && ` · JID: ${config.waUserId}`}
                  {config?.platform && ` · ${config.platform}`}
                  {config?.lastConnectedAt && ` · Última conexão: ${formatDate(config.lastConnectedAt, 'datetime')}`}
                </div>
              </div>
              <div className="flex gap-1.5">
                {isConnected ? (
                  <>
                    <Button size="sm" variant="outline" onClick={disconnect} disabled={isConnecting}>
                      <PowerOff className="h-3.5 w-3.5 mr-1" /> Desconectar
                    </Button>
                    <Button size="sm" variant="outline" onClick={resetSession} disabled={isConnecting} className="text-red-700 border-red-200 hover:bg-red-50">
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Trocar WhatsApp
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={connect} disabled={isConnecting} className="bg-emerald-600 hover:bg-emerald-700">
                      {isConnecting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Power className="h-3.5 w-3.5 mr-1" />}
                      Conectar
                    </Button>
                    {hasSavedSession && (
                      <Button size="sm" variant="outline" onClick={resetSession} disabled={isConnecting}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Trocar WhatsApp
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* QR code display */}
            {needsQr && (
              <div className="mt-4 pt-4 border-t border-amber-200 flex flex-col items-center">
                <div className="text-xs font-bold text-amber-900 mb-2 flex items-center gap-1.5">
                  <QrCode className="h-4 w-4" /> Escaneie o QR Code com seu WhatsApp
                </div>
                <div className="bg-white p-3 rounded-lg border border-amber-300">
                  <img src={liveQr!} alt="QR Code" className="w-64 h-64" />
                </div>
                <p className="text-[11px] text-amber-800 mt-2">
                  WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho
                </p>
                <p className="text-[10px] text-amber-700 mt-1">
                  O QR code expira em ~60s. Se expirar, clique em "Conectar" novamente.
                </p>
              </div>
            )}

            {/* Error display */}
            {liveStatus === 'ERROR' && (
              <div className="mt-3 text-xs text-red-800 bg-red-100 rounded p-2">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Erro de conexão. Verifique os logs abaixo. Tentativas de reconexão são automáticas (máx 5).
              </div>
            )}
          </div>

          {/* Config form */}
          <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
            <Label className="text-sm font-bold">Configuração de Notificações</Label>

            <div>
              <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Número do chip conectado</Label>
              <Input
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                placeholder="5566999990000"
                className="h-8 text-xs mt-1"
              />
              <p className="text-[10px] text-zinc-400 mt-0.5">Número que está conectado via Baileys (com DDI + DDD, sem + ou espaços). Preenchido automaticamente ao conectar.</p>
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
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={form.notifyOnLead} onCheckedChange={v => setForm({ ...form, notifyOnLead: v })} />
                <span className="text-xs">Notificar quando classificado receber mensagem</span>
              </label>
            </div>

            <Button onClick={save} disabled={saving} className="bg-primary h-8 text-xs">
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Salvar
            </Button>
          </div>

          {/* Test send */}
          <TestSendPanel isConnected={isConnected} />

          {/* Setup help */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Como funciona:</strong>
                <ol className="list-decimal list-inside mt-1 space-y-0.5">
                  <li>Clique em <strong>Conectar</strong> — um QR code será exibido acima</li>
                  <li>Abra o <strong>WhatsApp</strong> no celular que será usado como chip do portal</li>
                  <li>Vá em <strong>Configurações → Aparelhos conectados → Conectar aparelho</strong></li>
                  <li>Escaneie o QR code exibido aqui</li>
                  <li>O status muda para <strong>Conectado</strong> em alguns segundos</li>
                  <li>Configure o número para receber notificações (acima) e salve</li>
                </ol>
                <p className="mt-2 text-[11px] text-blue-700">
                  ⚠️ O chip conectado não pode estar conectado em outro WhatsApp Web simultaneamente.
                  Em produção (serverless), o Baileys precisa rodar em processo separado persistente.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'inbox' && (
        <InboxPanel contacts={contacts} setContacts={setContacts} isConnected={isConnected} />
      )}

      {activeTab === 'campaigns' && <CampaignsPanel />}
      {activeTab === 'subscribers' && <SubscribersPanel />}
      {activeTab === 'lists' && <ListsPanel />}
      {activeTab === 'antiblock' && <AntiBlockPanel />}

      {activeTab === 'logs' && (
        <div className="bg-white border border-zinc-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-bold">Logs recentes ({logs.length})</Label>
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3 w-3" /></Button>
          </div>
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">Nenhum log ainda</p>
            ) : logs.map(l => (
              <div key={l.id} className="flex items-start gap-2 text-xs border border-zinc-100 rounded p-2">
                <span className={cn('flex-shrink-0 mt-0.5',
                  l.type === 'ERROR' ? 'text-red-500' :
                  l.type === 'NOTIFICATION' ? 'text-emerald-500' :
                  l.type === 'MESSAGE_RECEIVED' ? 'text-blue-500' :
                  l.type === 'MESSAGE_SENT' ? 'text-purple-500' :
                  l.type === 'CONNECTION' ? 'text-amber-500' :
                  l.type === 'QR' ? 'text-cyan-500' :
                  'text-zinc-400'
                )}>
                  {l.type === 'ERROR' ? <XCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{l.type}</Badge>
                    {l.phoneNumber && <span className="text-[10px] text-zinc-500">{l.phoneNumber}</span>}
                  </div>
                  <div className="text-zinc-700 line-clamp-2 mt-0.5">{l.message}</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">{formatDate(l.createdAt, 'datetime')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// === Test Send Panel ===
function TestSendPanel({ isConnected }: { isConnected: boolean }) {
  const { toast } = useToast()
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!to || (!message && !imageUrl)) {
      toast({ title: 'Preencha destinatário e mensagem', variant: 'destructive' })
      return
    }
    setSending(true)
    try {
      const r = await fetch('/api/admin/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', to, message, imageUrl: imageUrl || undefined }),
      })
      const d = await r.json()
      if (d.error || !d.success) {
        toast({ title: 'Erro ao enviar', description: d.error || 'Falha', variant: 'destructive' })
      } else {
        toast({ title: '✓ Mensagem enviada!' })
        setMessage('')
        setImageUrl('')
      }
    } finally { setSending(false) }
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
      <Label className="text-sm font-bold flex items-center gap-1.5">
        <Send className="h-3.5 w-3.5" /> Enviar mensagem de teste
      </Label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-1">
          <Label className="text-[10px]">Destinatário</Label>
          <Input value={to} onChange={e => setTo(e.target.value)} placeholder="5566999990000" className="h-8 text-xs" disabled={!isConnected} />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[10px]">Mensagem</Label>
          <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Olá! Mensagem de teste do portal." className="h-8 text-xs" disabled={!isConnected} />
        </div>
      </div>
      <div>
        <Label className="text-[10px] flex items-center gap-1"><ImageIcon className="h-3 w-3" /> URL da imagem (opcional)</Label>
        <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="h-8 text-xs" disabled={!isConnected} />
      </div>
      <Button onClick={send} disabled={!isConnected || sending} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
        {sending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
        Enviar
      </Button>
      {!isConnected && <p className="text-[10px] text-zinc-400 mt-1">Conecte o WhatsApp para habilitar o envio</p>}
    </div>
  )
}

// === Inbox Panel ===
function InboxPanel({ contacts, setContacts, isConnected }: {
  contacts: Contact[]
  setContacts: (c: Contact[]) => void
  isConnected: boolean
}) {
  const { toast } = useToast()
  const [selectedJid, setSelectedJid] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  const loadContacts = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/whatsapp?include=contacts')
      const d = await r.json()
      setContacts(d.contacts || [])
    } catch {}
  }, [setContacts])

  useEffect(() => { loadContacts() }, [loadContacts])

  const openThread = async (jid: string) => {
    setSelectedJid(jid)
    setLoadingMessages(true)
    try {
      const r = await fetch(`/api/admin/whatsapp?include=messages&jid=${encodeURIComponent(jid)}`)
      const d = await r.json()
      setMessages(d.messages || [])
    } finally { setLoadingMessages(false) }
  }

  const sendReply = async () => {
    if (!selectedJid || !reply.trim()) return
    setSending(true)
    try {
      const r = await fetch('/api/admin/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', to: selectedJid, message: reply }),
      })
      const d = await r.json()
      if (d.success) {
        toast({ title: '✓ Enviada' })
        setReply('')
        // Refresh thread
        await openThread(selectedJid)
        await loadContacts()
      } else {
        toast({ title: 'Erro', description: d.error, variant: 'destructive' })
      }
    } finally { setSending(false) }
  }

  const filteredContacts = contacts.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.phoneNumber.includes(q) ||
           (c.name || '').toLowerCase().includes(q) ||
           (c.pushName || '').toLowerCase().includes(q)
  })

  if (!isConnected && contacts.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center">
        <Inbox className="h-10 w-10 text-zinc-300 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">Conecte o WhatsApp para ver mensagens recebidas</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex" style={{ height: '600px' }}>
      {/* Contacts list */}
      <div className={cn('border-r border-zinc-100 flex flex-col', selectedJid ? 'w-1/3' : 'w-full')}>
        <div className="p-2 border-b border-zinc-100">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contato..." className="h-8 text-xs pl-7" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <p className="text-xs text-zinc-400 p-4 text-center">Nenhuma conversa ainda</p>
          ) : filteredContacts.map(c => (
            <button
              key={c.id}
              onClick={() => openThread(c.jid)}
              className={cn(
                'w-full flex items-start gap-2 p-2 hover:bg-zinc-50 border-b border-zinc-50 text-left',
                selectedJid === c.jid && 'bg-blue-50'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-[11px] font-bold text-zinc-700 flex-shrink-0">
                {(c.name || c.pushName || c.phoneNumber)?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-zinc-900 truncate">{c.name || c.pushName || c.phoneNumber}</span>
                  {c.lastMessageAt && (
                    <span className="text-[9px] text-zinc-400 flex-shrink-0">
                      {formatDate(c.lastMessageAt, 'time')}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-500 line-clamp-1">
                  {c.lastMessage?.body || `[${c.lastMessage?.type || '...'}]`}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Message thread */}
      {selectedJid && (
        <div className="flex-1 flex flex-col">
          <div className="p-2 border-b border-zinc-100 flex items-center gap-2">
            <button onClick={() => setSelectedJid(null)} className="sm:hidden">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold">{selectedJid.split('@')[0]}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-zinc-50">
            {loadingMessages ? (
              <div className="text-center text-xs text-zinc-400 py-4"><Loader2 className="h-4 w-4 animate-spin inline" /> Carregando...</div>
            ) : messages.length === 0 ? (
              <p className="text-center text-xs text-zinc-400 py-4">Nenhuma mensagem</p>
            ) : messages.map(m => (
              <div key={m.id} className={cn('flex', m.isFromMe ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[70%] rounded-lg p-2 text-xs',
                  m.isFromMe ? 'bg-emerald-100 text-emerald-900' : 'bg-white border border-zinc-200 text-zinc-900'
                )}>
                  {m.type !== 'TEXT' && (
                    <div className="text-[9px] uppercase text-zinc-500 mb-1">{m.type}</div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{m.body || `[${m.type}]`}</div>
                  <div className="text-[9px] text-zinc-400 mt-1 text-right">
                    {formatDate(m.createdAt, 'time')}
                    {m.isFromMe && ` · ${m.status}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-zinc-100 flex gap-1.5">
            <Textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Digite sua resposta..."
              className="text-xs min-h-[36px] max-h-24 resize-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendReply()
                }
              }}
            />
            <Button onClick={sendReply} disabled={!reply.trim() || sending} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// === Campaigns Panel ===
function CampaignsPanel() {
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [lists, setLists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      const r = await fetch(`/api/admin/whatsapp/campaigns?${params}`)
      const d = await r.json()
      setCampaigns(d.campaigns || [])
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, toast])

  const loadLists = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/whatsapp/lists')
      const d = await r.json()
      setLists(d.lists || [])
    } catch {}
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => { load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])
  useEffect(() => {
    const id = window.setTimeout(() => { loadLists() }, 0)
    return () => window.clearTimeout(id)
  }, [loadLists])

  const handleAction = async (action: 'pause' | 'resume' | 'cancel', campaignId: string) => {
    try {
      const r = await fetch('/api/admin/whatsapp/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, campaignId }),
      })
      const d = await r.json()
      if (d.error) {
        toast({ title: 'Erro', description: d.error, variant: 'destructive' })
      } else {
        const label = action === 'pause' ? 'Pausada' : action === 'resume' ? 'Retomada' : 'Cancelada'
        toast({ title: `✓ Campanha ${label}` })
        load()
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-bold">Campanhas de Disparo ({campaigns.length})</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Nova campanha
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nova Campanha</DialogTitle>
                </DialogHeader>
                <CampaignForm lists={lists} onSaved={() => { setCreateOpen(false); load() }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm" className="h-8 text-xs w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {['ALL', 'SENT', 'SENDING', 'SCHEDULED', 'PAUSED', 'DRAFT', 'CANCELLED', 'FAILED'].map(s => (
                <SelectItem key={s} value={s}>{s === 'ALL' ? 'Todos status' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger size="sm" className="h-8 text-xs w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              {['ALL', 'ARTICLE', 'MANUAL', 'TEMPLATE'].map(s => (
                <SelectItem key={s} value={s}>{s === 'ALL' ? 'Todos tipos' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="text-xs text-zinc-400 py-8 text-center flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-xs text-zinc-400 py-8 text-center">Nenhuma campanha encontrada</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Nome</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Agendado</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Progresso</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const status = String(c.status || '')
                  const badgeClass =
                    status === 'SENT' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    status === 'SENDING' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                    status === 'SCHEDULED' ? 'bg-zinc-100 text-zinc-700 border-zinc-200' :
                    status === 'PAUSED' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    status === 'CANCELLED' ? 'bg-red-100 text-red-700 border-red-200' :
                    status === 'FAILED' ? 'bg-red-100 text-red-700 border-red-200' :
                    'bg-zinc-100 text-zinc-700 border-zinc-200'
                  return (
                    <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium text-zinc-900 line-clamp-1">{c.name}</div>
                        {c.list?.name && <div className="text-[10px] text-zinc-400">Lista: {c.list.name}</div>}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{c.type}</td>
                      <td className="px-3 py-2">
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border', badgeClass)}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">
                        {c.scheduledAt ? formatDate(c.scheduledAt, 'datetime') : '—'}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">
                        {c.sentCount}/{c.totalRecipients}
                        {c.failedCount > 0 && <span className="text-red-500 ml-1">({c.failedCount} falhas)</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 justify-end">
                          {status === 'SENDING' && (
                            <Button size="sm" variant="ghost" className="h-7 px-2" title="Pausar" onClick={() => handleAction('pause', c.id)}>
                              <Pause className="h-3 w-3" />
                            </Button>
                          )}
                          {status === 'PAUSED' && (
                            <Button size="sm" variant="ghost" className="h-7 px-2" title="Retomar" onClick={() => handleAction('resume', c.id)}>
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                          {(status === 'SENDING' || status === 'PAUSED' || status === 'SCHEDULED') && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600 hover:text-red-700" title="Cancelar" onClick={() => handleAction('cancel', c.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function CampaignForm({ lists, onSaved }: { lists: any[]; onSaved: () => void }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => {
    const now = new Date(Date.now() + 60_000)
    const tzOffset = now.getTimezoneOffset() * 60000
    const local = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16)
    return {
      name: '',
      message: '',
      imageUrl: '',
      listId: '__all__',
      scheduledAt: local,
      type: 'MANUAL',
    }
  })

  const submit = async () => {
    if (!form.name.trim() || !form.message.trim()) {
      toast({ title: 'Nome e mensagem são obrigatórios', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/whatsapp/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          message: form.message.trim(),
          imageUrl: form.imageUrl || undefined,
          listId: form.listId === '__all__' ? undefined : form.listId,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
          type: form.type,
        }),
      })
      const d = await r.json()
      if (d.error) {
        toast({ title: 'Erro', description: d.error, variant: 'destructive' })
      } else {
        toast({ title: '✓ Campanha criada e agendada!' })
        onSaved()
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Nome *</Label>
        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-8 text-xs mt-1" placeholder="Ex: Promoção de fim de semana" />
      </div>
      <div>
        <Label className="text-xs">Mensagem *</Label>
        <Textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="text-xs mt-1 min-h-[100px]" placeholder="Olá! Temos uma novidade..." />
        <p className="text-[10px] text-zinc-400 mt-0.5">Variáveis: {'{{name}}'}, {'{{title}}'}, {'{{link}}'}, {'{{category}}'}</p>
      </div>
      <div>
        <Label className="text-xs">URL da imagem (opcional)</Label>
        <Input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} className="h-8 text-xs mt-1" placeholder="https://..." />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Lista alvo</Label>
          <Select value={form.listId} onValueChange={v => setForm({ ...form, listId: v })}>
            <SelectTrigger className="h-8 text-xs mt-1 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as listas</SelectItem>
              {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Agendar para</Label>
          <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} className="h-8 text-xs mt-1" />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={submit} disabled={saving} size="sm" className="bg-primary">
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
          Criar campanha
        </Button>
      </div>
    </div>
  )
}

// === Subscribers Panel ===
function SubscribersPanel() {
  const { toast } = useToast()
  const [subscribers, setSubscribers] = useState<any[]>([])
  const [lists, setLists] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 50
  const [search, setSearch] = useState('')
  const [listIdFilter, setListIdFilter] = useState('ALL')
  const [isActiveFilter, setIsActiveFilter] = useState('ALL')
  const [isVerifiedFilter, setIsVerifiedFilter] = useState('ALL')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [viewing, setViewing] = useState<any | null>(null)
  const debouncedSearch = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (newOffset: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(newOffset) })
      if (search) params.set('search', search)
      if (listIdFilter !== 'ALL') params.set('listId', listIdFilter)
      if (isActiveFilter !== 'ALL') params.set('isActive', isActiveFilter)
      if (isVerifiedFilter !== 'ALL') params.set('isVerified', isVerifiedFilter)
      const r = await fetch(`/api/admin/whatsapp/subscribers?${params}`)
      const d = await r.json()
      if (newOffset === 0) {
        setSubscribers(d.subscribers || [])
      } else {
        setSubscribers(prev => [...prev, ...(d.subscribers || [])])
      }
      setTotal(d.total || 0)
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, listIdFilter, isActiveFilter, isVerifiedFilter, toast])

  const loadLists = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/whatsapp/lists')
      const d = await r.json()
      setLists(d.lists || [])
    } catch {}
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => { loadLists() }, 0)
    return () => window.clearTimeout(id)
  }, [loadLists])

  // Debounced reload on filter change
  useEffect(() => {
    if (debouncedSearch.current) clearTimeout(debouncedSearch.current)
    debouncedSearch.current = setTimeout(() => {
      setOffset(0)
      load(0)
    }, 300)
    return () => { if (debouncedSearch.current) clearTimeout(debouncedSearch.current) }
  }, [load])

  const loadMore = () => {
    const newOffset = offset + limit
    setOffset(newOffset)
    load(newOffset)
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-sm font-bold">Inscritos ({total})</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setOffset(0); load(0) }} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Upload className="h-3.5 w-3.5 mr-1" /> Importar números
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Importar Números</DialogTitle></DialogHeader>
                <ImportForm lists={lists} onSaved={() => { setImportOpen(false); setOffset(0); load(0) }} />
              </DialogContent>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar manual
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Adicionar Inscrito</DialogTitle></DialogHeader>
                <AddSubscriberForm lists={lists} onSaved={() => { setAddOpen(false); setOffset(0); load(0) }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar telefone ou nome..." className="h-8 text-xs pl-7" />
          </div>
          <Select value={listIdFilter} onValueChange={setListIdFilter}>
            <SelectTrigger size="sm" className="h-8 text-xs w-[140px]"><SelectValue placeholder="Lista" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas listas</SelectItem>
              {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={isActiveFilter} onValueChange={setIsActiveFilter}>
            <SelectTrigger size="sm" className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Ativo: todos</SelectItem>
              <SelectItem value="true">Ativo: sim</SelectItem>
              <SelectItem value="false">Ativo: não</SelectItem>
            </SelectContent>
          </Select>
          <Select value={isVerifiedFilter} onValueChange={setIsVerifiedFilter}>
            <SelectTrigger size="sm" className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Verificado: todos</SelectItem>
              <SelectItem value="true">Verificado: sim</SelectItem>
              <SelectItem value="false">Verificado: não</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        {loading && subscribers.length === 0 ? (
          <div className="text-xs text-zinc-400 py-8 text-center flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : subscribers.length === 0 ? (
          <p className="text-xs text-zinc-400 py-8 text-center">Nenhum inscrito encontrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Telefone</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Nome</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Verif.</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Ativo</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Listas</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Msgs</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-600">Criado</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map(s => (
                  <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-3 py-2 text-zinc-900 font-mono">{s.phoneNumber}</td>
                    <td className="px-3 py-2 text-zinc-700">{s.name || <span className="text-zinc-400">—</span>}</td>
                    <td className="px-3 py-2">
                      {s.isVerified
                        ? <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-200 bg-emerald-50 text-emerald-700">✓</Badge>
                        : <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-200 bg-zinc-50 text-zinc-500">✗</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      {s.isActive
                        ? <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-200 bg-emerald-50 text-emerald-700">sim</Badge>
                        : <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-200 bg-red-50 text-red-700">não</Badge>}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{s.lists?.length || 0}</td>
                    <td className="px-3 py-2 text-zinc-600">{s.messagesReceived || 0}</td>
                    <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">
                      {formatDate(s.createdAt, 'short')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" className="h-7 px-2" title="Ver detalhes" onClick={() => setViewing(s)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {subscribers.length > 0 && total > offset + limit && (
          <div className="border-t border-zinc-100 p-2 text-center">
            <Button size="sm" variant="outline" onClick={loadMore} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              Carregar mais ({total - offset - limit} restantes)
            </Button>
          </div>
        )}
      </div>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={v => { if (!v) setViewing(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Detalhes do Inscrito</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-zinc-500">Telefone:</span><span className="font-mono">{viewing.phoneNumber}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Nome:</span><span>{viewing.name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Origem:</span><span>{viewing.optInSource}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Verificado:</span><span>{viewing.isVerified ? '✓ sim' : '✗ não'}</span></div>
              {viewing.verifiedAt && <div className="flex justify-between"><span className="text-zinc-500">Verificado em:</span><span>{formatDate(viewing.verifiedAt, 'datetime')}</span></div>}
              <div className="flex justify-between"><span className="text-zinc-500">Ativo:</span><span>{viewing.isActive ? 'sim' : 'não'}</span></div>
              {viewing.unsubscribedAt && <div className="flex justify-between"><span className="text-zinc-500">Descadastrado:</span><span>{formatDate(viewing.unsubscribedAt, 'datetime')}</span></div>}
              {viewing.unsubscribeReason && <div className="flex justify-between"><span className="text-zinc-500">Motivo:</span><span>{viewing.unsubscribeReason}</span></div>}
              <div className="flex justify-between"><span className="text-zinc-500">Msgs recebidas:</span><span>{viewing.messagesReceived || 0}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Msgs lidas:</span><span>{viewing.messagesRead || 0}</span></div>
              {viewing.lastMessageAt && <div className="flex justify-between"><span className="text-zinc-500">Última msg:</span><span>{formatDate(viewing.lastMessageAt, 'datetime')}</span></div>}
              <div className="flex justify-between"><span className="text-zinc-500">Criado em:</span><span>{formatDate(viewing.createdAt, 'datetime')}</span></div>
              <div className="pt-2 border-t border-zinc-100">
                <div className="text-zinc-500 mb-1">Listas:</div>
                {viewing.lists?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {viewing.lists.map((le: any) => (
                      <Badge key={le.listId} variant="outline" className="text-[10px] px-1.5 py-0">{le.list?.name || le.listId}</Badge>
                    ))}
                  </div>
                ) : <span className="text-zinc-400">Nenhuma lista</span>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AddSubscriberForm({ lists, onSaved }: { lists: any[]; onSaved: () => void }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{ phoneNumber: string; name: string; listIds: string[] }>({
    phoneNumber: '', name: '', listIds: [],
  })

  const toggleList = (id: string) => {
    setForm(prev => ({
      ...prev,
      listIds: prev.listIds.includes(id) ? prev.listIds.filter(x => x !== id) : [...prev.listIds, id],
    }))
  }

  const submit = async () => {
    if (!form.phoneNumber.trim()) {
      toast({ title: 'Telefone obrigatório', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/whatsapp/subscribers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: form.phoneNumber.trim(),
          name: form.name.trim() || undefined,
          listIds: form.listIds,
        }),
      })
      const d = await r.json()
      if (d.error) {
        toast({ title: 'Erro', description: d.error, variant: 'destructive' })
      } else {
        toast({ title: '✓ Inscrito adicionado!' })
        onSaved()
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Telefone *</Label>
        <Input value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} className="h-8 text-xs mt-1" placeholder="5566999990000" />
        <p className="text-[10px] text-zinc-400 mt-0.5">DDI + DDD + número, sem + ou espaços</p>
      </div>
      <div>
        <Label className="text-xs">Nome (opcional)</Label>
        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-8 text-xs mt-1" />
      </div>
      <div>
        <Label className="text-xs">Listas</Label>
        <div className="space-y-1 mt-1 max-h-40 overflow-y-auto border border-zinc-100 rounded p-2">
          {lists.length === 0 ? (
            <p className="text-[10px] text-zinc-400">Nenhuma lista disponível</p>
          ) : lists.map(l => (
            <label key={l.id} className="flex items-center gap-2 cursor-pointer text-xs py-0.5">
              <Checkbox checked={form.listIds.includes(l.id)} onCheckedChange={() => toggleList(l.id)} />
              <span className={cn('inline-block h-2 w-2 rounded-full', `bg-${l.color || 'slate'}-500`)} />
              <span>{l.name}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={submit} disabled={saving} size="sm" className="bg-primary">
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
          Adicionar
        </Button>
      </div>
    </div>
  )
}

function ImportForm({ lists, onSaved }: { lists: any[]; onSaved: () => void }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [text, setText] = useState('')
  const [listId, setListId] = useState('__none__')
  const [summary, setSummary] = useState<any | null>(null)

  const submit = async () => {
    const numbers = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (numbers.length === 0) {
      toast({ title: 'Cole ao menos um número', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/whatsapp/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numbers,
          listId: listId === '__none__' ? undefined : listId,
        }),
      })
      const d = await r.json()
      if (d.error) {
        toast({ title: 'Erro', description: d.error, variant: 'destructive' })
      } else {
        setSummary(d.summary)
        toast({ title: '✓ Importação concluída' })
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Números (um por linha)</Label>
        <Textarea value={text} onChange={e => setText(e.target.value)} className="text-xs mt-1 min-h-[140px] font-mono" placeholder={'5566999990000\n5566988881111\n5566988882222'} />
      </div>
      <div>
        <Label className="text-xs">Adicionar à lista</Label>
        <Select value={listId} onValueChange={setListId}>
          <SelectTrigger className="h-8 text-xs mt-1 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Apenas lista padrão</SelectItem>
            {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {summary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-emerald-800">
          <div className="font-bold mb-1">Resumo da importação</div>
          <div>Total: {summary.total} · Importados: <strong>{summary.imported}</strong> · Duplicados: {summary.duplicates} · Inválidos: {summary.invalid}</div>
        </div>
      )}
      <div className="flex justify-end pt-2">
        <Button onClick={submit} disabled={saving} size="sm" className="bg-primary">
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
          Importar
        </Button>
      </div>
      {summary && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={onSaved}>Concluir</Button>
        </div>
      )}
    </div>
  )
}

// === Lists Panel ===
const LIST_COLORS = ['blue', 'red', 'green', 'amber', 'purple', 'pink', 'rose', 'orange', 'teal', 'cyan', 'indigo', 'emerald', 'slate', 'zinc']

function ListsPanel() {
  const { toast } = useToast()
  const [lists, setLists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/whatsapp/lists')
      const d = await r.json()
      setLists(d.lists || [])
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    const id = window.setTimeout(() => { load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  return (
    <div className="space-y-3">
      <div className="bg-white border border-zinc-200 rounded-lg p-3 flex items-center justify-between">
        <Label className="text-sm font-bold">Listas de Inscritos ({lists.length})</Label>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary">
                <Plus className="h-3.5 w-3.5 mr-1" /> Nova lista
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Nova Lista</DialogTitle></DialogHeader>
              <ListForm onSaved={() => { setCreateOpen(false); load() }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-zinc-400 py-8 text-center flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : lists.length === 0 ? (
        <p className="text-xs text-zinc-400 py-8 text-center">Nenhuma lista encontrada</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lists.map(l => (
            <div key={l.id} className="bg-white border border-zinc-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className={cn('inline-block h-3 w-3 rounded-full flex-shrink-0 mt-1', `bg-${l.color || 'slate'}-500`)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-sm text-zinc-900">{l.name}</span>
                    {l.isDefault && <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-200 bg-emerald-50 text-emerald-700">padrão</Badge>}
                    {l.isAuto && <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-200 bg-blue-50 text-blue-700">auto</Badge>}
                  </div>
                  {l.description && <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{l.description}</p>}
                  {l.categorySlug && <p className="text-[10px] text-zinc-400 mt-0.5">Categoria: {l.categorySlug}</p>}
                  <div className="text-[10px] text-zinc-500 mt-1.5 flex gap-2">
                    <span>{l._count?.subscribers || 0} inscritos</span>
                    <span>·</span>
                    <span>{l._count?.campaigns || 0} campanhas</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ListForm({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: 'blue',
    categorySlug: '',
    isAuto: false,
  })

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/whatsapp/lists', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description || undefined,
          color: form.color,
          categorySlug: form.categorySlug || undefined,
          isAuto: form.isAuto,
        }),
      })
      const d = await r.json()
      if (d.error) {
        toast({ title: 'Erro', description: d.error, variant: 'destructive' })
      } else {
        toast({ title: '✓ Lista criada!' })
        onSaved()
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Nome *</Label>
        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-8 text-xs mt-1" placeholder="Ex: Política" />
      </div>
      <div>
        <Label className="text-xs">Descrição</Label>
        <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-8 text-xs mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Cor</Label>
          <Select value={form.color} onValueChange={v => setForm({ ...form, color: v })}>
            <SelectTrigger className="h-8 text-xs mt-1 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIST_COLORS.map(c => (
                <SelectItem key={c} value={c}>
                  <span className={cn('inline-block h-2 w-2 rounded-full mr-2', `bg-${c}-500`)} />
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Slug da categoria</Label>
          <Input value={form.categorySlug} onChange={e => setForm({ ...form, categorySlug: e.target.value })} className="h-8 text-xs mt-1" placeholder="politica (opcional)" />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch checked={form.isAuto} onCheckedChange={v => setForm({ ...form, isAuto: v })} />
        <span className="text-xs">Lista automática (gerenciada por categoria)</span>
      </label>
      <div className="flex justify-end pt-2">
        <Button onClick={submit} disabled={saving} size="sm" className="bg-primary">
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
          Criar lista
        </Button>
      </div>
    </div>
  )
}

// === Anti-block Panel ===
function AntiBlockPanel() {
  const { toast } = useToast()
  const [config, setConfig] = useState<any | null>(null)
  const [liveStatus, setLiveStatus] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/whatsapp/antiblock')
      const d = await r.json()
      setConfig(d.config)
      setLiveStatus(d.liveStatus)
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    const id = window.setTimeout(() => { load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const save = async () => {
    if (!config) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/whatsapp/antiblock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const d = await r.json()
      if (d.error) {
        toast({ title: 'Erro', description: d.error, variant: 'destructive' })
      } else {
        toast({ title: '✓ Configuração salva' })
        setConfig(d.config)
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !config) {
    return (
      <div className="text-xs text-zinc-400 py-8 text-center flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    )
  }

  const update = (key: string, value: any) => setConfig({ ...config, [key]: value })

  return (
    <div className="space-y-3">
      {/* Live status card */}
      {liveStatus && (
        <div className={cn(
          'border rounded-lg p-4',
          liveStatus.canSendNow ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className={cn('h-4 w-4', liveStatus.canSendNow ? 'text-emerald-600' : 'text-amber-600')} />
            <span className="font-bold text-sm text-zinc-900">
              Pode enviar agora: {liveStatus.canSendNow ? '✓' : '✗'}
            </span>
          </div>
          {!liveStatus.canSendNow && liveStatus.reason && (
            <p className="text-xs text-amber-800 mb-2 ml-6">{liveStatus.reason}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs ml-6">
            <div className="bg-white/60 rounded p-2">
              <div className="text-[10px] text-zinc-500">Última hora</div>
              <div className="font-bold text-zinc-900">{liveStatus.sentLastHour}/{config.maxPerHour}</div>
            </div>
            <div className="bg-white/60 rounded p-2">
              <div className="text-[10px] text-zinc-500">Último dia</div>
              <div className="font-bold text-zinc-900">{liveStatus.sentLastDay}/{config.maxPerDay}</div>
            </div>
            <div className="bg-white/60 rounded p-2">
              <div className="text-[10px] text-zinc-500">Warmup cap</div>
              <div className="font-bold text-zinc-900">{liveStatus.warmupCap ?? '—'}</div>
            </div>
            <div className="bg-white/60 rounded p-2">
              <div className="text-[10px] text-zinc-500">Quiet hours</div>
              <div className="font-bold text-zinc-900">{config.quietHoursStart}h-{config.quietHoursEnd}h</div>
            </div>
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>Configurações anti-bloqueio protegem o chip contra detecção de spam. Reduza os limites em chips novos (warmup) e nunca ultrapasse 50/hora ou 200/dia em chips com menos de 7 dias.</p>
        </div>
      </div>

      {/* Config form */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-4">
        {/* Rate limiting */}
        <div className="space-y-2">
          <Label className="text-xs font-bold flex items-center gap-1">⚡ Rate Limiting</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Máx por hora</Label>
              <Input type="number" value={config.maxPerHour} onChange={e => update('maxPerHour', Number(e.target.value))} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-[10px]">Máx por dia</Label>
              <Input type="number" value={config.maxPerDay} onChange={e => update('maxPerDay', Number(e.target.value))} className="h-8 text-xs mt-1" />
            </div>
          </div>
        </div>

        {/* Delays */}
        <div className="space-y-2 pt-3 border-t border-zinc-100">
          <Label className="text-xs font-bold flex items-center gap-1">⏱️ Delays (ms)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Delay mínimo</Label>
              <Input type="number" value={config.delayMinMs} onChange={e => update('delayMinMs', Number(e.target.value))} className="h-8 text-xs mt-1" />
              <p className="text-[9px] text-zinc-400 mt-0.5">≈ {(config.delayMinMs / 1000).toFixed(1)}s</p>
            </div>
            <div>
              <Label className="text-[10px]">Delay máximo</Label>
              <Input type="number" value={config.delayMaxMs} onChange={e => update('delayMaxMs', Number(e.target.value))} className="h-8 text-xs mt-1" />
              <p className="text-[9px] text-zinc-400 mt-0.5">≈ {(config.delayMaxMs / 1000).toFixed(1)}s</p>
            </div>
          </div>
        </div>

        {/* Quiet hours */}
        <div className="space-y-2 pt-3 border-t border-zinc-100">
          <Label className="text-xs font-bold flex items-center gap-1">🌙 Quiet Hours (0-23)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Início</Label>
              <Input type="number" min={0} max={23} value={config.quietHoursStart} onChange={e => update('quietHoursStart', Number(e.target.value))} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-[10px]">Fim</Label>
              <Input type="number" min={0} max={23} value={config.quietHoursEnd} onChange={e => update('quietHoursEnd', Number(e.target.value))} className="h-8 text-xs mt-1" />
            </div>
          </div>
          <p className="text-[10px] text-zinc-400">Não envia neste intervalo (ex: 22-8 = 22h às 8h).</p>
        </div>

        {/* Bounce protection */}
        <div className="space-y-2 pt-3 border-t border-zinc-100">
          <Label className="text-xs font-bold flex items-center gap-1">📉 Bounce Protection (%)</Label>
          <Input type="number" step="0.1" value={config.maxBounceRate} onChange={e => update('maxBounceRate', Number(e.target.value))} className="h-8 text-xs mt-1 w-32" />
          <p className="text-[10px] text-zinc-400">Pausa campanha automaticamente se a taxa de falha exceder este valor.</p>
        </div>

        {/* Warmup */}
        <div className="space-y-2 pt-3 border-t border-zinc-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={config.warmupEnabled} onCheckedChange={v => update('warmupEnabled', v)} />
            <span className="text-xs font-bold">🔥 Warmup (chip novo)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Dias de warmup</Label>
              <Input type="number" value={config.warmupDays} onChange={e => update('warmupDays', Number(e.target.value))} className="h-8 text-xs mt-1" disabled={!config.warmupEnabled} />
            </div>
            <div>
              <Label className="text-[10px]">Início (msgs/dia)</Label>
              <Input type="number" value={config.warmupStartCount} onChange={e => update('warmupStartCount', Number(e.target.value))} className="h-8 text-xs mt-1" disabled={!config.warmupEnabled} />
            </div>
          </div>
          <p className="text-[10px] text-zinc-400">Chips novos começam com limite baixo e crescem linearmente até o limite diário.</p>
        </div>

        {/* Auto-pause */}
        <div className="space-y-2 pt-3 border-t border-zinc-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={config.autoPauseOnError} onCheckedChange={v => update('autoPauseOnError', v)} />
            <span className="text-xs font-bold">🚨 Auto-pause em erros</span>
          </label>
          <div>
            <Label className="text-[10px]">Threshold (erros consecutivos)</Label>
            <Input type="number" value={config.errorThreshold} onChange={e => update('errorThreshold', Number(e.target.value))} className="h-8 text-xs mt-1 w-32" disabled={!config.autoPauseOnError} />
          </div>
        </div>

        {/* Compliance */}
        <div className="space-y-2 pt-3 border-t border-zinc-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={config.requireOptOutFooter} onCheckedChange={v => update('requireOptOutFooter', v)} />
            <span className="text-xs font-bold">📜 Rodapé de opt-out (compliance)</span>
          </label>
          {config.requireOptOutFooter && (
            <div>
              <Label className="text-[10px]">Texto do rodapé</Label>
              <Textarea value={config.optOutFooterText} onChange={e => update('optOutFooterText', e.target.value)} className="text-xs mt-1 min-h-[60px]" />
            </div>
          )}
        </div>

        {/* Variants */}
        <div className="space-y-2 pt-3 border-t border-zinc-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={config.enableVariants} onCheckedChange={v => update('enableVariants', v)} />
            <span className="text-xs font-bold">🎲 Variants (A/B testing)</span>
          </label>
          <p className="text-[10px] text-zinc-400">Gera variações de mensagem (emojis, saudações) para evitar detecção de padrão.</p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving} size="sm" className="bg-primary">
            {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  )
}
