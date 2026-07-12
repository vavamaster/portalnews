'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Save, Loader2, Image, Layers, Eye, Clock, Info, ExternalLink, Home as HomeIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const DESIGN_TYPES = [
  { value: 'overlay', label: 'Overlay', description: 'Imagem full-width com texto sobre gradient' },
  { value: 'split', label: 'Split', description: 'Imagem à esquerda, conteúdo à direita' },
  { value: 'minimal', label: 'Minimal', description: 'Texto à esquerda, imagem à direita, fundo claro' },
  { value: 'cards', label: 'Cards', description: 'Carousel com cards em profundidade (coverflow)' },
]

const HEIGHT_PRESETS = [
  { value: 'short', label: 'Baixo (280-380px)' },
  { value: 'medium', label: 'Médio (360-500px)' },
  { value: 'tall', label: 'Alto (420-580px)' },
]

const FILTER_TYPES = [
  { value: 'featured', label: 'Destaque (featured)' },
  { value: 'latest', label: 'Mais recentes' },
  { value: 'breaking', label: 'Urgentes (breaking)' },
  { value: 'all', label: 'Por relevância (mais vistos)' },
]

const DESIGN_ICONS: Record<string, any> = {
  overlay: Layers,
  split: Image,
  minimal: Eye,
  cards: Clock,
}

export function AdminSlideConfig() {
  const { toast } = useToast()
  const { setView } = useAppStore()
  const [globalConfig, setGlobalConfig] = useState<any>(null)
  const [categoryConfigs, setCategoryConfigs] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('global')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/slide-config')
      const data = await res.json()
      setGlobalConfig(data.globalConfig)
      setCategoryConfigs(data.categoryConfigs || [])
      setCategories(data.categories || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (config: any, categoryId?: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/slide-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, categoryId: categoryId || null }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        toast({ title: 'Configuração salva!', description: categoryId ? 'A categoria usará este slide na próxima carga.' : 'A home usará este slide na próxima carga.' })
        load()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-zinc-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
  }

  return (
    <div className="space-y-4">
      {/* Info banner: explains the home/category scope split */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="bg-blue-500 text-white h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0">
            <Info className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-blue-900 mb-1">Como funciona o vínculo do slide</h3>
            <ul className="text-xs text-blue-800 space-y-1 mb-3">
              <li>• A aba <strong>🏠 Home (Global)</strong> controla o slideshow exibido no topo da página inicial do portal.</li>
              <li>• As abas de <strong>categoria</strong> controlam o slideshow exibido no topo da página daquela editoria. Se uma categoria não tiver configuração própria, ela herda a configuração global.</li>
              <li>• O filtro <strong>Destaque</strong> usa posts com flag <code className="bg-blue-100 px-1 rounded">featured=true</code>; <strong>Urgentes</strong> usa <code className="bg-blue-100 px-1 rounded">breaking=true</code>; <strong>Mais recentes</strong> ordena por data; <strong>Por relevância</strong> usa os mais vistos.</li>
              <li>• As mudanças são aplicadas na próxima carga da home/categoria (cache de página pode exigir refresh).</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setView({ name: 'home' })}
                className="bg-white"
              >
                <HomeIcon className="h-4 w-4 mr-1.5" /> Ver home
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setView({ name: 'admin', section: 'home-config' })}
                className="bg-white"
              >
                <ExternalLink className="h-4 w-4 mr-1.5" /> Ir para Home Layout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="global">
            <HomeIcon className="h-3 w-3 mr-1.5" /> Home (Global)
          </TabsTrigger>
          {categories.map(cat => (
            <TabsTrigger key={cat.id} value={cat.id}>
              {cat.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Global config */}
        <TabsContent value="global">
          <ConfigEditor
            config={globalConfig}
            onSave={(cfg) => handleSave(cfg)}
            saving={saving}
            title="Configuração do Slide da Home"
            description="Controla o slideshow principal exibido na página inicial do portal. Aplica-se também a qualquer categoria que não tenha configuração própria."
            scope="global"
          />
        </TabsContent>

        {/* Per-category configs */}
        {categories.map(cat => {
          const config = categoryConfigs.find(c => c.categoryId === cat.id)
          return (
            <TabsContent key={cat.id} value={cat.id}>
              <ConfigEditor
                config={config}
                onSave={(cfg) => handleSave(cfg, cat.id)}
                saving={saving}
                title={`Slide da categoria: ${cat.name}`}
                description={`Configuração individual para o slideshow exibido na página de ${cat.name}. Sobrescreve a configuração global apenas para esta categoria.`}
                categoryColor={cat.color}
                scope="category"
              />
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

function ConfigEditor({ config, onSave, saving, title, description, categoryColor, scope }: {
  config: any
  onSave: (cfg: any) => void
  saving: boolean
  title: string
  description: string
  categoryColor?: string
  scope: 'global' | 'category'
}) {
  const [form, setForm] = useState<any>({
    isEnabled: config?.isEnabled ?? true,
    postCount: config?.postCount ?? 5,
    autoPlay: config?.autoPlay ?? true,
    delayMs: config?.delayMs ?? 5000,
    designType: config?.designType ?? 'overlay',
    showDots: config?.showDots ?? true,
    showArrows: config?.showArrows ?? true,
    showExcerpt: config?.showExcerpt ?? true,
    showCategory: config?.showCategory ?? true,
    showAuthor: config?.showAuthor ?? false,
    heightPreset: config?.heightPreset ?? 'tall',
    filterType: config?.filterType ?? 'featured',
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg text-zinc-900 flex items-center gap-2" style={{ fontWeight: 500 }}>
            {scope === 'category' && categoryColor && (
              <span className={cn('inline-block h-3 w-3 rounded-full', `bg-${categoryColor}-500`)} aria-hidden />
            )}
            {title}
            <Badge variant={scope === 'global' ? 'default' : 'secondary'} className="text-[10px] uppercase tracking-wider">
              {scope === 'global' ? 'Home' : 'Categoria'}
            </Badge>
            {form.isEnabled ? (
              <Badge variant="default" className="text-[10px] bg-emerald-600">Ativo</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">Inativo</Badge>
            )}
          </h3>
          <p className="text-sm text-zinc-500">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Design type */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> Design do Slide</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {DESIGN_TYPES.map(d => {
                const Icon = DESIGN_ICONS[d.value] || Layers
                const isActive = form.designType === d.value
                return (
                  <button
                    key={d.value}
                    onClick={() => setForm({ ...form, designType: d.value })}
                    className={cn(
                      'flex flex-col items-start gap-1 p-3 border-2 rounded-lg transition-all text-left',
                      isActive ? 'border-primary bg-accent/50' : 'border-zinc-200 hover:border-zinc-300'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-zinc-400')} />
                      <span className="text-sm" style={{ fontWeight: 500 }}>{d.label}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{d.description}</span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Content & Behavior */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Conteúdo & Comportamento</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Tipo de filtro (quais posts exibir)</Label>
              <Select value={form.filterType} onValueChange={(v) => setForm({ ...form, filterType: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILTER_TYPES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantidade de posts</Label>
                <Input
                  type="number"
                  min={3}
                  max={10}
                  value={form.postCount}
                  onChange={(e) => setForm({ ...form, postCount: Math.max(3, Math.min(10, parseInt(e.target.value) || 5)) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Altura</Label>
                <Select value={form.heightPreset} onValueChange={(v) => setForm({ ...form, heightPreset: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HEIGHT_PRESETS.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-2 border rounded">
                <Label className="text-xs cursor-pointer">Auto-play</Label>
                <Switch checked={form.autoPlay} onCheckedChange={(v) => setForm({ ...form, autoPlay: v })} />
              </div>
              <div>
                <Label className="text-xs">Delay (ms)</Label>
                <Input
                  type="number"
                  min={3000}
                  max={15000}
                  step={500}
                  value={form.delayMs}
                  onChange={(e) => setForm({ ...form, delayMs: parseInt(e.target.value) || 5000 })}
                  className="mt-1"
                  disabled={!form.autoPlay}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visibility options */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Elementos Visíveis</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <ToggleRow label="Slide habilitado" checked={form.isEnabled} onChange={(v) => setForm({ ...form, isEnabled: v })} />
            <ToggleRow label="Mostrar indicadores (dots)" checked={form.showDots} onChange={(v) => setForm({ ...form, showDots: v })} />
            <ToggleRow label="Mostrar setas de navegação" checked={form.showArrows} onChange={(v) => setForm({ ...form, showArrows: v })} />
            <ToggleRow label="Mostrar subtítulo/excerpt" checked={form.showExcerpt} onChange={(v) => setForm({ ...form, showExcerpt: v })} />
            <ToggleRow label="Mostrar badge de categoria" checked={form.showCategory} onChange={(v) => setForm({ ...form, showCategory: v })} />
            <ToggleRow label="Mostrar nome do autor" checked={form.showAuthor} onChange={(v) => setForm({ ...form, showAuthor: v })} />
          </CardContent>
        </Card>

        {/* Preview info */}
        <Card className="bg-zinc-50">
          <CardHeader><CardTitle className="text-base">📋 Resumo da Configuração</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Design:</span><span style={{ fontWeight: 500 }}>{DESIGN_TYPES.find(d => d.value === form.designType)?.label}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Filtro:</span><span style={{ fontWeight: 500 }}>{FILTER_TYPES.find(f => f.value === form.filterType)?.label}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Posts:</span><span style={{ fontWeight: 500 }}>{form.postCount}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Auto-play:</span><span style={{ fontWeight: 500 }}>{form.autoPlay ? `${(form.delayMs / 1000).toFixed(1)}s` : 'Desativado'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Altura:</span><span style={{ fontWeight: 500 }}>{HEIGHT_PRESETS.find(h => h.value === form.heightPreset)?.label}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Status:</span>
                <Badge variant={form.isEnabled ? 'default' : 'secondary'} className="text-xs">{form.isEnabled ? 'Ativo' : 'Inativo'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-3 border-t sticky bottom-0 bg-white py-3">
        <Button onClick={() => onSave(form)} disabled={saving} className="bg-primary">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Label className="text-sm cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
