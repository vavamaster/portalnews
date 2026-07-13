'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles, Loader2, Wand2, FileText, ChevronRight, X, Check, AlertCircle,
  Trophy, Landmark, Shield, TrendingUp, Palette, HeartPulse, GraduationCap,
  Wheat, Flame, Building2, Mic, Cpu, ChevronLeft, Image as ImageIcon,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const TEMPLATE_ICONS: Record<string, any> = {
  Trophy, Landmark, Shield, TrendingUp, Palette, HeartPulse, GraduationCap,
  Wheat, Flame, Building2, Mic, Cpu, FileText,
}

interface Template {
  id: string
  name: string
  description: string
  icon: string
  category: string
  suggestedCategory?: string
  prompt: string
}

interface GeneratedArticle {
  title: string
  subtitle: string
  excerpt: string
  content: string
  tags: string
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  coverImage: string
  gallery: string[]
  customFields: { label: string; value: string; link?: string }[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (article: GeneratedArticle) => void
  categories: any[]
}

export function AIGenerator({ open, onOpenChange, onApply, categories }: Props) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [prompt, setPrompt] = useState('')
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({})
  const [categorySlug, setCategorySlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState<GeneratedArticle | null>(null)
  const [view, setView] = useState<'templates' | 'custom' | 'result'>('templates')

  useEffect(() => {
    fetch('/api/ai/templates').then(r => r.json()).then(data => setTemplates(data.templates || []))
  }, [])

  // Extract placeholders from selected template prompt
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (selectedTemplate) {
      const matches = selectedTemplate.prompt.match(/\{([^}]+)\}/g) || []
      const keys = matches.map(m => m.slice(1, -1))
      const obj: Record<string, string> = {}
      keys.forEach(k => obj[k] = '')
      setPlaceholders(obj)
      setPrompt(selectedTemplate.prompt)
      if (selectedTemplate.suggestedCategory) {
        setCategorySlug(selectedTemplate.suggestedCategory)
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedTemplate])

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template)
    setView('custom')
    setGenerated(null)
  }

  const handleCustomMode = () => {
    setSelectedTemplate(null)
    setPrompt('')
    setPlaceholders({})
    setView('custom')
    setGenerated(null)
  }

  const handleGenerate = async () => {
    // Build final prompt: if template selected with placeholders filled, substitute
    let finalPrompt = prompt
    if (selectedTemplate) {
      // Replace placeholders
      Object.entries(placeholders).forEach(([key, value]) => {
        finalPrompt = finalPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value || key)
      })
    }

    if (!finalPrompt || finalPrompt.trim().length < 5) {
      toast({ title: 'Descreva a matéria', description: 'Digite o que quer noticiar.', variant: 'destructive' })
      return
    }

    setLoading(true)
    setGenerated(null)
    try {
      const categoryName = categories.find(c => c.slug === categorySlug)?.name
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          categoryName,
          templateId: selectedTemplate?.id,
          ...placeholders,
        }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro na geração', description: data.error, variant: 'destructive' })
      } else {
        setGenerated(data.article)
        setView('result')
        toast({ title: '✨ Matéria gerada!', description: 'Revise e aplique ao editor.' })
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!generated) return
    onApply(generated)
    onOpenChange(false)
    // reset
    setGenerated(null)
    setView('templates')
    setSelectedTemplate(null)
    setPrompt('')
    setPlaceholders({})
    toast({ title: 'Matéria aplicada ao editor!', description: 'Revise todos os campos antes de publicar.' })
  }

  const handleRegenerate = () => {
    setGenerated(null)
    setView('custom')
  }

  const closeDialog = () => {
    onOpenChange(false)
    setTimeout(() => {
      setGenerated(null)
      setView('templates')
      setSelectedTemplate(null)
      setPrompt('')
      setPlaceholders({})
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o ? closeDialog() : onOpenChange(o)}>
      <DialogContent className="sm:max-w-5xl lg:max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="bg-gradient-to-br from-purple-500 to-blue-500 text-white p-1.5 rounded-lg">
              <Wand2 className="h-5 w-5" />
            </div>
            Gerador de Matérias com IA
          </DialogTitle>
          <DialogDescription>
            Crie matérias completas automaticamente. Escolha um modelo popular ou descreva o que quer noticiar.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator — modern pill style */}
        <div className="flex items-center gap-1.5 mb-5 p-1 bg-zinc-100/70 rounded-lg w-fit">
          {[
            { id: 'templates', label: 'Modelo', num: 1 },
            { id: 'custom', label: 'Detalhes', num: 2 },
            { id: 'result', label: 'Revisão', num: 3 },
          ].map((step, i) => (
            <div key={step.id} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 text-zinc-400 mx-0.5" />}
              <button
                onClick={() => step.id === 'templates' && setView('templates')}
                disabled={step.id !== 'templates'}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  view === step.id
                    ? 'bg-white shadow-sm text-zinc-900 ring-1 ring-zinc-200/60'
                    : 'text-zinc-500 hover:text-zinc-700'
                )}
              >
                <span className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold',
                  view === step.id
                    ? 'bg-primary text-white'
                    : view === 'custom' && step.id === 'templates'
                      ? 'bg-emerald-500 text-white'
                      : view === 'result' && (step.id === 'templates' || step.id === 'custom')
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-300 text-white'
                )}>
                  {view === 'custom' && step.id === 'templates' ? '✓' :
                   view === 'result' && (step.id === 'templates' || step.id === 'custom') ? '✓' :
                   step.num}
                </span>
                {step.label}
              </button>
            </div>
          ))}
        </div>

        {/* VIEW 1: Templates list */}
        {view === 'templates' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-purple-50/60 to-blue-50/60 border border-purple-100/60 rounded-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <p className="text-sm text-zinc-700">Escolha um modelo popular ou crie do zero</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCustomMode} className="bg-white border-purple-200 text-purple-700 hover:bg-purple-50 flex-shrink-0">
                <Sparkles className="h-4 w-4 mr-1" /> Modo livre
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {templates.map((t) => {
                const Icon = TEMPLATE_ICONS[t.icon] || FileText
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className="text-left p-3 border border-zinc-200 rounded-xl hover:border-primary hover:bg-accent/50 transition-all hover-lift group flex flex-col min-h-[150px] active:scale-[0.98] bg-white hover:shadow-md"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-accent p-2 rounded-lg group-hover:bg-primary group-hover:text-white group-hover:shadow-md transition-all flex-shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-xs text-zinc-900 flex-1 leading-tight line-clamp-2" style={{ fontWeight: 600 }}>{t.name}</div>
                    </div>
                    <p className="text-[11px] text-zinc-500 line-clamp-3 flex-1 leading-snug">{t.description}</p>
                    <div className="text-[10px] text-zinc-400 mt-2 flex items-center gap-1">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{t.category}</Badge>
                      <span className="ml-auto text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-medium">
                        Usar <ChevronRight className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: Custom prompt / template fill */}
        {view === 'custom' && (
          <div className="space-y-4">
            {selectedTemplate && (
              <div className="bg-accent/50 border border-zinc-200 rounded-lg p-3 flex items-start gap-2">
                <div className="bg-primary text-white p-1.5 rounded">
                  {(() => {
                    const Icon = TEMPLATE_ICONS[selectedTemplate.icon] || FileText
                    return <Icon className="h-3.5 w-3.5" />
                  })()}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-zinc-900" style={{ fontWeight: 500 }}>{selectedTemplate.name}</div>
                  <div className="text-xs text-zinc-600">{selectedTemplate.description}</div>
                </div>
                <button onClick={() => setView('templates')} className="text-zinc-400 hover:text-zinc-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Placeholders (if template) */}
            {selectedTemplate && Object.keys(placeholders).length > 0 && (
              <div>
                <Label className="text-sm">Preencha os campos do modelo</Label>
                <p className="text-xs text-zinc-500 mb-3">Substitua os placeholders {`{entre chaves}`} pelos dados reais.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(placeholders).map(([key, value]) => (
                    <div key={key}>
                      <Label className="text-xs flex items-center gap-1">
                        <code className="bg-zinc-100 px-1 rounded text-primary">{`{${key}}`}</code>
                      </Label>
                      <Input
                        value={value}
                        onChange={(e) => setPlaceholders({ ...placeholders, [key]: e.target.value })}
                        placeholder={`Valor para ${key}`}
                        className="mt-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Free-form prompt (custom mode or template description) */}
            <div>
              <Label className="text-sm">
                {selectedTemplate ? 'Prompt adicional (opcional)' : 'Descreva a matéria que quer gerar'}
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Ex: Fale sobre o jogo da Copa do Mundo da partida de hoje entre Brasil e Argentina com foto na categoria Esportes. Placar final 2x1 para o Brasil, gols de Neymar e Vinícius..."
                className="mt-1"
              />
              <p className="text-xs text-zinc-500 mt-1">
                💡 Dica: quanto mais detalhes (nomes, números, contexto, local), melhor a matéria gerada.
              </p>
            </div>

            {/* Category selection */}
            <div>
              <Label className="text-sm">Categoria sugerida</Label>
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Action */}
            <div className="flex items-center justify-between pt-3 border-t">
              <Button variant="ghost" onClick={() => setView('templates')}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar aos modelos
              </Button>
              <Button onClick={handleGenerate} disabled={loading} className="bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando matéria... (até 2 min)
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" /> Gerar com IA
                  </>
                )}
              </Button>
            </div>

            {loading && (
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5 text-center overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-200/20 to-transparent animate-pulse" />
                <div className="relative">
                  <div className="flex items-center justify-center gap-2.5 text-purple-700 text-sm mb-4">
                    <div className="relative">
                      <Sparkles className="h-5 w-5 animate-pulse" />
                      <div className="absolute inset-0 blur-md text-purple-400">
                        <Sparkles className="h-5 w-5" />
                      </div>
                    </div>
                    <span className="font-medium">Gerando conteúdo e buscando imagens...</span>
                  </div>
                  <div className="text-xs text-purple-600/70 mb-4">Isso pode levar até 2 minutos</div>
                  <div className="grid grid-cols-3 gap-2 text-xs max-w-md mx-auto">
                    <div className="bg-white p-3 rounded-lg shadow-sm ring-1 ring-purple-100/60">
                      <div className="w-7 h-7 mx-auto mb-1.5 rounded-full bg-purple-100 flex items-center justify-center">
                        <FileText className="h-3.5 w-3.5 text-purple-600" />
                      </div>
                      <div className="text-purple-700 font-semibold text-[11px]">1. Texto</div>
                      <div className="text-zinc-500 text-[10px] mt-0.5">Gerando...</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm ring-1 ring-purple-100/60">
                      <div className="w-7 h-7 mx-auto mb-1.5 rounded-full bg-blue-100 flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div className="text-blue-700 font-semibold text-[11px]">2. SEO</div>
                      <div className="text-zinc-500 text-[10px] mt-0.5">Otimizando...</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm ring-1 ring-purple-100/60">
                      <div className="w-7 h-7 mx-auto mb-1.5 rounded-full bg-emerald-100 flex items-center justify-center">
                        <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <div className="text-emerald-700 font-semibold text-[11px]">3. Imagens</div>
                      <div className="text-zinc-500 text-[10px] mt-0.5">Buscando...</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: Result preview */}
        {view === 'result' && generated && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/30">
                <Check className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-emerald-900 font-semibold">Matéria gerada com sucesso!</div>
                <div className="text-xs text-emerald-700">Revise todos os campos abaixo antes de aplicar ao editor.</div>
              </div>
            </div>

            {/* Cover image preview */}
            {generated.coverImage && (
              <div>
                <Label className="text-sm flex items-center gap-1.5 mb-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-zinc-400" />
                  Imagem de capa gerada
                </Label>
                <div className="aspect-video bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 relative shadow-sm">
                  <SmartImage key={generated.coverImage} src={generated.coverImage} alt="Preview" />
                </div>
                {generated.gallery.length > 1 && (
                  <p className="text-xs text-zinc-500 mt-1">+{generated.gallery.length - 1} imagens na galeria também</p>
                )}
              </div>
            )}

            {/* Title */}
            <div>
              <Label className="text-sm text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">Título</Label>
              <div className="mt-1 p-3 bg-zinc-50 rounded-lg text-zinc-900 font-bold text-base border border-zinc-100">{generated.title}</div>
            </div>

            {/* Subtitle + Excerpt in 2 cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {generated.subtitle && (
                <div>
                  <Label className="text-sm text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">Subtítulo</Label>
                  <div className="mt-1 p-3 bg-zinc-50 rounded-lg text-zinc-600 text-sm border border-zinc-100">{generated.subtitle}</div>
                </div>
              )}
              {generated.excerpt && (
                <div>
                  <Label className="text-sm text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">Resumo</Label>
                  <div className="mt-1 p-3 bg-zinc-50 rounded-lg text-zinc-600 text-sm border border-zinc-100">{generated.excerpt}</div>
                </div>
              )}
            </div>

            {/* Content preview (markdown) */}
            <div>
              <Label className="text-sm text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">Conteúdo (Markdown)</Label>
              <div className="mt-1 p-4 bg-zinc-900 rounded-lg max-h-72 overflow-y-auto custom-scrollbar ring-1 ring-zinc-800">
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">{generated.content}</pre>
              </div>
            </div>

            {/* Tags + SEO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Tags</Label>
                <div className="mt-1 p-2 bg-zinc-50 rounded-lg text-xs text-zinc-700">{generated.tags}</div>
              </div>
              <div>
                <Label className="text-sm">SEO Keywords</Label>
                <div className="mt-1 p-2 bg-zinc-50 rounded-lg text-xs text-zinc-700">{generated.seoKeywords}</div>
              </div>
            </div>

            {generated.seoTitle && (
              <div>
                <Label className="text-sm">SEO Title</Label>
                <div className="mt-1 p-2 bg-zinc-50 rounded-lg text-xs text-zinc-700">{generated.seoTitle}</div>
              </div>
            )}

            {generated.seoDescription && (
              <div>
                <Label className="text-sm">SEO Description</Label>
                <div className="mt-1 p-2 bg-zinc-50 rounded-lg text-xs text-zinc-700">{generated.seoDescription}</div>
              </div>
            )}

            {/* Custom fields */}
            {generated.customFields.length > 0 && (
              <div>
                <Label className="text-sm">Campos personalizados</Label>
                <div className="mt-1 space-y-1">
                  {generated.customFields.map((f, i) => (
                    <div key={i} className="p-2 bg-zinc-50 rounded-lg text-xs flex items-center gap-2">
                      <span className="text-zinc-500">{f.label}:</span>
                      <span className="text-zinc-900" style={{ fontWeight: 500 }}>{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t sticky bottom-0 bg-white pb-2">
              <Button variant="outline" onClick={handleRegenerate}>
                <Wand2 className="h-4 w-4 mr-1" /> Gerar outra
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={closeDialog}>Cancelar</Button>
                <Button onClick={handleApply} className="bg-emerald-600 hover:bg-emerald-700">
                  <Check className="h-4 w-4 mr-1" /> Aplicar ao editor
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Smart image — if the original URL fails to load, show a placeholder div (NOT loremflickr)
export function SmartImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className={cn('w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-400 text-sm', className)}>
        <span>Imagem indisponível</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={className || 'w-full h-full object-cover'}
    />
  )
}
