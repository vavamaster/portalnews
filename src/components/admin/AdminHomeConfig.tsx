'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Save, Loader2, LayoutDashboard, Sparkles, Flame, Eye, Newspaper,
  AlertCircle, CheckCircle2, RefreshCw, Image as ImageIcon,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface HomeConfig {
  // Slide
  slideEnabled: boolean
  slidePostCount: number
  slideFilterType: 'recent' | 'featured' | 'breaking' | 'views'
  // Hero
  heroEnabled: boolean
  heroFilterType: 'featured' | 'recent'
  heroPreferFeatured: boolean
  // Sub-hero
  subHeroCount: number
  subHeroPreferFeatured: boolean
  // Latest
  latestCount: number
  // Most read
  mostReadCount: number
  // Categories
  categoryCount: number
  postsPerCategory: number
  categoryHideIfEmpty: boolean
  // Deduplication
  dedupStrategy: 'strict' | 'flexible'
}

const DEFAULT_CONFIG: HomeConfig = {
  slideEnabled: true,
  slidePostCount: 5,
  slideFilterType: 'featured',
  heroEnabled: true,
  heroFilterType: 'featured',
  heroPreferFeatured: true,
  subHeroCount: 4,
  subHeroPreferFeatured: true,
  latestCount: 8,
  mostReadCount: 5,
  categoryCount: 6,
  postsPerCategory: 4,
  categoryHideIfEmpty: true,
  dedupStrategy: 'strict',
}

const CONFIG_KEY = 'home_layout_config'

export function AdminHomeConfig() {
  const { toast } = useToast()
  const [config, setConfig] = useState<HomeConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [seoRes, homeRes] = await Promise.all([
        fetch('/api/seo').then(r => r.json()),
        fetch('/api/home').then(r => r.json()),
      ])
      const stored = seoRes.settings?.[CONFIG_KEY]
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setConfig({ ...DEFAULT_CONFIG, ...parsed })
        } catch {
          setConfig(DEFAULT_CONFIG)
        }
      }
      setStats(homeRes.stats)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const seoRes = await fetch('/api/seo').then(r => r.json())
      const newSettings = { ...seoRes.settings, [CONFIG_KEY]: JSON.stringify(config) }
      const res = await fetch('/api/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        toast({ title: 'Configuração salva!', description: 'A home usará os novos filtros na próxima carga.' })
      }
    } finally {
      setSaving(false)
    }
  }

  const refreshStats = async () => {
    const homeRes = await fetch('/api/home').then(r => r.json())
    setStats(homeRes.stats)
    toast({ title: 'Estatísticas atualizadas' })
  }

  if (loading) {
    return <div className="text-zinc-500 flex items-center gap-2 py-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={refreshStats}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar stats
        </Button>
      </div>

      {/* Live stats */}
      {stats && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Estatísticas atuais da home
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            <StatBox label="Posts no pool" value={stats.totalPoolSize} />
            <StatBox label="Posts usados" value={stats.totalUsed} />
            <StatBox label="No slide" value={stats.slideCount} />
            <StatBox label="Hero + Sub" value={stats.heroCount + stats.subHeroCount} />
            <StatBox label="Últimas" value={stats.latestCount} />
            <StatBox label="Mais lidas" value={stats.mostReadCount} />
          </div>
          <div className="mt-3 text-xs text-blue-800">
            <strong>Categorias:</strong>{' '}
            {Object.entries(stats.categoryBlocks || {}).map(([slug, count]: any) => (
              <span key={slug} className={cn('inline-block px-2 py-0.5 rounded mr-1', count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500')}>
                {slug}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Anti-duplication info */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Sparkles className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <strong className="block mb-1">Sistema anti-duplicação ativo</strong>
            <p className="text-xs text-emerald-700">
              Cada post é alocado a apenas UM bloco na home, seguindo a prioridade:
              <code className="bg-emerald-100 px-1 rounded mx-1">Slide → Hero → Sub-hero → Últimas → Mais lidas → Categorias</code>
              Quando um bloco não tem posts suficientes (após excluir os já usados), ele é exibido com menos posts ou ocultado.
            </p>
          </div>
        </div>
      </div>

      {/* Slide config */}
      <Section icon={ImageIcon} title="Slide Banner (topo)" color="purple">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ToggleField
            label="Slide ativo"
            description="Exibir banner deslizante no topo da home"
            checked={config.slideEnabled}
            onChange={(v) => setConfig({ ...config, slideEnabled: v })}
          />
          <NumberField
            label="Quantidade de posts"
            value={config.slidePostCount}
            onChange={(v) => setConfig({ ...config, slidePostCount: v })}
            min={1} max={10}
          />
          <SelectField
            label="Filtro do slide"
            value={config.slideFilterType}
            onChange={(v) => setConfig({ ...config, slideFilterType: v as any })}
            options={[
              { value: 'featured', label: 'Posts em destaque (featured)' },
              { value: 'breaking', label: 'Posts urgentes (breaking)' },
              { value: 'views', label: 'Mais vistos' },
              { value: 'recent', label: 'Mais recentes' },
            ]}
          />
        </div>
      </Section>

      {/* Hero config */}
      <Section icon={Flame} title="Hero + Sub-hero" color="amber">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ToggleField
            label="Hero ativo"
            description="Exibir bloco hero (1 post grande + 4 sub-heroes)"
            checked={config.heroEnabled}
            onChange={(v) => setConfig({ ...config, heroEnabled: v })}
          />
          <SelectField
            label="Filtro do hero"
            value={config.heroFilterType}
            onChange={(v) => setConfig({ ...config, heroFilterType: v as any })}
            options={[
              { value: 'featured', label: 'Posts em destaque (featured)' },
              { value: 'recent', label: 'Mais recentes' },
            ]}
          />
          <NumberField
            label="Quantidade de sub-heroes"
            value={config.subHeroCount}
            onChange={(v) => setConfig({ ...config, subHeroCount: v })}
            min={0} max={6}
          />
          <ToggleField
            label="Sub-heroes preferem featured"
            description="Priorizar posts em destaque para sub-heroes"
            checked={config.subHeroPreferFeatured}
            onChange={(v) => setConfig({ ...config, subHeroPreferFeatured: v })}
          />
        </div>
      </Section>

      {/* Latest + MostRead */}
      <Section icon={Newspaper} title="Últimas Notícias + Mais Lidas" color="blue">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberField
            label="Posts em Últimas Notícias"
            value={config.latestCount}
            onChange={(v) => setConfig({ ...config, latestCount: v })}
            min={4} max={16}
          />
          <NumberField
            label="Posts em Mais Lidas"
            value={config.mostReadCount}
            onChange={(v) => setConfig({ ...config, mostReadCount: v })}
            min={3} max={10}
          />
        </div>
      </Section>

      {/* Categories */}
      <Section icon={LayoutDashboard} title="Blocos por Categoria" color="emerald">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberField
            label="Número de categorias exibidas"
            value={config.categoryCount}
            onChange={(v) => setConfig({ ...config, categoryCount: v })}
            min={0} max={10}
          />
          <NumberField
            label="Posts por categoria"
            value={config.postsPerCategory}
            onChange={(v) => setConfig({ ...config, postsPerCategory: v })}
            min={1} max={8}
          />
          <ToggleField
            label="Ocultar categorias vazias"
            description="Quando uma categoria não tem posts inéditos, ocultar o bloco"
            checked={config.categoryHideIfEmpty}
            onChange={(v) => setConfig({ ...config, categoryHideIfEmpty: v })}
          />
        </div>
      </Section>

      {/* Dedup strategy */}
      <Section icon={Sparkles} title="Estratégia Anti-Duplicação" color="rose">
        <SelectField
          label="Estratégia"
          value={config.dedupStrategy}
          onChange={(v) => setConfig({ ...config, dedupStrategy: v as any })}
          options={[
            { value: 'strict', label: 'Estrita (recomendado): cada post aparece em apenas UM bloco' },
            { value: 'flexible', label: 'Flexível: permite reuso quando há poucos posts (pode gerar duplicatas)' },
          ]}
        />
        {config.dedupStrategy === 'strict' && (
          <div className="mt-3 bg-rose-50 border border-rose-200 rounded-md p-3 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Modo estrito:</strong> Com poucos posts no portal, alguns blocos podem ficar vazios.
              Isso é preferível a ter posts repetidos, que prejudicam a experiência do leitor e a SEO.
              Considere publicar mais notícias para preencher todos os blocos.
            </div>
          </div>
        )}
      </Section>

      {/* Save bar */}
      <div className="sticky bottom-4 bg-white border border-zinc-200 rounded-lg p-3 shadow-lg flex justify-end gap-2">
        <Button variant="outline" onClick={() => setConfig(DEFAULT_CONFIG)}>Restaurar padrão</Button>
        <Button onClick={handleSave} disabled={saving} className="bg-primary">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, color, children }: { icon: any; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className={cn('px-4 py-2.5 border-b border-zinc-100 flex items-center gap-2', `bg-${color}-50/50`)}>
        <Icon className={cn('h-4 w-4', `text-${color}-600`)} />
        <h3 className="font-bold text-sm text-zinc-900">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function ToggleField({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-md bg-zinc-50">
      <div>
        <div className="text-sm font-medium text-zinc-900">{label}</div>
        {description && <div className="text-xs text-zinc-500">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value) || min
          onChange(Math.max(min, Math.min(max, v)))
        }}
        min={min}
        max={max}
        className="mt-1"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-md p-2 border border-blue-100">
      <div className="text-lg font-black text-blue-700">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  )
}
