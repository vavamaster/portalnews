'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Loader2, Save, RefreshCw, MessageCircle, Phone, Send,
  CheckCircle, XCircle, QrCode, AlertCircle, Power, PowerOff,
  Inbox, Search, Image as ImageIcon, ArrowLeft,
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

type Tab = 'settings' | 'inbox' | 'logs'

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
  useEffect(() => { load() }, [load])

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

  if (loading) return <div className="text-zinc-500 flex items-center gap-2 py-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>

  const liveStatus: Status = (config?.liveStatus as Status) || (config?.connectionStatus as Status) || 'DISCONNECTED'
  const liveQr = config?.liveQrCode || config?.qrCode
  const qrExpired = config?.qrCodeExpiresAt ? new Date(config.qrCodeExpiresAt) < new Date() : false
  const isConnected = liveStatus === 'CONNECTED'
  const isConnecting = liveStatus === 'CONNECTING' || connecting
  const needsQr = liveStatus === 'NEED_QR' && liveQr && !qrExpired

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200">
        {[
          { id: 'settings' as Tab, label: 'Configuração', icon: Phone },
          { id: 'inbox' as Tab, label: 'Caixa de Entrada', icon: Inbox },
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
                  {config?.lastConnectedAt && ` · Última conexão: ${new Date(config.lastConnectedAt).toLocaleString('pt-BR')}`}
                </div>
              </div>
              <div className="flex gap-1.5">
                {isConnected ? (
                  <Button size="sm" variant="outline" onClick={disconnect} disabled={isConnecting}>
                    <PowerOff className="h-3.5 w-3.5 mr-1" /> Desconectar
                  </Button>
                ) : (
                  <Button size="sm" onClick={connect} disabled={isConnecting} className="bg-emerald-600 hover:bg-emerald-700">
                    {isConnecting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Power className="h-3.5 w-3.5 mr-1" />}
                    Conectar
                  </Button>
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
                  <div className="text-[9px] text-zinc-400 mt-0.5">{new Date(l.createdAt).toLocaleString('pt-BR')}</div>
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
                      {new Date(c.lastMessageAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
                    {new Date(m.createdAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
