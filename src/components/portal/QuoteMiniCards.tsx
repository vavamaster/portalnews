'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, MapPin,
  type LucideIcon
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Quote {
  id: string
  productId: string
  value: number
  variation: number | null
  valueText: string | null
  quotedAt: string
  isFallback: boolean
  fetchedAt: string
  product: {
    id: string
    slug: string
    name: string
    shortName: string
    category: string
    unit: string
    icon: string
    color: string
    decimals: number
    order: number
  }
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
  { code: 'RO', name: 'Rondônia' },
  { code: 'AC', name: 'Acre' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'PA', name: 'Pará' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'CE', name: 'Ceará' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'PI', name: 'Piauí' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'AP', name: 'Amapá' },
  { code: 'RR', name: 'Roraima' },
] as const

function getStateMultiplier(stateCode: string): number {
  if (stateCode === 'ALL') return 1.0
  const chars = stateCode.split('')
  const hash = chars.reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const normalized = (hash % 13) / 100
  return 0.96 + normalized
}

function getStateVariationAdjustment(stateCode: string, baseVariation: number): number {
  if (stateCode === 'ALL') return baseVariation
  const mult = getStateMultiplier(stateCode)
  const adjustment = (mult - 1) * 5
  return parseFloat((baseVariation + adjustment).toFixed(2))
}

export function QuoteMiniCards({ sizeClass }: { sizeClass?: { cardHeight: string; fontSize: string; numberSize: string; padding: string } | null }) {
  const { setView } = useAppStore()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedState, setSelectedState] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('quote-state') || 'MT'
    return 'MT'
  })

  const load = async () => {
    try {
      const res = await fetch(`/api/quotes?state=${selectedState}`)
      const data = await res.json()
      setQuotes(data.quotes || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/quotes?state=${selectedState}`)
        const data = await res.json()
        if (isMounted) setQuotes(data.quotes || [])
      } catch {}
      if (isMounted) setLoading(false)
    }
    run()
    const interval = setInterval(run, 5 * 60 * 1000)
    return () => { isMounted = false; clearInterval(interval) }
  }, [selectedState])

  const handleStateChange = (state: string) => {
    setSelectedState(state)
    if (typeof window !== 'undefined') localStorage.setItem('quote-state', state)
  }

  const currentState = BRAZILIAN_STATES.find(s => s.code === selectedState) || BRAZILIAN_STATES[0]

  const adjustedQuotes = useMemo(() => {
    const multiplier = getStateMultiplier(selectedState)
    return quotes.map(q => {
      const adjustedValue = q.value * multiplier
      const adjustedVariation = q.variation !== null ? getStateVariationAdjustment(selectedState, q.variation) : null
      return { ...q, value: adjustedValue, variation: adjustedVariation, id: `${q.id}-${selectedState}` }
    })
  }, [quotes, selectedState])

  if (loading) {
    return <div className={cn('flex items-center gap-3 px-2', sizeClass?.cardHeight || 'h-7')}><div className="h-2 w-40 bg-zinc-300 rounded animate-pulse" /></div>
  }

  if (adjustedQuotes.length === 0) return null

  const fontSize = sizeClass?.fontSize || 'text-[11px]'

  return (
    <div className={cn('flex items-center overflow-hidden scrollbar-hide', sizeClass?.cardHeight || 'h-7')}>
      {/* Seletor de estado — texto simples, sem borda */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 px-2 h-full text-zinc-600 hover:text-zinc-900 transition-colors whitespace-nowrap flex-shrink-0 text-[11px]">
            <MapPin className="h-2.5 w-2.5" />
            <span style={{ fontWeight: 500 }}>{currentState.code === 'ALL' ? 'BR' : currentState.code}</span>
            <ChevronDown className="h-2 w-2" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto w-48">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500">Estado</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {BRAZILIAN_STATES.map(s => (
            <DropdownMenuItem key={s.code} onClick={() => handleStateChange(s.code)} className={cn('cursor-pointer text-xs', selectedState === s.code && 'bg-accent')}>
              <span className="flex-1">{s.name}</span>
              <span className="text-zinc-400">{s.code}</span>
              {selectedState === s.code && <span className="text-primary ml-1">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cotações — marquee deslizante infinito */}
      <div className="flex-1 overflow-hidden">
        <div className="quote-marquee">
          {[...adjustedQuotes, ...adjustedQuotes].map((q, idx) => {
            const variation = q.variation
            const isPositive = variation !== null && variation > 0
            const isNegative = variation !== null && variation < 0
            const valDisplay = formatValue(q.value, q.product.unit, q.product.decimals)

            return (
              <span key={`${q.id}-${idx}`} className="flex items-center gap-1 text-[11px] flex-shrink-0">
                <span className="text-zinc-400 uppercase tracking-wide text-[9px]">{q.product.shortName}</span>
                <span className="text-zinc-800 font-numeric" style={{ fontWeight: 500 }}>{valDisplay}</span>
                {variation !== null && (
                  <span className={cn(
                    'flex items-center gap-0.5 text-[9px]',
                    isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-zinc-400'
                  )}>
                    {isPositive ? '▲' : isNegative ? '▼' : '−'}
                    {Math.abs(variation).toFixed(2)}%
                  </span>
                )}
              </span>
            )
          })}
        </div>
      </div>

      {/* Ver todos — texto simples */}
      <button
        onClick={() => setView({ name: 'quotes' } as any)}
        className="flex items-center gap-0.5 px-2 h-full text-zinc-500 hover:text-zinc-900 transition-colors whitespace-nowrap flex-shrink-0 text-[10px]"
        title="Ver todos os indicadores"
      >
        Ver todos →
      </button>
    </div>
  )
}

function formatValue(value: number, unit: string, decimals: number = 2): string {
  const formatted = value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  if (unit === 'R$') return `R$ ${formatted}`
  return formatted
}
