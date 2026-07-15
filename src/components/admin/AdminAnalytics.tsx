'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { useApiError } from '@/hooks/use-api-error'
import {
  cn,
  formatDate,
  formatNumber,
  getColorClasses,
} from '@/lib/utils'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  MousePointerClick,
  Clock,
  Globe,
  MapPin,
  Smartphone,
  Chrome,
  Monitor,
  Share2,
  FileDown,
  Printer,
  Activity,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

type Range = '24h' | '7d' | '30d' | '90d' | 'all'
type Tab = 'overview' | 'geografia' | 'paginas' | 'origens' | 'dispositivos' | 'ips' | 'cidades'

interface OverviewData {
  range: string
  totalViews: number
  uniqueVisitors: number
  uniqueSessions: number
  viewsToday: number
  viewsYesterday: number
  viewsWeek: number
  viewsMonth: number
  growthRate: number
  bounceRate: number
  avgPagesPerSession: number
  avgResponseTimeMs: number
  top: {
    country: { code: string; name: string; count: number } | null
    city: { name: string; countryCode: string; count: number } | null
    referrer: { domain: string; type: string; count: number } | null
    path: { path: string; type: string; count: number } | null
    browser: { name: string; count: number } | null
    os: { name: string; count: number } | null
    device: { type: string; count: number } | null
  }
}

interface CountryRow {
  countryCode: string
  country: string
  latitude: number
  longitude: number
  views: number
  uniqueVisitors: number
}
interface CountriesData { countries: CountryRow[]; total: number }

interface CityRow {
  city: string
  countryCode: string
  country: string
  region: string | null
  views: number
}
interface CitiesData { cities: CityRow[]; total: number }

interface PathRow {
  path: string
  pathType: string
  refSlug: string | null
  views: number
}
interface PathsData { paths: PathRow[]; total: number }

interface ReferrerDomainRow { domain: string; type: string; views: number }
interface ReferrerTypeRow { type: string; views: number }
interface ReferrersData {
  domains: ReferrerDomainRow[]
  types: ReferrerTypeRow[]
}

interface DeviceRow { name: string; views: number }
interface DeviceTypeRow { type: string; views: number }
interface DevicesData {
  browsers: DeviceRow[]
  oss: DeviceRow[]
  devices: DeviceTypeRow[]
}

interface IpRow {
  rank: number
  ipHashShort: string
  country: string | null
  countryCode: string | null
  city: string | null
  isp: string | null
  views: number
}
interface IpsData { ips: IpRow[]; total: number }

interface TimelineBucket { date: string; views: number; visitors: number }
interface TimelineData {
  bucketSize: 'hour' | 'day'
  buckets: TimelineBucket[]
}

interface RealtimeActivePath { path: string; type: string; views: number }
interface RealtimeData {
  activeViews: number
  activeVisitors: number
  activePaths: RealtimeActivePath[]
}

interface SeoSettings {
  site_name?: string
  site_logo?: string
  site_tagline?: string
  site_url?: string
}

// ============================================================
// Helpers
// ============================================================

const RANGE_LABEL: Record<Range, string> = {
  '24h': '24 horas',
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  'all': 'Todo o período',
}

const RANGE_START_LABEL: Record<Range, string> = {
  '24h': 'Últimas 24 horas',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  'all': 'Desde o início',
}

const TABS: { id: Tab; label: string; icon: typeof Globe }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'geografia', label: 'Geografia', icon: Globe },
  { id: 'paginas', label: 'Páginas', icon: Eye },
  { id: 'origens', label: 'Origens', icon: Share2 },
  { id: 'dispositivos', label: 'Dispositivos', icon: Monitor },
  { id: 'ips', label: 'IPs', icon: Smartphone },
  { id: 'cidades', label: 'Cidades', icon: MapPin },
]

/** Convert ISO 3166-1 alpha-2 country code → flag emoji. */
function countryFlag(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) return '🏳️'
  const cc = countryCode.toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return '🏳️'
  const A = 0x1f1e6 - 65 // 'A'.charCodeAt(0)
  return String.fromCodePoint(cc.charCodeAt(0) + A, cc.charCodeAt(1) + A)
}

/** Map referrer type to a color name usable with getColorClasses(). */
function referrerTypeColor(type: string): string {
  const t = (type || '').toUpperCase()
  switch (t) {
    case 'SEARCH': return 'blue'
    case 'SOCIAL': return 'purple'
    case 'DIRECT': return 'emerald'
    case 'REFERRAL': return 'amber'
    case 'INTERNAL': return 'teal'
    default: return 'zinc'
  }
}

function pathTypeColor(type: string): string {
  const t = (type || '').toUpperCase()
  switch (t) {
    case 'ARTICLE': return 'blue'
    case 'CATEGORY': return 'emerald'
    case 'HOME': return 'amber'
    case 'AUTHOR': return 'purple'
    case 'PAGE': return 'teal'
    case 'LISTING': return 'rose'
    default: return 'zinc'
  }
}

function deviceTypeColor(type: string): string {
  const t = (type || '').toUpperCase()
  switch (t) {
    case 'DESKTOP': return 'blue'
    case 'MOBILE': return 'emerald'
    case 'TABLET': return 'amber'
    case 'BOT': return 'rose'
    default: return 'zinc'
  }
}

// ============================================================
// SVG line chart
// ============================================================

function LineChart({ data, bucketSize }: { data: TimelineBucket[]; bucketSize: 'hour' | 'day' }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const W = 720
  const H = 240
  const PAD_L = 40
  const PAD_R = 40
  const PAD_T = 16
  const PAD_B = 28
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const maxViews = Math.max(1, ...data.map((d) => d.views))
  const maxVisitors = Math.max(1, ...data.map((d) => d.visitors))

  const xAt = (i: number) =>
    data.length <= 1 ? PAD_L : PAD_L + (i / (data.length - 1)) * innerW
  const yViews = (v: number) => PAD_T + innerH - (v / maxViews) * innerH
  const yVisitors = (v: number) => PAD_T + innerH - (v / maxVisitors) * innerH

  const viewsPoints = data.map((d, i) => `${xAt(i)},${yViews(d.views)}`).join(' ')
  const visitorsPoints = data.map((d, i) => `${xAt(i)},${yVisitors(d.visitors)}`).join(' ')
  const areaPath = data.length
    ? `M ${xAt(0)},${yViews(data[0].views)} L ${data.map((d, i) => `${xAt(i)},${yViews(d.views)}`).join(' L ')} L ${xAt(data.length - 1)},${PAD_T + innerH} L ${xAt(0)},${PAD_T + innerH} Z`
    : ''

  // Y-axis ticks (4 lines)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: PAD_T + innerH - p * innerH,
    val: Math.round(maxViews * p),
  }))

  // X-axis labels — sparse, show ~6 evenly spaced
  const labelStep = Math.max(1, Math.ceil(data.length / 6))
  const xLabels = data
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % labelStep === 0 || i === data.length - 1)

  function fmtXLabel(dateStr: string): string {
    const d = new Date(dateStr)
    if (bucketSize === 'hour') {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  function handleMove(e: React.MouseEvent<SVGElement>) {
    if (!containerRef.current || data.length === 0) return
    const svg = e.currentTarget as SVGElement
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    // map x → nearest index
    const ratio = (x - PAD_L) / innerW
    const idx = Math.round(ratio * (data.length - 1))
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)))
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        preserveAspectRatio="none"
        role="img"
        aria-label="Gráfico de visualizações e visitantes ao longo do tempo"
      >
        {/* Y grid lines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={t.y}
              x2={W - PAD_R}
              y2={t.y}
              stroke="#e4e4e7"
              strokeDasharray="3 3"
            />
            <text x={PAD_L - 6} y={t.y + 3} textAnchor="end" className="fill-zinc-400" fontSize="9">
              {formatNumber(t.val)}
            </text>
          </g>
        ))}

        {/* Area under views line */}
        {areaPath && (
          <path d={areaPath} fill="#2563eb" fillOpacity="0.10" stroke="none" />
        )}

        {/* Views line */}
        <polyline
          points={viewsPoints}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Visitors line */}
        <polyline
          points={visitorsPoints}
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
          strokeDasharray="4 2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X-axis labels */}
        {xLabels.map(({ d, i }) => (
          <text
            key={i}
            x={xAt(i)}
            y={H - 8}
            textAnchor="middle"
            className="fill-zinc-400"
            fontSize="9"
          >
            {fmtXLabel(d.date)}
          </text>
        ))}

        {/* Hover marker */}
        {hoverIdx !== null && data[hoverIdx] && (
          <g>
            <line
              x1={xAt(hoverIdx)}
              y1={PAD_T}
              x2={xAt(hoverIdx)}
              y2={PAD_T + innerH}
              stroke="#a1a1aa"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle cx={xAt(hoverIdx)} cy={yViews(data[hoverIdx].views)} r="4" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
            <circle cx={xAt(hoverIdx)} cy={yVisitors(data[hoverIdx].visitors)} r="4" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && data[hoverIdx] && (
        <div
          className="pointer-events-none absolute z-10 bg-white border border-zinc-200 rounded-md shadow-md px-2.5 py-1.5 text-xs"
          style={{
            left: `${(xAt(hoverIdx) / W) * 100}%`,
            top: 8,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold text-zinc-900 mb-0.5">
            {bucketSize === 'hour'
              ? new Date(data[hoverIdx].date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : new Date(data[hoverIdx].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </div>
          <div className="flex items-center gap-1.5 text-blue-600">
            <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
            Views: <strong>{formatNumber(data[hoverIdx].views)}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-600 inline-block" />
            Visitantes: <strong>{formatNumber(data[hoverIdx].visitors)}</strong>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-full bg-blue-600" /> Visualizações
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-full bg-emerald-600" /> Visitantes únicos
        </span>
      </div>
    </div>
  )
}

// ============================================================
// Donut chart
// ============================================================

function Donut({
  data,
  size = 120,
  thickness = 16,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number; color: string }[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2

  let offset = 0
  const segments = data.map((d) => {
    const frac = total > 0 ? d.value / total : 0
    const seg = {
      color: d.color,
      dasharray: `${frac * c} ${c}`,
      dashoffset: -offset * c,
      label: d.label,
      value: d.value,
      pct: total > 0 ? (frac * 100) : 0,
    }
    offset += frac
    return seg
  })

  const colorHex: Record<string, string> = {
    blue: '#2563eb',
    emerald: '#10b981',
    amber: '#f59e0b',
    purple: '#7c3aed',
    teal: '#14b8a6',
    rose: '#f43f5e',
    zinc: '#71717a',
    cyan: '#06b6d4',
    orange: '#f97316',
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={`Donut: ${centerLabel || ''}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f4f4f5" strokeWidth={thickness} />
          {total > 0 && segments.map((s, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={colorHex[s.color] || s.color}
              strokeWidth={thickness}
              strokeDasharray={s.dasharray}
              strokeDashoffset={s.dashoffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && (
              <div className="font-bold text-zinc-900 text-sm leading-tight">{centerValue}</div>
            )}
            {centerLabel && (
              <div className="text-[10px] text-zinc-500">{centerLabel}</div>
            )}
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="space-y-1 w-full">
        {data.slice(0, 5).map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: colorHex[d.color] || d.color }} />
              <span className="truncate text-zinc-700">{d.label}</span>
            </span>
            <span className="font-medium text-zinc-900 ml-2">
              {total > 0 ? `${((d.value / total) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// World map (equirectangular)
// ============================================================

function WorldMap({ countries }: { countries: CountryRow[] }) {
  const [hover, setHover] = useState<{ c: CountryRow; x: number; y: number } | null>(null)
  const W = 720
  const H = 360

  function project(lat: number, lon: number) {
    const x = ((lon + 180) / 360) * W
    const y = ((90 - lat) / 180) * H
    return { x, y }
  }

  const maxViews = Math.max(1, ...countries.map((c) => c.views))
  function dotRadius(views: number) {
    const min = 3
    const max = 14
    return min + (max - min) * Math.sqrt(views / maxViews)
  }

  // Render top 30 dots (avoid clutter)
  const dots = countries.slice(0, 30)

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto border border-zinc-200 rounded-md bg-gradient-to-br from-blue-50/40 to-emerald-50/30"
        role="img"
        aria-label="Mapa mundi com distribuição de visualizações por país"
      >
        {/* Continents placeholder — simple silhouettes via rounded rects */}
        <g fill="#e4e4e7" fillOpacity="0.55" stroke="#d4d4d8" strokeWidth="0.5">
          {/* North America */}
          <path d="M 80 70 Q 130 50 200 60 L 230 110 Q 220 150 180 170 L 130 175 Q 90 150 70 110 Z" />
          {/* South America */}
          <path d="M 190 200 Q 220 200 235 230 L 240 290 Q 220 320 200 320 L 180 290 Q 175 240 190 200 Z" />
          {/* Europe */}
          <path d="M 340 80 L 400 75 L 415 110 L 385 130 L 345 120 Z" />
          {/* Africa */}
          <path d="M 360 150 Q 400 145 430 175 L 440 245 Q 420 285 390 280 L 365 240 Q 350 195 360 150 Z" />
          {/* Asia */}
          <path d="M 420 70 Q 540 60 620 90 L 640 150 Q 600 180 540 175 L 460 160 Q 420 130 420 90 Z" />
          {/* Oceania */}
          <path d="M 560 230 Q 620 225 640 250 L 625 280 L 580 275 Q 560 255 560 235 Z" />
        </g>

        {/* Latitude lines */}
        <g stroke="#e4e4e7" strokeWidth="0.5" strokeDasharray="2 3" fill="none">
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} />
          <line x1={W / 2} y1="0" x2={W / 2} y2={H} />
        </g>

        {/* Country dots */}
        {dots.map((c, i) => {
          if (typeof c.latitude !== 'number' || typeof c.longitude !== 'number') return null
          if (Number.isNaN(c.latitude) || Number.isNaN(c.longitude)) return null
          const { x, y } = project(c.latitude, c.longitude)
          const r = dotRadius(c.views)
          return (
            <g key={`${c.countryCode}-${i}`}>
              <circle
                cx={x}
                cy={y}
                r={r}
                fill="#2563eb"
                fillOpacity="0.55"
                stroke="#2563eb"
                strokeWidth="1"
                className="cursor-pointer transition-all hover:fill-opacity-90"
                onMouseEnter={() => setHover({ c, x, y })}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          )
        })}
      </svg>

      {/* Hover tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 bg-white border border-zinc-200 rounded-md shadow-md px-2.5 py-1.5 text-xs"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 8px))',
          }}
        >
          <div className="font-semibold text-zinc-900">
            {countryFlag(hover.c.countryCode)} {hover.c.country || hover.c.countryCode}
          </div>
          <div className="text-blue-600">{formatNumber(hover.c.views)} views</div>
        </div>
      )}

      <p className="text-xs text-zinc-500 mt-2 text-center">
        Pontos representam países com tráfego no período (até 30 maiores). Passe o mouse para detalhes.
      </p>
    </div>
  )
}

// ============================================================
// Stat card (overview)
// ============================================================

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  iconClass,
}: {
  icon: typeof Users
  label: string
  value: string
  sub?: React.ReactNode
  trend?: number | null
  iconClass?: string
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className={cn('inline-flex items-center justify-center h-10 w-10 rounded-full', iconClass || 'bg-blue-50 text-blue-600')}>
            <Icon className="h-5 w-5" />
          </div>
          {typeof trend === 'number' && !Number.isNaN(trend) && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md',
                trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              )}
            >
              {trend >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="font-bold text-2xl text-zinc-900 mt-3">{value}</div>
        <div className="text-xs text-zinc-500">{label}</div>
        {sub && <div className="text-[11px] text-zinc-400 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Realtime card
// ============================================================

function RealtimeCard({ data, loading }: { data: RealtimeData | null; loading: boolean }) {
  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white">
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="font-semibold text-zinc-900 text-sm">Tempo real (últimos 5 min)</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="font-bold text-xl text-emerald-700">
                {loading ? '—' : formatNumber(data?.activeVisitors ?? 0)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Visitantes ativos</div>
            </div>
            <div className="h-8 w-px bg-zinc-200" />
            <div className="text-center">
              <div className="font-bold text-xl text-blue-700">
                {loading ? '—' : formatNumber(data?.activeViews ?? 0)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Visualizações</div>
            </div>
            {data && data.activePaths.length > 0 && (
              <>
                <div className="h-8 w-px bg-zinc-200" />
                <div className="text-center hidden sm:block">
                  <div className="font-bold text-xl text-zinc-800 truncate max-w-[180px]">
                    {data.activePaths[0].path}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">Página mais vista</div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Main component
// ============================================================

export function AdminAnalytics() {
  const apiError = useApiError()
  const [range, setRange] = useState<Range>('7d')
  const [tab, setTab] = useState<Tab>('overview')

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)

  const [realtime, setRealtime] = useState<RealtimeData | null>(null)
  const [realtimeLoading, setRealtimeLoading] = useState(true)

  const [timeline, setTimeline] = useState<TimelineData | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  const [countries, setCountries] = useState<CountriesData | null>(null)
  const [countriesLoading, setCountriesLoading] = useState(false)

  const [cities, setCities] = useState<CitiesData | null>(null)
  const [citiesLoading, setCitiesLoading] = useState(false)

  const [paths, setPaths] = useState<PathsData | null>(null)
  const [pathsLoading, setPathsLoading] = useState(false)

  const [referrers, setReferrers] = useState<ReferrersData | null>(null)
  const [referrersLoading, setReferrersLoading] = useState(false)

  const [devices, setDevices] = useState<DevicesData | null>(null)
  const [devicesLoading, setDevicesLoading] = useState(false)

  const [ips, setIps] = useState<IpsData | null>(null)
  const [ipsLoading, setIpsLoading] = useState(false)

  const [seo, setSeo] = useState<SeoSettings>({})
  const [exportOpen, setExportOpen] = useState(false)

  // Fetch overview on mount and when range changes
  const loadOverview = async (rangeVal: Range) => {
    setOverviewLoading(true)
    try {
      const r = await fetch(`/api/admin/analytics?type=overview&range=${rangeVal}`)
      const d = await r.json()
      if (d.error) return apiError(d.error)
      setOverview(d)
    } catch {
      apiError('Falha ao carregar visão geral')
    } finally {
      setOverviewLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadOverview(range)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [range])

  // Realtime (auto-refresh every 30s) — independent of range
  const loadRealtime = async () => {
    setRealtimeLoading(true)
    try {
      const r = await fetch('/api/admin/analytics?type=realtime&range=24h')
      const d = await r.json()
      if (d.error) return apiError(d.error)
      setRealtime(d)
    } catch {
      apiError('Falha ao carregar tempo real')
    } finally {
      setRealtimeLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadRealtime()
    /* eslint-enable react-hooks/set-state-in-effect */
    const interval = setInterval(loadRealtime, 30_000)
    return () => clearInterval(interval)
  }, [])

  // SEO settings (for export report header) — load once
  useEffect(() => {
    let cancelled = false
    fetch('/api/seo')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.settings) setSeo(d.settings)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch timeline whenever range changes (it lives on Overview tab)
  const loadTimeline = async (rangeVal: Range) => {
    setTimelineLoading(true)
    try {
      const r = await fetch(`/api/admin/analytics?type=timeline&range=${rangeVal}`)
      const d = await r.json()
      if (d.error) return apiError(d.error)
      setTimeline(d)
    } catch {
      apiError('Falha ao carregar timeline')
    } finally {
      setTimelineLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadTimeline(range)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [range])

  // Generic loader for tab data
  const loadType = async (
    type: string,
    setter: (d: any) => void,
    setLoading: (b: boolean) => void,
    label: string,
    rangeVal: Range,
  ) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/analytics?type=${type}&range=${rangeVal}`)
      const d = await r.json()
      if (d.error) return apiError(d.error)
      setter(d)
    } catch {
      apiError(`Falha ao carregar ${label}`)
    } finally {
      setLoading(false)
    }
  }

  // Clear cached tab data on range change so it reloads on next tab visit
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setCountries(null); setCities(null); setPaths(null)
    setReferrers(null); setDevices(null); setIps(null)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [range])

  // Fetch other tab data on tab change (lazy)
  useEffect(() => {
    if (tab === 'geografia' && !countries) loadType('countries', setCountries, setCountriesLoading, 'países', range)
    if (tab === 'cidades' && !cities) loadType('cities', setCities, setCitiesLoading, 'cidades', range)
    if (tab === 'paginas' && !paths) loadType('paths', setPaths, setPathsLoading, 'páginas', range)
    if (tab === 'origens' && !referrers) loadType('referrers', setReferrers, setReferrersLoading, 'origens', range)
    if (tab === 'dispositivos' && !devices) loadType('devices', setDevices, setDevicesLoading, 'dispositivos', range)
    if (tab === 'ips' && !ips) loadType('ips', setIps, setIpsLoading, 'IPs', range)
  }, [tab, range])

  const siteName = seo.site_name || 'Portal'
  const siteLogo = seo.site_logo || null

  return (
    <div className="space-y-5">
      {/* === Print styles (only active when export dialog is open) === */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #analytics-print-report, #analytics-print-report * { visibility: visible !important; }
          #analytics-print-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            max-height: none !important;
            max-width: none !important;
            border: none !important;
            border-radius: 0 !important;
            transform: none !important;
          }
          @page { margin: 1.5cm; }
        }
      `}</style>

<<<<<<< HEAD
      {/* === Header bar (only range selector + export button — title is rendered by AdminHeader) === */}
      <div className="flex flex-wrap items-center justify-end gap-3">
=======
      {/* === Header bar === */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Analytics &amp; Métricas
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Acompanhe o desempenho do portal em tempo real
          </p>
        </div>
>>>>>>> 005f2b6696919b4e97f780cf36cf435993d447e1
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
                <SelectItem key={r} value={r}>{RANGE_LABEL[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setExportOpen(true)} variant="outline" size="sm">
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar Relatório</span>
            <span className="sm:hidden">Exportar</span>
          </Button>
        </div>
      </div>

      {/* === Realtime card === */}
      <RealtimeCard data={realtime} loading={realtimeLoading && !realtime} />

      {/* === Tab bar === */}
      <div className="flex items-center gap-1 border-b border-zinc-200 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px whitespace-nowrap',
                active
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* === Tab content === */}
      <div className="min-h-[300px]">
        {tab === 'overview' && (
          <OverviewTab
            overview={overview}
            overviewLoading={overviewLoading}
            timeline={timeline}
            timelineLoading={timelineLoading}
          />
        )}

        {tab === 'geografia' && (
          <GeografiaTab countries={countries} loading={countriesLoading} />
        )}

        {tab === 'paginas' && (
          <PaginasTab paths={paths} loading={pathsLoading} />
        )}

        {tab === 'origens' && (
          <OrigensTab referrers={referrers} loading={referrersLoading} />
        )}

        {tab === 'dispositivos' && (
          <DispositivosTab devices={devices} loading={devicesLoading} />
        )}

        {tab === 'ips' && (
          <IPsTab ips={ips} loading={ipsLoading} />
        )}

        {tab === 'cidades' && (
          <CidadesTab cities={cities} loading={citiesLoading} />
        )}
      </div>

      {/* === Export report dialog === */}
      <ExportReportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        overview={overview}
        range={range}
        siteName={siteName}
        siteLogo={siteLogo}
        siteTagline={seo.site_tagline}
      />
    </div>
  )
}

// ============================================================
// Overview tab
// ============================================================

function OverviewTab({
  overview,
  overviewLoading,
  timeline,
  timelineLoading,
}: {
  overview: OverviewData | null
  overviewLoading: boolean
  timeline: TimelineData | null
  timelineLoading: boolean
}) {
  if (overviewLoading && !overview) return <LoadingSpinner label="Carregando visão geral..." />
  if (!overview) return <p className="text-sm text-zinc-500 py-8 text-center">Sem dados disponíveis.</p>

  const growth = overview.growthRate
  const growthSub = (
    <span className="inline-flex items-center gap-1">
      {growth >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-600" /> : <TrendingDown className="h-3 w-3 text-rose-600" />}
      vs ontem: <strong className={growth >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{formatNumber(overview.viewsYesterday)}</strong>
    </span>
  )

  return (
    <div className="space-y-5">
      {/* 6 metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Eye}
          label="Total de Visualizações"
          value={formatNumber(overview.totalViews)}
          sub={growthSub}
          trend={growth}
          iconClass="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={Users}
          label="Visitantes Únicos"
          value={formatNumber(overview.uniqueVisitors)}
          sub={`Hoje: ${formatNumber(overview.viewsToday)}`}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={MousePointerClick}
          label="Sessões"
          value={formatNumber(overview.uniqueSessions)}
          sub={`Semana: ${formatNumber(overview.viewsWeek)}`}
          iconClass="bg-purple-50 text-purple-600"
        />
        <StatCard
          icon={TrendingDown}
          label="Taxa de Rejeição"
          value={`${overview.bounceRate.toFixed(1)}%`}
          sub="Visitantes que viram só 1 página"
          iconClass="bg-rose-50 text-rose-600"
        />
        <StatCard
          icon={Activity}
          label="Páginas por Sessão"
          value={overview.avgPagesPerSession.toFixed(2)}
          sub="Média de páginas por sessão"
          iconClass="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={Clock}
          label="Tempo Médio de Resposta"
          value={`${formatNumber(overview.avgResponseTimeMs)} ms`}
          sub="Tempo de carregamento médio"
          iconClass="bg-teal-50 text-teal-600"
        />
      </div>

      {/* Top highlights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Destaques do período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
            <Highlight label="País" value={overview.top.country ? `${countryFlag(overview.top.country.code)} ${overview.top.country.name}` : '—'} />
            <Highlight label="Cidade" value={overview.top.city?.name || '—'} />
            <Highlight label="Referrer" value={overview.top.referrer?.domain || '—'} />
            <Highlight label="Página" value={overview.top.path?.path || '—'} />
            <Highlight label="Navegador" value={overview.top.browser?.name || '—'} />
            <Highlight label="Sistema" value={overview.top.os?.name || '—'} />
          </div>
        </CardContent>
      </Card>

      {/* Timeline chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            Visualizações ao longo do tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timelineLoading && !timeline ? (
            <LoadingSpinner label="Carregando gráfico..." />
          ) : timeline && timeline.buckets.length > 0 ? (
            <LineChart data={timeline.buckets} bucketSize={timeline.bucketSize} />
          ) : (
            <p className="text-sm text-zinc-500 py-8 text-center">Sem dados suficientes para o gráfico.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-semibold">{label}</div>
      <div className="text-sm text-zinc-900 font-medium truncate" title={value}>{value}</div>
    </div>
  )
}

// ============================================================
// Geografia tab
// ============================================================

function GeografiaTab({ countries, loading }: { countries: CountriesData | null; loading: boolean }) {
  if (loading && !countries) return <LoadingSpinner label="Carregando países..." />
  if (!countries || countries.countries.length === 0) {
    return <p className="text-sm text-zinc-500 py-8 text-center">Sem dados geográficos.</p>
  }

  const total = countries.total > 0 ? countries.countries.reduce((s, c) => s + c.views, 0) : 0
  const top10 = countries.countries.slice(0, 10)

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-600" />
            Distribuição geográfica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorldMap countries={countries.countries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 países</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Bandeira</TableHead>
                <TableHead>País</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right w-24">% do total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top10.map((c, i) => (
                <TableRow key={`${c.countryCode}-${i}`}>
                  <TableCell className="text-zinc-400 text-xs">{i + 1}</TableCell>
                  <TableCell className="text-lg">{countryFlag(c.countryCode)}</TableCell>
                  <TableCell className="font-medium text-zinc-900">
                    {c.country || c.countryCode}
                    <span className="text-[10px] text-zinc-400 ml-1.5 uppercase">{c.countryCode}</span>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-zinc-900">{formatNumber(c.views)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="font-mono text-xs">
                      {total > 0 ? ((c.views / total) * 100).toFixed(1) : '0'}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Páginas tab
// ============================================================

function PaginasTab({ paths, loading }: { paths: PathsData | null; loading: boolean }) {
  if (loading && !paths) return <LoadingSpinner label="Carregando páginas..." />
  if (!paths || paths.paths.length === 0) {
    return <p className="text-sm text-zinc-500 py-8 text-center">Sem dados de páginas.</p>
  }
  const total = paths.paths.reduce((s, p) => s + p.views, 0)
  const top10 = paths.paths.slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4 text-blue-600" />
          Top 10 páginas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Caminho</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right w-24">% do total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top10.map((p, i) => {
              const color = pathTypeColor(p.pathType)
              const cc = getColorClasses(color)
              return (
                <TableRow key={`${p.path}-${i}`}>
                  <TableCell className="text-zinc-400 text-xs">{i + 1}</TableCell>
                  <TableCell className="font-medium text-zinc-900">
                    <div className="max-w-[280px] truncate" title={p.path}>{p.path}</div>
                    {p.refSlug && (
                      <div className="text-[10px] text-zinc-400">slug: {p.refSlug}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(cc.text, cc.borderLight, cc.bgLight, 'font-mono text-[10px]')}>
                      {p.pathType || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-zinc-900">{formatNumber(p.views)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="font-mono text-xs">
                      {total > 0 ? ((p.views / total) * 100).toFixed(1) : '0'}%
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Origens (referrers) tab
// ============================================================

function OrigensTab({ referrers, loading }: { referrers: ReferrersData | null; loading: boolean }) {
  if (loading && !referrers) return <LoadingSpinner label="Carregando origens..." />
  if (!referrers) {
    return <p className="text-sm text-zinc-500 py-8 text-center">Sem dados de origens.</p>
  }

  const typeTotal = referrers.types.reduce((s, t) => s + t.views, 0) || 1
  const donutData = referrers.types.map((t) => ({
    label: t.type || 'UNKNOWN',
    value: t.views,
    color: referrerTypeColor(t.type),
  }))
  const top10 = referrers.domains.slice(0, 10)
  const domainsTotal = referrers.domains.reduce((s, d) => s + d.views, 0) || 1

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4 text-blue-600" />
            Tipos de tráfego
          </CardTitle>
        </CardHeader>
        <CardContent>
          {donutData.length > 0 ? (
            <div className="flex justify-center py-2">
              <Donut
                data={donutData}
                size={180}
                thickness={28}
                centerLabel="total"
                centerValue={formatNumber(typeTotal)}
              />
            </div>
          ) : (
            <p className="text-sm text-zinc-500 py-8 text-center">Sem dados suficientes.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 domínios de origem</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Domínio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right w-16">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top10.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-zinc-500 py-6">Sem domínios de origem registrados.</TableCell>
                </TableRow>
              )}
              {top10.map((d, i) => {
                const color = referrerTypeColor(d.type)
                const cc = getColorClasses(color)
                return (
                  <TableRow key={`${d.domain}-${i}`}>
                    <TableCell className="text-zinc-400 text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium text-zinc-900 truncate max-w-[200px]" title={d.domain || ''}>
                      {d.domain || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(cc.text, cc.borderLight, cc.bgLight, 'font-mono text-[10px]')}>
                        {d.type || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-zinc-900">{formatNumber(d.views)}</TableCell>
                    <TableCell className="text-right text-xs text-zinc-500">
                      {((d.views / domainsTotal) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Dispositivos tab
// ============================================================

function DispositivosTab({ devices, loading }: { devices: DevicesData | null; loading: boolean }) {
  if (loading && !devices) return <LoadingSpinner label="Carregando dispositivos..." />
  if (!devices) return <p className="text-sm text-zinc-500 py-8 text-center">Sem dados de dispositivos.</p>

  const browserData = devices.browsers.slice(0, 6).map((b) => ({
    label: b.name || '—',
    value: b.views,
    color: 'blue',
  }))
  const osData = devices.oss.slice(0, 6).map((o) => ({
    label: o.name || '—',
    value: o.views,
    color: 'emerald',
  }))
  const deviceData = devices.devices.slice(0, 5).map((d) => ({
    label: d.type || '—',
    value: d.views,
    color: deviceTypeColor(d.type),
  }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Chrome className="h-4 w-4 text-blue-600" />
            Navegadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {browserData.length > 0 ? (
            <Donut data={browserData} size={140} thickness={20} centerLabel="navegadores" centerValue={formatNumber(browserData.length)} />
          ) : (
            <p className="text-sm text-zinc-500 py-6 text-center">Sem dados.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-4 w-4 text-emerald-600" />
            Sistemas operacionais
          </CardTitle>
        </CardHeader>
        <CardContent>
          {osData.length > 0 ? (
            <Donut data={osData} size={140} thickness={20} centerLabel="sistemas" centerValue={formatNumber(osData.length)} />
          ) : (
            <p className="text-sm text-zinc-500 py-6 text-center">Sem dados.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-amber-600" />
            Tipo de dispositivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deviceData.length > 0 ? (
            <Donut data={deviceData} size={140} thickness={20} centerLabel="tipos" centerValue={formatNumber(deviceData.length)} />
          ) : (
            <p className="text-sm text-zinc-500 py-6 text-center">Sem dados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// IPs tab
// ============================================================

function IPsTab({ ips, loading }: { ips: IpsData | null; loading: boolean }) {
  if (loading && !ips) return <LoadingSpinner label="Carregando IPs..." />
  if (!ips || ips.ips.length === 0) {
    return <p className="text-sm text-zinc-500 py-8 text-center">Sem dados de IPs.</p>
  }
  const top20 = ips.ips.slice(0, 20)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-blue-600" />
          Top 20 IPs (anonimizados)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>IP Hash</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>ISP</TableHead>
              <TableHead className="text-right">Views</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top20.map((ip) => (
              <TableRow key={ip.rank}>
                <TableCell className="text-zinc-400 text-xs">{ip.rank}</TableCell>
                <TableCell className="font-mono text-xs text-zinc-700">{ip.ipHashShort}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    <span className="text-base">{countryFlag(ip.countryCode)}</span>
                    <span className="text-zinc-700 text-sm">{ip.country || '—'}</span>
                  </span>
                </TableCell>
                <TableCell className="text-zinc-700 text-sm">{ip.city || '—'}</TableCell>
                <TableCell className="text-zinc-500 text-xs truncate max-w-[160px]" title={ip.isp || ''}>{ip.isp || '—'}</TableCell>
                <TableCell className="text-right font-semibold text-zinc-900">{formatNumber(ip.views)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Cidades tab
// ============================================================

function CidadesTab({ cities, loading }: { cities: CitiesData | null; loading: boolean }) {
  if (loading && !cities) return <LoadingSpinner label="Carregando cidades..." />
  if (!cities || cities.cities.length === 0) {
    return <p className="text-sm text-zinc-500 py-8 text-center">Sem dados de cidades.</p>
  }
  const top20 = cities.cities.slice(0, 20)
  const total = cities.cities.reduce((s, c) => s + c.views, 0) || 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          Top 20 cidades
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Região</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right w-16">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top20.map((c, i) => (
              <TableRow key={`${c.city}-${c.countryCode}-${i}`}>
                <TableCell className="text-zinc-400 text-xs">{i + 1}</TableCell>
                <TableCell className="font-medium text-zinc-900">{c.city}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    <span className="text-base">{countryFlag(c.countryCode)}</span>
                    <span className="text-zinc-700 text-sm">{c.country || c.countryCode}</span>
                  </span>
                </TableCell>
                <TableCell className="text-zinc-500 text-xs">{c.region || '—'}</TableCell>
                <TableCell className="text-right font-semibold text-zinc-900">{formatNumber(c.views)}</TableCell>
                <TableCell className="text-right text-xs text-zinc-500">
                  {((c.views / total) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Export report dialog
// ============================================================

function ExportReportDialog({
  open,
  onOpenChange,
  overview,
  range,
  siteName,
  siteLogo,
  siteTagline,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  overview: OverviewData | null
  range: Range
  siteName: string
  siteLogo: string | null
  siteTagline?: string
}) {
  const now = useMemo(() => new Date(), [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-blue-600" />
            Relatório de Analytics
          </DialogTitle>
          <DialogDescription>
            Visualize o relatório imprimível do período selecionado.
          </DialogDescription>
        </DialogHeader>

        {/* === Printable report === */}
        <div id="analytics-print-report" className="border border-zinc-200 rounded-lg p-6 bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 pb-4 mb-4">
            <div className="flex items-center gap-3">
              {siteLogo ? (
                <img src={siteLogo} alt={siteName} className="h-10 w-auto object-contain" />
              ) : (
                <div className="h-10 w-10 rounded bg-blue-600 text-white grid place-items-center font-bold">
                  {siteName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-bold text-zinc-900 text-base">{siteName}</div>
                {siteTagline && <div className="text-xs text-zinc-500">{siteTagline}</div>}
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <div className="font-semibold text-zinc-700">Relatório de Analytics</div>
              <div>{RANGE_START_LABEL[range]}</div>
              <div>Gerado em: {formatDate(now, 'datetime')}</div>
            </div>
          </div>

          {/* Metrics table */}
          {overview ? (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50">
                  <th className="border border-zinc-200 px-3 py-2 text-left font-semibold text-zinc-700">Métrica</th>
                  <th className="border border-zinc-200 px-3 py-2 text-right font-semibold text-zinc-700">Valor</th>
                  <th className="border border-zinc-200 px-3 py-2 text-left font-semibold text-zinc-700">Observação</th>
                </tr>
              </thead>
              <tbody>
                <ReportRow label="Total de Visualizações" value={formatNumber(overview.totalViews)} obs={`Hoje: ${formatNumber(overview.viewsToday)}`} />
                <ReportRow label="Visitantes Únicos" value={formatNumber(overview.uniqueVisitors)} obs={`Semana: ${formatNumber(overview.viewsWeek)}`} />
                <ReportRow label="Sessões" value={formatNumber(overview.uniqueSessions)} obs={`Mês: ${formatNumber(overview.viewsMonth)}`} />
                <ReportRow label="Taxa de Crescimento (vs ontem)" value={`${overview.growthRate.toFixed(2)}%`} obs={`Ontem: ${formatNumber(overview.viewsYesterday)}`} />
                <ReportRow label="Taxa de Rejeição" value={`${overview.bounceRate.toFixed(2)}%`} obs="Visitantes com 1 página" />
                <ReportRow label="Páginas por Sessão" value={overview.avgPagesPerSession.toFixed(2)} obs="Média" />
                <ReportRow label="Tempo Médio de Resposta" value={`${formatNumber(overview.avgResponseTimeMs)} ms`} obs="Carregamento" />
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-4">Carregue os dados para gerar o relatório.</p>
          )}

          {/* Top items */}
          {overview && (
            <div className="mt-5">
              <h3 className="font-semibold text-zinc-800 text-sm mb-2">Destaques do período</h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50">
                    <th className="border border-zinc-200 px-2 py-1 text-left">Categoria</th>
                    <th className="border border-zinc-200 px-2 py-1 text-left">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <ReportRow compact label="País com mais tráfego" value={overview.top.country ? `${overview.top.country.name} (${formatNumber(overview.top.country.count)} views)` : '—'} />
                  <ReportRow compact label="Cidade com mais tráfego" value={overview.top.city ? `${overview.top.city.name} (${formatNumber(overview.top.city.count)} views)` : '—'} />
                  <ReportRow compact label="Referrer principal" value={overview.top.referrer ? `${overview.top.referrer.domain} (${formatNumber(overview.top.referrer.count)} views)` : '—'} />
                  <ReportRow compact label="Página mais vista" value={overview.top.path ? `${overview.top.path.path} (${formatNumber(overview.top.path.count)} views)` : '—'} />
                  <ReportRow compact label="Navegador principal" value={overview.top.browser ? `${overview.top.browser.name} (${formatNumber(overview.top.browser.count)} views)` : '—'} />
                  <ReportRow compact label="Sistema operacional principal" value={overview.top.os ? `${overview.top.os.name} (${formatNumber(overview.top.os.count)} views)` : '—'} />
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 text-center text-[10px] text-zinc-400">
            Relatório gerado automaticamente · {siteName} · {formatDate(now, 'datetime')}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReportRow({ label, value, obs, compact }: { label: string; value: string; obs?: string; compact?: boolean }) {
  return (
    <tr>
      <td className={cn('border border-zinc-200 text-zinc-700', compact ? 'px-2 py-1' : 'px-3 py-2')}>{label}</td>
      <td className={cn('border border-zinc-200 text-right font-semibold text-zinc-900', compact ? 'px-2 py-1' : 'px-3 py-2')}>{value}</td>
      {!compact && (
        <td className="border border-zinc-200 px-3 py-2 text-zinc-500 text-xs">{obs || ''}</td>
      )}
    </tr>
  )
}
