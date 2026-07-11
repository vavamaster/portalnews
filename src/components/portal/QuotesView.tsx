'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  DollarSign, Wheat, Beef, Coffee, Milk, TrendingUp, TrendingDown, Minus,
  ChevronLeft, Loader2, MapPin, ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const ICON_MAP: Record<string, any> = { DollarSign, Wheat, Beef, Coffee, Milk }
const COLOR_MAP: Record<string, string> = {
  green: 'border-emerald-400',
  amber: 'border-amber-400',
  rose: 'border-rose-400',
}
const CATEGORY_LABELS: Record<string, string> = {
  CURRENCY: 'Moeda',
  AGRICULTURAL: 'Produtos Agrícolas',
  LIVESTOCK: 'Pecuária',
}

const BRAZILIAN_STATES = [
  { code: 'ALL', name: 'Nacional' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'GO', name: 'Goiás' },
  { code: 'PR', name: 'Paraná' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'BA', name: 'Bahia' },
  { code: 'TO', name: 'Tocantins' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'DF', name: 'Distrito Federal' },
]

export function QuotesView() {
  const { setView } = useAppStore()
  const [quotes, setQuotes] = useState<any[]>([])
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedState, setSelectedState] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('quote-state') || 'MT'
    return 'MT'
  })

  useEffect(() => {
    fetch(`/api/quotes/all?state=${selectedState}`)
      .then(r => r.json())
      .then(data => {
        setQuotes(data.quotes || [])
        setGrouped(data.grouped || {})
      })
      .finally(() => setLoading(false))
  }, [selectedState])

  const currentState = BRAZILIAN_STATES.find(s => s.code === selectedState) || BRAZILIAN_STATES[0]

  if (loading) {
    return (
      <div className="news-container py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
      </div>
    )
  }

  return (
    <div className="news-container py-6 animate-fade-in">
      <button onClick={() => setView({ name: 'home' } as any)} className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-primary mb-4">
        <ChevronLeft className="h-4 w-4" /> Voltar ao início
      </button>

      <div className="mb-6 pb-4 border-b border-zinc-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl text-zinc-900" style={{ fontWeight: 500 }}>Cotações Agropecuárias</h1>
            <p className="text-zinc-500 mt-1 text-sm">Dólar, produtos agrícolas e pecuários — {currentState.name}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm hover:border-primary transition-colors whitespace-nowrap">
                <MapPin className="h-4 w-4 text-primary" />
                <span style={{ fontWeight: 500 }}>{currentState.name}</span>
                <ChevronDown className="h-3 w-3 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto w-56">
              <DropdownMenuLabel>Selecionar estado</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {BRAZILIAN_STATES.map(s => (
                <DropdownMenuItem
                  key={s.code}
                  onClick={() => { setSelectedState(s.code); localStorage.setItem('quote-state', s.code) }}
                  className={cn('cursor-pointer', selectedState === s.code && 'bg-accent')}
                >
                  <span className="flex-1">{s.name}</span>
                  {s.code !== 'ALL' && <span className="text-xs text-zinc-400">{s.code}</span>}
                  {selectedState === s.code && <span className="text-primary ml-1">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {Object.entries(grouped).map(([category, catQuotes]) => (
        <div key={category} className="mb-8">
          <h2 className="text-xl text-zinc-900 mb-4 flex items-center gap-2" style={{ fontWeight: 500 }}>
            <span className={cn('h-1.5 w-8 rounded-full', category === 'CURRENCY' ? 'bg-emerald-500' : category === 'AGRICULTURAL' ? 'bg-amber-500' : 'bg-rose-500')} />
            {CATEGORY_LABELS[category] || category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catQuotes.map((q) => {
              const Icon = ICON_MAP[q.product.icon] || DollarSign
              const colors = COLOR_MAP[q.product.color] || 'border-zinc-300'
              const variation = q.variation
              const isPositive = variation !== null && variation > 0
              const isNegative = variation !== null && variation < 0
              return (
                <Card key={q.id} className={cn('border-l-4', colors)}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', q.product.color === 'green' ? 'bg-emerald-50' : q.product.color === 'amber' ? 'bg-amber-50' : 'bg-rose-50')}>
                          <Icon className={cn('h-5 w-5', q.product.color === 'green' ? 'text-emerald-600' : q.product.color === 'amber' ? 'text-amber-600' : 'text-rose-600')} />
                        </div>
                        <div>
                          <div className="text-sm text-zinc-900" style={{ fontWeight: 500 }}>{q.product.name}</div>
                          <div className="text-xs text-zinc-500">{q.product.unit}</div>
                        </div>
                      </div>
                      {q.isFallback && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">cache</span>}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-numeric text-zinc-900" style={{ fontWeight: 500 }}>
                        {q.valueText || q.value.toFixed(q.product.decimals)}
                      </div>
                      {variation !== null && (
                        <div className={cn('flex items-center gap-1 text-sm', isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-zinc-400')}>
                          {isPositive && <TrendingUp className="h-3.5 w-3.5" />}
                          {isNegative && <TrendingDown className="h-3.5 w-3.5" />}
                          {variation === 0 && <Minus className="h-3.5 w-3.5" />}
                          <span style={{ fontWeight: 500 }}>{isPositive ? '+' : ''}{variation.toFixed(2)}%</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-50">
                      Atualizado: {new Date(q.fetchedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      <div className="text-center text-xs text-zinc-400 mt-8 pb-4">
        {quotes.length} indicadores · Fontes: AwesomeAPI (dólar), CEPEA/Conab (agropecuária) · Atualização automática a cada 6h
      </div>
    </div>
  )
}
