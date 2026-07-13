'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DollarSign, Wheat, Beef, Coffee, Milk, TrendingUp, TrendingDown, Minus,
  RefreshCw, Loader2, Database, Settings, History, Calendar, Filter,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { useApiError } from '@/hooks/use-api-error'

const ICON_MAP: Record<string, any> = { DollarSign, Wheat, Beef, Coffee, Milk }
const COLOR_MAP: Record<string, string> = {
  green: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  amber: 'text-amber-600 bg-amber-50 border-amber-200',
  rose: 'text-rose-600 bg-rose-50 border-rose-200',
}

const CATEGORY_LABELS: Record<string, string> = {
  CURRENCY: 'Moeda',
  AGRICULTURAL: 'Agrícola',
  LIVESTOCK: 'Pecuária',
}

export function AdminQuotes() {
  const { toast } = useToast()
  const apiError = useApiError()
  const [products, setProducts] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [filters, setFilters] = useState({
    productId: 'ALL',
    category: 'ALL',
    startDate: '',
    endDate: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/quotes')
      const data = await res.json()
      setProducts(data.products || [])
      setSources(data.sources || [])
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.productId !== 'ALL') params.set('productId', filters.productId)
      if (filters.category !== 'ALL') params.set('category', filters.category)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      params.set('limit', '200')
      const res = await fetch(`/api/quotes/history?${params.toString()}`)
      const data = await res.json()
      setHistory(data.quotes || [])
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadHistory()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [filters])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/quotes/refresh', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        toast({
          title: 'Cotações atualizadas!',
          description: data.message,
        })
        load()
      }
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return <LoadingSpinner label="Carregando cotações..." className="py-0" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">
          {products.length} produto(s) monitorado(s) · {sources.length} fonte(s) de dados
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} className="bg-primary">
          {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar cotações
        </Button>
      </div>

      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Cotações Atuais</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="sources">Fontes & Produtos</TabsTrigger>
        </TabsList>

        {/* Current quotes */}
        <TabsContent value="current" className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((p) => {
              const Icon = ICON_MAP[p.icon] || DollarSign
              const colors = COLOR_MAP[p.color] || COLOR_MAP.green
              const quote = p.latestQuote
              const variation = quote?.variation
              const isPositive = variation !== null && variation !== undefined && variation > 0
              const isNegative = variation !== null && variation !== undefined && variation < 0

              return (
                <Card key={p.id} className={cn('border-l-4', `border-l-${p.color}-400`)}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn('p-1.5 rounded-md border', colors)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm text-zinc-900" style={{ fontWeight: 500 }}>{p.name}</div>
                          <div className="text-xs text-zinc-500">{CATEGORY_LABELS[p.category]} · {p.unit}</div>
                        </div>
                      </div>
                      {quote?.isFallback && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px]">cache</Badge>
                      )}
                    </div>
                    {quote ? (
                      <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-numeric text-zinc-900" style={{ fontWeight: 500 }}>
                          {quote.valueText || formatValue(quote.value, p.unit, p.decimals)}
                        </div>
                        {variation !== null && variation !== undefined && (
                          <div className={cn(
                            'flex items-center gap-1 text-sm',
                            isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-zinc-400'
                          )}>
                            {isPositive && <TrendingUp className="h-3 w-3" />}
                            {isNegative && <TrendingDown className="h-3 w-3" />}
                            {variation === 0 && <Minus className="h-3 w-3" />}
                            <span>{isPositive ? '+' : ''}{variation.toFixed(2)}%</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-zinc-400">Sem cotação</div>
                    )}
                    {quote && (
                      <div className="text-xs text-zinc-400 mt-2">
                        Atualizado: {new Date(quote.fetchedAt).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-3">
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Produto</Label>
                  <Select value={filters.productId} onValueChange={(v) => setFilters({ ...filters, productId: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos</SelectItem>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Categoria</Label>
                  <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas</SelectItem>
                      <SelectItem value="CURRENCY">Moeda</SelectItem>
                      <SelectItem value="AGRICULTURAL">Agrícola</SelectItem>
                      <SelectItem value="LIVESTOCK">Pecuária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Data inicial</Label>
                  <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Data final</Label>
                  <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {historyLoading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-400" /></div>
          ) : history.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-zinc-500">Nenhum registro encontrado.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Data</th>
                        <th className="text-left p-3 font-medium">Produto</th>
                        <th className="text-left p-3 font-medium">Categoria</th>
                        <th className="text-right p-3 font-medium">Valor</th>
                        <th className="text-right p-3 font-medium">Variação</th>
                        <th className="text-center p-3 font-medium">Fonte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(0, 100).map((q) => {
                        const variation = q.variation
                        const isPositive = variation !== null && variation > 0
                        const isNegative = variation !== null && variation < 0
                        return (
                          <tr key={q.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                            <td className="p-3 text-xs text-zinc-500">{new Date(q.quotedAt).toLocaleString('pt-BR')}</td>
                            <td className="p-3 text-zinc-900" style={{ fontWeight: 500 }}>{q.product?.name}</td>
                            <td className="p-3"><Badge variant="outline" className="text-xs">{CATEGORY_LABELS[q.product?.category]}</Badge></td>
                            <td className="p-3 text-right font-numeric">{q.valueText || formatValue(q.value, q.product?.unit, q.product?.decimals)}</td>
                            <td className={cn('p-3 text-right', isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-zinc-400')}>
                              {variation !== null ? `${isPositive ? '+' : ''}${variation.toFixed(2)}%` : '—'}
                            </td>
                            <td className="p-3 text-center">
                              {q.isFallback ? <Badge variant="outline" className="text-amber-700 text-[10px]">cache</Badge> : <Badge variant="outline" className="text-emerald-700 text-[10px]">online</Badge>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {history.length > 100 && (
                  <div className="p-3 text-center text-xs text-zinc-500">Mostrando 100 de {history.length} registros</div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Sources & Products management */}
        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Fontes de Dados</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sources.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="text-sm text-zinc-900 flex items-center gap-2" style={{ fontWeight: 500 }}>
                        {s.name}
                        {s.isActive ? <Badge variant="outline" className="text-emerald-700 text-[10px]">ativo</Badge> : <Badge variant="outline" className="text-zinc-500 text-[10px]">inativo</Badge>}
                      </div>
                      <div className="text-xs text-zinc-500">{s.description}</div>
                      {s.baseUrl && <div className="text-xs text-zinc-400 mt-0.5">{s.baseUrl}</div>}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {s._count?.products || 0} produto(s)
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Produtos Monitorados</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {products.map(p => {
                  const Icon = ICON_MAP[p.icon] || DollarSign
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-1.5 rounded border', COLOR_MAP[p.color] || COLOR_MAP.green)}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-sm text-zinc-900 flex items-center gap-2" style={{ fontWeight: 500 }}>
                            {p.name}
                            {p.isActive ? <Badge variant="outline" className="text-emerald-700 text-[10px]">ativo</Badge> : <Badge variant="outline" className="text-zinc-500 text-[10px]">inativo</Badge>}
                            {p.showInHeader ? <Badge variant="outline" className="text-blue-700 text-[10px]">header</Badge> : <Badge variant="outline" className="text-zinc-400 text-[10px]">oculto</Badge>}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {CATEGORY_LABELS[p.category]} · {p.unit} · fonte: {p.source?.name} · {p._count?.quotes || 0} cotações
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/quotes/products/${p.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ showInHeader: !p.showInHeader }),
                            })
                            load()
                          }}
                          className={cn(
                            'px-2 py-1 rounded text-xs transition-colors',
                            p.showInHeader ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                          )}
                        >
                          {p.showInHeader ? 'No header ✓' : 'No header'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function formatValue(value: number, unit: string, decimals: number = 2): string {
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  if (unit === 'R$') return `R$ ${formatted}`
  return `${formatted} ${unit}`
}
