'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Loader2, BadgeCheck, XCircle, Clock, Search, Mail, AlertCircle,
  Check, X, FileText, User as UserIcon, ShieldCheck, RefreshCw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type Status = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NONE'

const STATUS_LABELS: Record<Status, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Pendente', color: 'amber', icon: Clock },
  VERIFIED: { label: 'Verificado', color: 'emerald', icon: BadgeCheck },
  REJECTED: { label: 'Rejeitado', color: 'red', icon: XCircle },
  NONE: { label: 'Não verificado', color: 'zinc', icon: UserIcon },
}

function formatDoc(doc: string | null, type: string | null) {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (type === 'CPF') return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (type === 'CNPJ') return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return d
}

export function AdminVerifications() {
  const { toast } = useToast()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('PENDING')
  const [rejecting, setRejecting] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [stats, setStats] = useState<Record<string, number>>({ PENDING: 0, VERIFIED: 0, REJECTED: 0, NONE: 0 })

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' })
      if (statusFilter !== 'ALL') params.set('verification', statusFilter)
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/users?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar verificações')
      // Sort by verification status: PENDING first, then VERIFIED, REJECTED, NONE
      const order: Record<string, number> = { PENDING: 0, REJECTED: 1, VERIFIED: 2, NONE: 3 }
      const sorted = (data.users || []).sort((a: any, b: any) => {
        const sa = order[a.verificationStatus || 'NONE'] ?? 99
        const sb = order[b.verificationStatus || 'NONE'] ?? 99
        return sa - sb
      })
      setUsers(sorted)
      setPages(data.pagination?.pages || 1)
      setStats({ PENDING: 0, VERIFIED: 0, REJECTED: 0, NONE: 0, ...(data.stats?.byVerification || {}) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { load() }, search ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [page, search, statusFilter])

  const filtered = useMemo(() => {
    return users
  }, [users])

  const handleApprove = async (user: any) => {
    const res = await fetch('/api/admin/verifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, status: 'VERIFIED' }),
    })
    if (res.ok) {
      toast({ title: 'Verificação aprovada!', description: `${user.name} recebeu o selo verificado.` })
      load()
    } else {
      toast({ title: 'Erro ao aprovar', variant: 'destructive' })
    }
  }

  const handleReject = async () => {
    if (!rejecting) return
    const res = await fetch('/api/admin/verifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: rejecting.id, status: 'REJECTED', reason: rejectReason.trim() || undefined }),
    })
    if (res.ok) {
      toast({ title: 'Verificação rejeitada', description: rejecting ? `${rejecting.name} foi notificado.` : '' })
      setRejecting(null)
      setRejectReason('')
      load()
    } else {
      toast({ title: 'Erro ao rejeitar', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MiniStat label="Pendentes" value={stats.PENDING || 0} icon={Clock} color="amber" onClick={() => { setStatusFilter('PENDING'); setPage(1) }} />
        <MiniStat label="Verificados" value={stats.VERIFIED || 0} icon={BadgeCheck} color="emerald" onClick={() => { setStatusFilter('VERIFIED'); setPage(1) }} />
        <MiniStat label="Rejeitados" value={stats.REJECTED || 0} icon={XCircle} color="red" onClick={() => { setStatusFilter('REJECTED'); setPage(1) }} />
        <MiniStat label="Não verif." value={stats.NONE || 0} icon={UserIcon} color="zinc" onClick={() => { setStatusFilter('NONE'); setPage(1) }} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar por nome ou email..." className="pl-10 h-9" />
        </div>
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          <FilterChip label="Todas" active={statusFilter === 'ALL'} onClick={() => { setStatusFilter('ALL'); setPage(1) }} />
          <FilterChip label="Pendentes" color="amber" count={stats.PENDING} active={statusFilter === 'PENDING'} onClick={() => { setStatusFilter('PENDING'); setPage(1) }} />
          <FilterChip label="Verificados" color="emerald" count={stats.VERIFIED} active={statusFilter === 'VERIFIED'} onClick={() => { setStatusFilter('VERIFIED'); setPage(1) }} />
          <FilterChip label="Rejeitados" color="red" count={stats.REJECTED} active={statusFilter === 'REJECTED'} onClick={() => { setStatusFilter('REJECTED'); setPage(1) }} />
        </div>
      </div>

      {/* Pending alert */}
      {stats.PENDING > 0 && statusFilter !== 'PENDING' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4" />
            <span><strong>{stats.PENDING}</strong> verificação(ões) aguardando aprovação.</span>
          </div>
          <button onClick={() => { setStatusFilter('PENDING'); setPage(1) }} className="text-xs text-amber-700 font-medium hover:underline">
            Revisar agora →
          </button>
        </div>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8 text-zinc-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <ShieldCheck className="h-10 w-10 text-zinc-200 mx-auto mb-2" />
              <p>Nenhuma verificação encontrada.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {filtered.map((u) => {
                const status = (u.verificationStatus || 'NONE') as Status
                const sInfo = STATUS_LABELS[status]
                const SIcon = sInfo.icon
                const isPending = status === 'PENDING'
                return (
                  <div key={u.id} className={cn('flex items-start gap-3 p-4', isPending && 'bg-amber-50/40')}>
                    <div className="relative flex-shrink-0">
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-zinc-300 text-white flex items-center justify-center font-bold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className={cn('absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center', `bg-${sInfo.color}-500`)} title={sInfo.label}>
                        <SIcon className="h-2.5 w-2.5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-sm text-zinc-900">{u.name}</div>
                        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold', `bg-${sInfo.color}-100 text-${sInfo.color}-700`)}>
                          <SIcon className="h-2.5 w-2.5" /> {sInfo.label}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {u.email}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                        <div className="bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-400">Tipo</div>
                          <div className="font-bold text-zinc-900">{u.verificationType || '—'}</div>
                        </div>
                        <div className="bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-400">Documento</div>
                          <div className="font-bold text-zinc-900 font-mono">{formatDoc(u.verificationDoc, u.verificationType)}</div>
                        </div>
                        {u.verificationAt && (
                          <div className="bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1">
                            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Verificado em</div>
                            <div className="font-bold text-zinc-900">{new Date(u.verificationAt).toLocaleDateString('pt-BR')}</div>
                          </div>
                        )}
                        <div className="bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-400">Cadastrado</div>
                          <div className="font-bold text-zinc-900">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isPending && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(u)} className="bg-emerald-600 hover:bg-emerald-700 h-8">
                            <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejecting(u)} className="text-red-600 border-red-300 hover:bg-red-50 h-8">
                            <X className="h-3.5 w-3.5 mr-1" /> Rejeitar
                          </Button>
                        </>
                      )}
                      {status === 'VERIFIED' && (
                        <Button size="sm" variant="outline" onClick={() => setRejecting(u)} className="text-red-600 border-red-300 hover:bg-red-50 h-8">
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Revogar
                        </Button>
                      )}
                      {status === 'REJECTED' && (
                        <Button size="sm" onClick={() => handleApprove(u)} className="bg-emerald-600 hover:bg-emerald-700 h-8">
                          <Check className="h-3.5 w-3.5 mr-1" /> Aprovar agora
                        </Button>
                      )}
                      {status === 'NONE' && (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Anterior</Button>
        <span className="text-xs text-zinc-500">Página {page} de {pages}</span>
        <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage(value => value + 1)}>Próxima</Button>
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-4 w-4 text-red-600" />
              {rejecting?.verificationStatus === 'VERIFIED' ? 'Revogar verificação' : 'Rejeitar verificação'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-zinc-50 rounded-md p-3">
              <div className="text-xs text-zinc-500">Usuário</div>
              <div className="font-bold text-zinc-900">{rejecting?.name}</div>
              <div className="text-xs text-zinc-500">{rejecting?.email}</div>
              <div className="text-xs font-mono mt-1">{formatDoc(rejecting?.verificationDoc, rejecting?.verificationType)}</div>
            </div>
            <div>
              <Label className="text-sm">Motivo (opcional)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: Documento ilegível, CPF inválido, etc. (será enviado ao usuário)"
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                O usuário será notificado e poderá reenviar a verificação com correções.
                O selo verificado será removido imediatamente.
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejecting(null)}>Cancelar</Button>
              <Button onClick={handleReject} className="bg-red-600 hover:bg-red-700">
                <XCircle className="h-4 w-4 mr-2" />
                {rejecting?.verificationStatus === 'VERIFIED' ? 'Revogar verificação' : 'Rejeitar verificação'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MiniStat({ label, value, icon: Icon, color, onClick }: { label: string; value: number; icon: any; color: string; onClick?: () => void }) {
  const colors: Record<string, string> = {
    zinc: 'bg-zinc-50 text-zinc-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className={cn('rounded-lg p-2.5 cursor-pointer hover:brightness-95 transition', colors[color])} onClick={onClick}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-70 mb-0.5">
        <Icon className="h-3 w-3" /> <span>{label}</span>
      </div>
      <div className="text-lg font-black">{value}</div>
    </div>
  )
}

function FilterChip({ label, color, count, active, onClick }: { label: string; color?: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1',
        active
          ? color ? `bg-${color}-600 text-white` : 'bg-zinc-800 text-white'
          : 'text-zinc-600 hover:text-zinc-900'
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn('text-[10px] rounded-full px-1', active ? 'bg-white/20' : 'bg-zinc-200')}>{count}</span>
      )}
    </button>
  )
}
