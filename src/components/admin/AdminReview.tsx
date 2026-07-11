'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Check, X, Clock, Loader2, Eye, AlertCircle, FileText, TrendingUp, CheckCircle2,
  XCircle, Zap, RefreshCw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { REJECTION_REASONS } from '@/lib/editors'

export function AdminReview() {
  const { setView } = useAppStore()
  const { toast } = useToast()
  const [posts, setPosts] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('PENDING')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectForm, setRejectForm] = useState({ reason: 'INADEQUATE', notes: '' })
  const [processing, setProcessing] = useState<string | null>(null)

  const load = async (status = tab) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/posts/review?status=${status}`)
      const data = await res.json()
      setPosts(data.posts || [])
      setStats(data.stats || {})
    } finally { setLoading(false) }
  }

  useEffect(() => { load(tab) }, [tab])

  const handleApprove = async (postId: string) => {
    setProcessing(postId)
    try {
      const res = await fetch(`/api/posts/review/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVED' }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        toast({ title: 'Notícia aprovada e publicada!', description: 'Editor será notificado.' })
        load(tab)
      }
    } finally { setProcessing(null) }
  }

  const handleReject = async (postId: string) => {
    setProcessing(postId)
    try {
      const res = await fetch(`/api/posts/review/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECTED', ...rejectForm }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        toast({ title: 'Notícia rejeitada', description: 'Editor será notificado com o motivo.' })
        setRejecting(null)
        setRejectForm({ reason: 'INADEQUATE', notes: '' })
        load(tab)
      }
    } finally { setProcessing(null) }
  }

  const handleAutoProcess = async () => {
    const res = await fetch('/api/posts/auto-process', { method: 'POST' })
    const data = await res.json()
    if (data.error) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    } else {
      toast({ title: 'Processamento automático executado!', description: data.message })
      load(tab)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Clock} label="Aguardando revisão" value={stats.pendingCount || 0} color="bg-amber-50 text-amber-600" />
        <StatCard icon={Zap} label="Com auto-ação agendada" value={stats.autoActionDueCount || 0} color="bg-purple-50 text-purple-600" />
        <StatCard icon={CheckCircle2} label="Aprovados hoje" value={stats.todayApproved || 0} color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={XCircle} label="Rejeitados hoje" value={stats.todayRejected || 0} color="bg-red-50 text-red-600" />
      </div>

      {/* Auto-process button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleAutoProcess}>
          <RefreshCw className="h-4 w-4 mr-2" /> Processar auto-ações expiradas
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="PENDING">Pendentes ({stats.pendingCount || 0})</TabsTrigger>
          <TabsTrigger value="REVIEWED">Revisados</TabsTrigger>
          <TabsTrigger value="AUTO">Auto-ações</TabsTrigger>
          <TabsTrigger value="ALL">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-zinc-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-600">Nenhuma notícia {tab === 'PENDING' ? 'pendente' : 'encontrada'}.</p>
              </CardContent>
            </Card>
          ) : (
            posts.map((p) => (
              <Card key={p.id} className={cn(p.status === 'PENDING' && p.autoActionAt && 'border-amber-300')}>
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <div className="w-24 h-24 rounded bg-zinc-100 overflow-hidden flex-shrink-0">
                      {p.coverImage && <img src={p.coverImage} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-sm text-zinc-900 line-clamp-1">{p.title}</div>
                        <Badge className={cn('text-xs', `bg-${p.category?.color || 'slate'}-100 text-${p.category?.color || 'slate'}-800`)}>
                          {p.category?.name}
                        </Badge>
                        <StatusBadge status={p.status} />
                        {p.autoActionAt && (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Auto-ação em {new Date(p.autoActionAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>Por: <strong>{p.author?.name}</strong></span>
                        {p.author?.editorProfile && (
                          <Badge variant="outline" className="text-xs">
                            {p.author.editorProfile.level}
                          </Badge>
                        )}
                        <span>·</span>
                        <span>{new Date(p.createdAt).toLocaleString('pt-BR')}</span>
                        {p.reviewer && (
                          <>
                            <span>·</span>
                            <span>Revisado por: <strong>{p.reviewer.name}</strong></span>
                          </>
                        )}
                      </div>
                      {p.excerpt && <p className="text-xs text-zinc-600 mt-1 line-clamp-2">{p.excerpt}</p>}
                      {p.rejectionReason && (
                        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mt-2">
                          <strong>Motivo:</strong> {REJECTION_REASONS.find(r => r.value === p.rejectionReason)?.label || p.rejectionReason}
                          {p.rejectionNotes && <div className="mt-0.5">{p.rejectionNotes}</div>}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setView({ name: 'article', slug: p.slug })}
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {p.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-emerald-600 hover:bg-emerald-50"
                              onClick={() => handleApprove(p.id)}
                              disabled={processing === p.id}
                              title="Aprovar"
                            >
                              {processing === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              <span className="ml-1">Aprovar</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => { setRejecting(p.id); setRejectForm({ reason: 'INADEQUATE', notes: '' }) }}
                              title="Rejeitar"
                            >
                              <X className="h-4 w-4" />
                              <span className="ml-1">Rejeitar</span>
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Reject form */}
                      {rejecting === p.id && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded space-y-2">
                          <div>
                            <Label className="text-xs">Motivo da rejeição *</Label>
                            <Select value={rejectForm.reason} onValueChange={(v) => setRejectForm({ ...rejectForm, reason: v })}>
                              <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {REJECTION_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Notas para o editor (opcional)</Label>
                            <Textarea
                              value={rejectForm.notes}
                              onChange={(e) => setRejectForm({ ...rejectForm, notes: e.target.value })}
                              rows={2}
                              placeholder="Explique o que precisa ser corrigido..."
                              className="mt-1 bg-white"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>Cancelar</Button>
                            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => handleReject(p.id)} disabled={processing === p.id}>
                              {processing === p.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                              Confirmar rejeição
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className={`inline-flex items-center justify-center h-9 w-9 rounded-full ${color} mb-1`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="font-bold text-xl text-zinc-900">{value}</div>
        <div className="text-xs text-zinc-500">{label}</div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PUBLISHED: 'bg-emerald-100 text-emerald-800',
    PENDING: 'bg-amber-100 text-amber-800',
    REJECTED: 'bg-red-100 text-red-800',
    DRAFT: 'bg-zinc-100 text-zinc-700',
    ARCHIVED: 'bg-blue-100 text-blue-800',
    SCHEDULED: 'bg-purple-100 text-purple-800',
  }
  const labels: Record<string, string> = {
    PUBLISHED: 'Publicado', PENDING: 'Pendente', REJECTED: 'Rejeitado',
    DRAFT: 'Rascunho', ARCHIVED: 'Arquivado', SCHEDULED: 'Agendado',
  }
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${styles[status]}`}>{labels[status] || status}</span>
}
