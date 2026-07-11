'use client'

import { useEffect, useState, Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Loader2, Plus, Trash2, Play, Clock, Calendar, Globe, Sparkles, Bot,
  CheckCircle, XCircle, AlertCircle, Zap, Settings, History, RefreshCw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const FREQUENCIES = [
  { value: 'HOURLY', label: 'A cada hora', icon: Clock },
  { value: 'DAILY', label: 'Diário', icon: Calendar },
  { value: 'WEEKLY', label: 'Semanal', icon: Calendar },
  { value: 'MONTHLY', label: 'Mensal', icon: Calendar },
]

const SCOPES = [
  { value: 'LOCAL', label: 'Local (cidade)', color: 'emerald', icon: '📍' },
  { value: 'STATE', label: 'Estado', color: 'amber', icon: '🌾' },
  { value: 'NATIONAL', label: 'Brasil', color: 'blue', icon: '🇧🇷' },
  { value: 'WORLD', label: 'Mundo', color: 'purple', icon: '🌍' },
  { value: 'TRENDING', label: 'Trending (do momento)', color: 'rose', icon: '🔥' },
  { value: 'CUSTOM', label: 'Personalizado', color: 'zinc', icon: '✏️' },
]

const DAYS_OF_WEEK = [
  { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }, { value: 7, label: 'Dom' },
]

interface Schedule {
  id: string; name: string; isEnabled: boolean; frequency: string; hour: number; minute: number
  daysOfWeek: number[] | null; dayOfMonth: number | null; scope: string; categorySlug: string | null
  topicHint: string | null; promptTemplate: string | null; autoPublish: boolean
  lastRunAt: string | null; lastRunStatus: string | null; lastPostId: string | null; lastError: string | null
  runCount: number; createdAt: string
}

interface LogEntry {
  id: string; scheduleName: string; status: string; scope: string; postTitle: string | null
  error: string | null; duration: number | null; createdAt: string
}

export function AdminAutoNews() {
  const { toast } = useToast()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [seoSettings, setSeoSettings] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    try {
      const [res, seoRes] = await Promise.all([
        fetch('/api/admin/auto-news?logs=true'),
        fetch('/api/seo'),
      ])
      const data = await res.json()
      const seoData = await seoRes.json()
      setSchedules(data.schedules || [])
      setLogs(data.logs || [])
      setStats(data.stats)
      setSeoSettings(seoData.settings || {})
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Build a dynamic Altinha description using SEO settings (no hardcoded brand)
  const siteName = seoSettings.site_name || 'Portal'
  const cityState = [seoSettings.site_city, seoSettings.site_state].filter(Boolean).join(', ')
  const altinhaLocationLine = cityState
    ? `Jornalista-IA sênior do portal ${siteName} (${cityState}).`
    : `Jornalista-IA sênior do portal ${siteName}.`

  const handleRun = async (schedule: Schedule) => {
    setRunning(schedule.id)
    try {
      const res = await fetch('/api/admin/auto-news/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: schedule.id }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro ao gerar', description: data.error, variant: 'destructive' })
      } else {
        toast({ title: '✨ Matéria gerada!', description: data.message })
        load()
      }
    } finally { setRunning(null) }
  }

  const handleToggle = async (schedule: Schedule) => {
    await fetch(`/api/admin/auto-news/${schedule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: !schedule.isEnabled }),
    })
    load()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/auto-news/${id}`, { method: 'DELETE' })
    toast({ title: 'Agendamento removido' })
    load()
  }

  if (loading) return <div className="text-zinc-500 flex items-center gap-2 py-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" /> Auto News — "Altinha"
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Geração automática de notícias por IA. A "Altinha" é a jornalista-IA do portal {siteName}{cityState ? ` (${cityState})` : ''}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowLogs(!showLogs); if (!showLogs) load() }}>
            <History className="h-4 w-4 mr-1" /> {showLogs ? 'Ver agendamentos' : 'Ver logs'}
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="bg-primary">
            <Plus className="h-4 w-4 mr-1" /> Novo agendamento
          </Button>
        </div>
      </div>

      {/* Altinha personality card */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="bg-gradient-to-br from-purple-500 to-blue-500 text-white p-2 rounded-lg flex-shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm text-purple-900">Personalidade: Altinha 🤖</div>
            <p className="text-xs text-purple-700 mt-1">
              {altinhaLocationLine} 25+ anos de carreira simulada.
              Especialista em cobertura local com contextualização regional.
              <strong> Princípios:</strong> precisão (não inventa dados), localismo (traduz global para local),
              equilíbrio (múltiplos lados), ética (presunção de inocência, não sensacionaliza).
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[10px] bg-white">📍 Local</Badge>
              <Badge variant="outline" className="text-[10px] bg-white">🌾 Estado</Badge>
              <Badge variant="outline" className="text-[10px] bg-white">🇧🇷 Brasil</Badge>
              <Badge variant="outline" className="text-[10px] bg-white">🌍 Mundo</Badge>
              <Badge variant="outline" className="text-[10px] bg-white">🔥 Trending</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-zinc-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-black text-zinc-900">{stats.totalSchedules}</div>
            <div className="text-xs text-zinc-500">Agendamentos</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-black text-emerald-700">{stats.activeSchedules}</div>
            <div className="text-xs text-emerald-600">Ativos</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-black text-blue-700">{(stats.last7days?.SUCCESS || 0) + (stats.last7days?.FAILED || 0)}</div>
            <div className="text-xs text-blue-600">Execuções (7d)</div>
          </div>
        </div>
      )}

      {/* Cron info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Configurar cron:</strong> Para execução automática, configure um cron job externo que chama{' '}
          <code className="bg-amber-100 px-1 rounded">GET /api/cron/auto-news</code> a cada hora.
          <br />
          <span className="text-amber-600">Ex (crontab): <code>0 * * * * curl https://seusite.com/api/cron/auto-news</code></span>
        </div>
      </div>

      {/* Content */}
      {showLogs ? (
        <LogsView logs={logs} />
      ) : (
        <div className="space-y-3">
          {schedules.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 bg-white border border-zinc-200 rounded-lg">
              <Bot className="h-10 w-10 text-zinc-300 mx-auto mb-2" />
              <p>Nenhum agendamento configurado.</p>
              <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="bg-primary mt-3">
                <Plus className="h-4 w-4 mr-1" /> Criar primeiro agendamento
              </Button>
            </div>
          ) : (
            schedules.map(s => <ScheduleCard key={s.id} schedule={s} onRun={handleRun} onToggle={handleToggle} onDelete={handleDelete} onEdit={(sc) => { setEditing(sc); setDialogOpen(true) }} running={running === s.id} />)
          )}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar agendamento' : 'Novo agendamento'}</DialogTitle>
          </DialogHeader>
          <ScheduleForm schedule={editing} categories={[]} onSaved={() => { setDialogOpen(false); load() }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ScheduleCard({ schedule: s, onRun, onToggle, onDelete, onEdit, running }: any) {
  const scope = SCOPES.find(sc => sc.value === s.scope) || SCOPES[0]
  const freq = FREQUENCIES.find(f => f.value === s.frequency) || FREQUENCIES[1]
  const daysLabel = s.daysOfWeek?.length ? s.daysOfWeek.map((d: number) => DAYS_OF_WEEK.find(dd => dd.value === d)?.label).join(', ') : 'Todos os dias'

  return (
    <div className={cn('bg-white border rounded-lg p-4', s.isEnabled ? 'border-zinc-200' : 'border-zinc-200 opacity-60')}>
      <div className="flex items-start gap-3">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0', `bg-${scope.color}-100`)}>
          {scope.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-bold text-sm text-zinc-900">{s.name}</div>
            <Badge variant="outline" className={cn('text-[10px]', `bg-${scope.color}-50 text-${scope.color}-700 border-${scope.color}-200`)}>
              {scope.label}
            </Badge>
            {s.autoPublish && <Badge className="text-[10px] bg-emerald-100 text-emerald-700">Auto-publicar</Badge>}
          </div>
          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {String(s.hour).padStart(2, '0')}:{String(s.minute).padStart(2, '0')}</span>
            <span>·</span>
            <span>{freq.label}</span>
            {s.frequency === 'WEEKLY' && <><span>·</span><span>{daysLabel}</span></>}
            {s.frequency === 'MONTHLY' && s.dayOfMonth && <><span>·</span><span>Dia {s.dayOfMonth}</span></>}
            {s.categorySlug && <><span>·</span><span>Cat: {s.categorySlug}</span></>}
          </div>
          {s.topicHint && <div className="text-xs text-zinc-400 mt-1 italic">Tema: {s.topicHint}</div>}
          {/* Last run */}
          {s.lastRunAt && (
            <div className="text-[11px] mt-1 flex items-center gap-1">
              {s.lastRunStatus === 'SUCCESS' ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
              <span className="text-zinc-500">Última execução: {new Date(s.lastRunAt).toLocaleString('pt-BR')}</span>
              <span className="text-zinc-400">· {s.runCount}x total</span>
            </div>
          )}
          {s.lastError && <div className="text-[11px] text-red-500 mt-1">Erro: {s.lastError.substring(0, 80)}</div>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={() => onRun(s)} disabled={running} className="h-8 w-8 p-0" title="Executar agora">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 text-primary" />}
          </Button>
          <Switch checked={s.isEnabled} onCheckedChange={() => onToggle(s)} />
          <Button size="sm" variant="ghost" onClick={() => onEdit(s)} className="h-8 w-8 p-0" title="Editar">
            <Settings className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 h-8 w-8 p-0" title="Excluir">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
                <AlertDialogDescription>{s.name} será removido permanentemente.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(s.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}

function ScheduleForm({ schedule, categories, onSaved }: any) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    name: schedule?.name || '',
    frequency: schedule?.frequency || 'DAILY',
    hour: schedule?.hour ?? 8,
    minute: schedule?.minute ?? 0,
    daysOfWeek: schedule?.daysOfWeek || [1, 2, 3, 4, 5],
    dayOfMonth: schedule?.dayOfMonth || 1,
    scope: schedule?.scope || 'LOCAL',
    categorySlug: schedule?.categorySlug || '',
    topicHint: schedule?.topicHint || '',
    promptTemplate: schedule?.promptTemplate || '',
    autoPublish: schedule?.autoPublish ?? false,
    isEnabled: schedule?.isEnabled ?? true,
  })

  const toggleDay = (day: number) => {
    const current = form.daysOfWeek || []
    if (current.includes(day)) {
      setForm({ ...form, daysOfWeek: current.filter((d: number) => d !== day) })
    } else {
      setForm({ ...form, daysOfWeek: [...current, day] })
    }
  }

  const handleSave = async () => {
    if (!form.name) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const url = schedule ? `/api/admin/auto-news/${schedule.id}` : '/api/admin/auto-news'
      const method = schedule ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (data.error) { toast({ title: 'Erro', description: data.error, variant: 'destructive' }) }
      else { toast({ title: schedule ? 'Agendamento atualizado!' : 'Agendamento criado!' }); onSaved() }
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <Label className="text-xs">Nome do agendamento *</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Notícia local matinal" className="mt-1" />
      </div>

      {/* Scope */}
      <div>
        <Label className="text-xs">Escopo (nível de cobertura)</Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {SCOPES.map(sc => (
            <button key={sc.value} onClick={() => setForm({ ...form, scope: sc.value })}
              className={cn('p-2 rounded-md border-2 text-center transition-all', form.scope === sc.value ? `border-${sc.color}-500 bg-${sc.color}-50` : 'border-zinc-200 hover:border-zinc-300')}>
              <div className="text-lg">{sc.icon}</div>
              <div className={cn('text-[10px] font-medium', form.scope === sc.value ? `text-${sc.color}-700` : 'text-zinc-600')}>{sc.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Frequency */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Frequência</Label>
          <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Hora</Label>
          <div className="flex gap-2 mt-1">
            <Input type="number" min={0} max={23} value={form.hour} onChange={(e) => setForm({ ...form, hour: parseInt(e.target.value) || 0 })} className="w-20" />
            <span className="self-center text-zinc-400">:</span>
            <Input type="number" min={0} max={59} value={form.minute} onChange={(e) => setForm({ ...form, minute: parseInt(e.target.value) || 0 })} className="w-20" />
          </div>
        </div>
      </div>

      {/* Days of week (for WEEKLY) */}
      {form.frequency === 'WEEKLY' && (
        <div>
          <Label className="text-xs">Dias da semana</Label>
          <div className="flex gap-1 mt-1">
            {DAYS_OF_WEEK.map(d => (
              <button key={d.value} onClick={() => toggleDay(d.value)}
                className={cn('px-3 py-1.5 rounded text-xs font-medium border-2 transition-all',
                  (form.daysOfWeek || []).includes(d.value) ? 'border-primary bg-primary text-white' : 'border-zinc-200 hover:border-zinc-300')}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day of month (for MONTHLY) */}
      {form.frequency === 'MONTHLY' && (
        <div>
          <Label className="text-xs">Dia do mês (1-28)</Label>
          <Input type="number" min={1} max={28} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: parseInt(e.target.value) || 1 })} className="mt-1 w-32" />
        </div>
      )}

      {/* Category */}
      <div>
        <Label className="text-xs">Categoria sugerida (opcional)</Label>
        <Input value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })} placeholder="Ex: politica, esportes, economia..." className="mt-1" />
      </div>

      {/* Topic hint */}
      <div>
        <Label className="text-xs">Tema/Assunto específico (opcional)</Label>
        <Textarea value={form.topicHint} onChange={(e) => setForm({ ...form, topicHint: e.target.value })} rows={2} placeholder="Ex: Safra de soja 2026, El Niño e agricultura, Eleições municipais..." className="mt-1" />
        <p className="text-[10px] text-zinc-400 mt-1">Se vazio, a Altinha escolherá um tema relevante do escopo selecionado.</p>
      </div>

      {/* Auto-publish */}
      <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-md">
        <div>
          <div className="text-sm font-medium">Auto-publicar</div>
          <div className="text-xs text-zinc-500">Se ativado, a matéria será publicada automaticamente. Se não, ficará como rascunho para revisão.</div>
        </div>
        <Switch checked={form.autoPublish} onCheckedChange={(v) => setForm({ ...form, autoPublish: v })} />
      </div>

      {/* Save */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button onClick={handleSave} disabled={saving} className="bg-primary">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          {schedule ? 'Salvar' : 'Criar agendamento'}
        </Button>
      </div>
    </div>
  )
}

function LogsView({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return <div className="text-center py-8 text-zinc-500 bg-white border rounded-lg">
      <History className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
      <p>Nenhuma execução registrada ainda.</p>
    </div>
  }
  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="divide-y divide-zinc-100 max-h-[600px] overflow-y-auto">
        {logs.map(log => (
          <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-zinc-50">
            <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
              log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600')}>
              {log.status === 'SUCCESS' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-900">{log.scheduleName}</div>
              {log.postTitle && <div className="text-xs text-zinc-600">→ {log.postTitle}</div>}
              {log.error && <div className="text-xs text-red-500 mt-0.5">{log.error.substring(0, 120)}</div>}
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {new Date(log.createdAt).toLocaleString('pt-BR')}
                {log.duration && ` · ${log.duration}ms`}
                {' · '}<Badge variant="outline" className="text-[10px]">{log.scope}</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
