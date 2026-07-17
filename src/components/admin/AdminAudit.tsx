'use client'

import { useEffect, useState } from 'react'
import { Search, ShieldCheck, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AuditLog {
  id: string
  actorEmail: string
  action: string
  resource: string
  resourceId: string | null
  details: string | null
  createdAt: string
}

export function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: '30' })
        if (query.trim()) params.set('q', query.trim())
        const response = await fetch(`/api/admin/audit?${params}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Falha ao carregar auditoria')
        setLogs(data.logs || [])
        setPages(data.pagination?.pages || 1)
        setTotal(data.pagination?.total || 0)
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Falha ao carregar auditoria')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [page, query])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} className="pl-9" placeholder="Buscar por administrador, ação ou recurso" />
        </div>
        <Badge variant="outline">{total.toLocaleString('pt-BR')} registros</Badge>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500"><ShieldCheck className="mx-auto mb-2 h-8 w-8 text-zinc-300" />Nenhuma ação encontrada.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {logs.map(log => (
              <div key={log.id} className="grid gap-2 p-3 text-xs md:grid-cols-[170px_1fr_1fr_160px]">
                <div className="text-zinc-500">{new Date(log.createdAt).toLocaleString('pt-BR')}</div>
                <div className="truncate font-medium text-zinc-800" title={log.actorEmail}>{log.actorEmail}</div>
                <div className="flex min-w-0 items-center gap-2"><Badge variant="secondary">{log.action}</Badge><span className="truncate">{log.resource}{log.resourceId ? ` · ${log.resourceId}` : ''}</span></div>
                <div className="truncate text-zinc-500" title={log.details || ''}>{log.details || 'Sem detalhes'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}><ChevronLeft className="h-4 w-4" /> Anterior</Button>
        <span className="text-xs text-zinc-500">Página {page} de {pages}</span>
        <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage(value => value + 1)}>Próxima <ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}
