'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Plus, Trash2, Edit, RefreshCw, Bot, Clock, Calendar,
  CheckCircle, XCircle, Sparkles,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/ui/skeleton'

const SCOPES = [
  { value: 'LOCAL', label: 'Local (cidade)', icon: '📍' },
  { value: 'STATE', label: 'Estado', icon: '🌾' },
  { value: 'NATIONAL', label: 'Brasil', icon: '🇧🇷' },
  { value: 'WORLD', label: 'Mundo', icon: '🌍' },
  { value: 'TRENDING', label: 'Trending', icon: '🔥' },
  { value: 'CUSTOM', label: 'Personalizado', icon: '✏️' },
]

const FREQUENCIES = [
  { value: 'HOURLY', label: 'A cada hora' },
  { value: 'DAILY', label: 'Diário' },
  { value: 'WEEKLY', label: 'Semanal' },
]

export function AdminAINews() {
  const { toast } = useToast()
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>({
    name: '', frequency: 'DAILY', hour: 8, minute: 0, scope: 'LOCAL',
    categorySlug: '', topicHint: '', autoPublish: false, isEnabled: true,
  })

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/ai-autonews')
      const d = await r.json()
      setSchedules(d.schedules || [])
    } finally { setLoading(false) }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' }); return }
    const url = editingId ? `/api/admin/ai-autonews/${editingId}` : '/api/admin/ai-autonews'
    const method = editingId ? 'PATCH' : 'POST'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    if (d.error) { toast({ title: 'Erro', description: d.error, variant: 'destructive' }) }
    else { toast({ title: editingId ? '✓ Agendamento atualizado' : '✓ Agendamento criado' }); setCreating(false); setEditingId(null); load() }
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir este agendamento?')) return
    const response = await fetch(`/api/admin/ai-autonews/${id}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return toast({ title: 'Erro', description: data.error || 'Não foi possível remover', variant: 'destructive' })
    toast({ title: 'Agendamento removido' }); load()
  }

  const startEdit = (s: any) => {
    setEditingId(s.id)
    setForm({
      name: s.name, frequency: s.frequency, hour: s.hour, minute: s.minute,
      scope: s.scope, categorySlug: s.categorySlug || '', topicHint: s.topicHint || '',
      autoPublish: s.autoPublish, isEnabled: s.isEnabled,
    })
    setCreating(true)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
      </div>

      {/* Info card */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-900">
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Como funciona:</strong> A IA gera matérias com base no escopo (Local, Estado, Nacional, etc.) e no tema sugerido.
            Se <strong>auto-publicar</strong> estiver ligado, a matéria vai ao ar e você recebe notificação no WhatsApp.
            Se desligado, a matéria fica como rascunho e você recebe notificação para revisar.
          </div>
        </div>
      </div>

      {/* Schedules list */}
      {schedules.length === 0 && !creating && (
        <div className="text-center py-8 text-zinc-500">
          <Bot className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
          Nenhum agendamento. Crie o primeiro.
        </div>
      )}

      {schedules.map(s => (
        <div key={s.id} className="bg-white border border-zinc-200 rounded-lg p-3">
          {editingId === s.id && creating ? (
            <ScheduleForm form={form} setForm={setForm} onSave={save} onCancel={() => { setCreating(false); setEditingId(null) }} />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-zinc-900">{s.name}</span>
                  <Badge variant="outline" className="text-[9px]">{s.scope}</Badge>
                  <Badge variant="outline" className="text-[9px]">{s.frequency}</Badge>
                  {s.autoPublish ? <Badge className="text-[9px] bg-emerald-100 text-emerald-700">Auto-publicar</Badge> : <Badge className="text-[9px] bg-amber-100 text-amber-700">Revisar</Badge>}
                  {!s.isEnabled && <Badge className="text-[9px] bg-zinc-100 text-zinc-500">Desativado</Badge>}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {String(s.hour).padStart(2, '0')}:{String(s.minute).padStart(2, '0')} · {s.topicHint || 'Tema automático'} · {s.runCount}x executado
                  {s.lastRunAt && ` · última: ${new Date(s.lastRunAt).toLocaleString('pt-BR')}`}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startEdit(s)} className="h-7 w-7 p-0"><Edit className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(s.id)} className="h-7 w-7 p-0 text-red-600"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {creating && !editingId && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
          <ScheduleForm form={form} setForm={setForm} onSave={save} onCancel={() => setCreating(false)} />
        </div>
      )}

      {!creating && (
        <Button onClick={() => { setForm({ name: '', frequency: 'DAILY', hour: 8, minute: 0, scope: 'LOCAL', categorySlug: '', topicHint: '', autoPublish: false, isEnabled: true }); setCreating(true) }} variant="outline" size="sm">
          <Plus className="h-3 w-3 mr-1" /> Novo agendamento
        </Button>
      )}

      {/* Cron info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <strong>Configurar cron:</strong> Para execução automática, configure:
        <code className="bg-amber-100 px-1 rounded mx-1">0 * * * * curl https://seusite.com/api/cron/ai-autonews?key=portal-cron-2024</code>
      </div>
    </div>
  )
}

function ScheduleForm({ form, setForm, onSave, onCancel }: any) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Notícias matinais" className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Escopo</Label>
          <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{SCOPES.map(s => <SelectItem key={s.value} value={s.value}>{s.icon} {s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Frequência</Label>
          <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Hora</Label><Input type="number" min={0} max={23} value={form.hour} onChange={(e) => setForm({ ...form, hour: parseInt(e.target.value) || 0 })} className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Minuto</Label><Input type="number" min={0} max={59} value={form.minute} onChange={(e) => setForm({ ...form, minute: parseInt(e.target.value) || 0 })} className="h-8 text-xs" /></div>
      </div>
      <div><Label className="text-xs">Tema sugerido (opcional)</Label><Input value={form.topicHint} onChange={(e) => setForm({ ...form, topicHint: e.target.value })} placeholder="Festival de inverno, obras na cidade..." className="h-8 text-xs" /></div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs"><Switch checked={form.autoPublish} onCheckedChange={v => setForm({ ...form, autoPublish: v })} /> Auto-publicar</label>
        <label className="flex items-center gap-1.5 text-xs"><Switch checked={form.isEnabled} onCheckedChange={v => setForm({ ...form, isEnabled: v })} /> Ativo</label>
      </div>
      <div className="flex gap-2">
        <Button onClick={onSave} className="bg-primary h-8 text-xs">Salvar</Button>
        <Button variant="outline" onClick={onCancel} className="h-8 text-xs">Cancelar</Button>
      </div>
    </div>
  )
}
