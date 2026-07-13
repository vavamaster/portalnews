'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Loader2, Download, ExternalLink, FileText, Image as ImageIcon, Calendar,
  User, FolderTree, Tag, Hash, Eye, EyeOff, AlertCircle, CheckCircle2,
  Link2, Clock, Type, AlignLeft, Globe, Plus, ArrowRight, Sparkles,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WpPost {
  id: number
  title: string
  excerpt: string
  date: string
  modified: string
  link: string
  featuredImage: string
  author: string
  categories: string[]
  content: string
  slug: string
  isImported: boolean
  portalPostId?: string
}

interface PreviewModalProps {
  post: WpPost | null
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: any[]
  connectionId: string | null
  onCategoriesChanged: () => void
  onConfirm: (overrides: { categoryId: string; status: 'DRAFT' | 'PUBLISHED'; tags: string }) => void
  importing: boolean
}

const CREATE_NEW = '__create_new__'

export function WordPressImportPreview({
  post, open, onOpenChange, categories, connectionId, onCategoriesChanged, onConfirm, importing,
}: PreviewModalProps) {
  const { toast } = useToast()
  const [categoryId, setCategoryId] = useState('')
  const [publish, setPublish] = useState(false)
  const [tags, setTags] = useState('')
  const [showContent, setShowContent] = useState(false)
  const [showPreviewMode, setShowPreviewMode] = useState<'html' | 'markdown'>('markdown')

  // Category mapping state — maps WP category → portal category
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({})
  const [creatingCategory, setCreatingCategory] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)

  // Sync form state when post changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!post) return

    // Build initial mapping with auto-match by name
    const initial: Record<string, string> = {}
    for (const wpCat of post.categories) {
      const matched = categories.find(c =>
        c.name.toLowerCase() === wpCat.toLowerCase() ||
        c.slug.toLowerCase() === wpCat.toLowerCase().replace(/\s+/g, '-')
      )
      if (matched) {
        initial[wpCat] = matched.id
      } else {
        initial[wpCat] = CREATE_NEW
        // Pre-fill new category name with the WP name
      }
    }
    setCategoryMapping(initial)

    // Default category = first matched mapping, else first portal category
    const firstMatched = Object.values(initial).find(v => v !== CREATE_NEW)
    setCategoryId(firstMatched || categories[0]?.id || '')
    setTags(post.categories.join(', '))
    setPublish(false)
    setShowContent(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [post, categories])

  // Compute markdown preview (basic)
  const markdownPreview = useMemo(() => {
    if (!post) return ''
    return simpleHtmlToMarkdownPreview(post.content)
  }, [post])

  // Stats about the content
  const stats = useMemo(() => {
    if (!post) return { words: 0, chars: 0, images: 0, links: 0, readTime: 0 }
    const text = post.content || ''
    const plainText = text.replace(/<[^>]+>/g, ' ')
    const words = plainText.trim().split(/\s+/).filter(Boolean).length
    const images = (text.match(/<img/gi) || []).length
    const links = (text.match(/<a\s/gi) || []).length
    return {
      words,
      chars: text.length,
      images,
      links,
      readTime: Math.max(1, Math.ceil(words / 200)),
    }
  }, [post])

  // Get the resolved category ID for the import (use first matched mapping)
  // Must be called before any conditional return to satisfy Rules of Hooks
  const resolvedCategoryId = useMemo(() => {
    const matched = Object.values(categoryMapping).find(v => v && v !== CREATE_NEW)
    return matched || categoryId
  }, [categoryMapping, categoryId])

  if (!post) return null

  // Save mapping when category changes
  const updateMapping = async (wpCat: string, catId: string) => {
    setCategoryMapping(prev => ({ ...prev, [wpCat]: catId }))
    if (connectionId && catId !== CREATE_NEW) {
      try {
        await fetch('/api/admin/wordpress/mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId, wpCategory: wpCat, categoryId: catId }),
        })
      } catch {}
    }
  }

  // Create new category on the fly
  const handleCreateCategory = async (wpCat: string) => {
    const name = newCategoryName.trim() || wpCat
    if (!name) {
      toast({ title: 'Informe o nome da categoria', variant: 'destructive' })
      return
    }
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    setCreatingCat(true)
    try {
      const r = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      })
      const d = await r.json()
      if (d.error) {
        toast({ title: 'Erro', description: d.error, variant: 'destructive' })
      } else {
        toast({ title: '✓ Categoria criada', description: name })
        onCategoriesChanged()
        setCategoryMapping(prev => ({ ...prev, [wpCat]: d.category.id }))
        if (categoryId === CREATE_NEW || !categoryId) setCategoryId(d.category.id)
        setCreatingCategory(null)
        setNewCategoryName('')
      }
    } finally {
      setCreatingCat(false)
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="bg-blue-500 text-white p-1.5 rounded-lg">
              <Download className="h-4 w-4" />
            </div>
            Pré-visualização da Importação
          </DialogTitle>
          <DialogDescription>
            Revise todos os dados da matéria antes de confirmar a importação para o portal.
          </DialogDescription>
        </DialogHeader>

        {/* Warning if already imported */}
        {post.isImported && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="text-amber-900">Esta matéria já foi importada.</strong>
              <div className="text-amber-700 text-xs mt-0.5">
                Importar novamente criará um post duplicado.
              </div>
            </div>
          </div>
        )}

        {/* === Cover image preview === */}
        {post.featuredImage && (
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5 mb-1.5">
              <ImageIcon className="h-3 w-3" /> Imagem de Capa
            </Label>
            <div className="aspect-video bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 relative">
              <img src={post.featuredImage} alt={post.title} className="w-full h-full object-cover" />
              <a
                href={post.featuredImage}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-xs px-2 py-1 rounded-md hover:bg-white flex items-center gap-1 shadow-sm"
              >
                <ExternalLink className="h-3 w-3" /> Ver original
              </a>
            </div>
          </div>
        )}

        {/* === Title === */}
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5 mb-1.5">
            <Type className="h-3 w-3" /> Título
          </Label>
          <div className="p-3 bg-zinc-50 rounded-lg text-zinc-900 font-bold text-base border border-zinc-100">
            {post.title}
          </div>
        </div>

        {/* === Excerpt === */}
        {post.excerpt && (
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5 mb-1.5">
              <AlignLeft className="h-3 w-3" /> Resumo (excerpt)
            </Label>
            <div className="p-3 bg-zinc-50 rounded-lg text-zinc-600 text-sm border border-zinc-100 leading-relaxed">
              {post.excerpt}
            </div>
          </div>
        )}

        {/* === Metadata grid === */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white border border-zinc-200 rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1 mb-0.5">
              <Calendar className="h-2.5 w-2.5" /> Publicado
            </div>
            <div className="text-xs font-semibold text-zinc-900">{formatDate(post.date)}</div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1 mb-0.5">
              <Clock className="h-2.5 w-2.5" /> Modificado
            </div>
            <div className="text-xs font-semibold text-zinc-900">{formatDate(post.modified)}</div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1 mb-0.5">
              <User className="h-2.5 w-2.5" /> Autor
            </div>
            <div className="text-xs font-semibold text-zinc-900 truncate">{post.author}</div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1 mb-0.5">
              <Hash className="h-2.5 w-2.5" /> WP ID
            </div>
            <div className="text-xs font-semibold text-zinc-900">#{post.id}</div>
          </div>
        </div>

        {/* === CATEGORY MAPPING — the new feature === */}
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5 mb-2">
            <FolderTree className="h-3 w-3" /> Mapeamento de Categorias (WordPress → Portal)
          </Label>
          <p className="text-[11px] text-zinc-500 mb-2">
            Defina para qual categoria do portal cada categoria do WordPress será destinada.
            Categorias com nomes iguais são pré-preenchidas automaticamente.
          </p>
          <div className="space-y-2">
            {post.categories.length === 0 ? (
              <div className="text-xs text-zinc-400 italic p-2 bg-zinc-50 rounded">
                Esta matéria não tem categorias no WordPress. Escolha uma categoria destino abaixo.
              </div>
            ) : (
              post.categories.map(wpCat => {
                const mapped = categoryMapping[wpCat] || ''
                const isCreating = creatingCategory === wpCat
                return (
                  <div key={wpCat} className="flex items-center gap-2 p-2 bg-zinc-50 border border-zinc-200 rounded-lg">
                    <Badge variant="outline" className="text-[10px] bg-white flex-shrink-0">{wpCat}</Badge>
                    <ArrowRight className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {isCreating ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder={`Nome da nova categoria (ex: ${wpCat})`}
                            className="h-7 text-xs"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => handleCreateCategory(wpCat)}
                            disabled={creatingCat}
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 flex-shrink-0"
                          >
                            {creatingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            Criar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setCreatingCategory(null); setNewCategoryName('') }}
                            className="h-7 text-xs flex-shrink-0"
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={mapped}
                          onValueChange={(v) => {
                            if (v === CREATE_NEW) {
                              setCreatingCategory(wpCat)
                              setNewCategoryName(wpCat)
                            } else {
                              updateMapping(wpCat, v)
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Escolha..." />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                            <SelectItem value={CREATE_NEW}>
                              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                                <Plus className="h-3 w-3" /> Criar nova categoria
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* === Slug === */}
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5 mb-1.5">
            <Link2 className="h-3 w-3" /> Slug / Link
          </Label>
          <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
            <div className="text-xs font-mono text-zinc-700 truncate">{post.slug}</div>
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-1"
            >
              <Globe className="h-2.5 w-2.5" /> {post.link}
            </a>
          </div>
        </div>

        {/* === Content stats === */}
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5 mb-1.5">
            <FileText className="h-3 w-3" /> Conteúdo — Estatísticas
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
              <div className="text-base font-bold text-blue-700">{stats.words.toLocaleString('pt-BR')}</div>
              <div className="text-[9px] uppercase tracking-wider text-blue-600 font-semibold">Palavras</div>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-center">
              <div className="text-base font-bold text-purple-700">{stats.chars.toLocaleString('pt-BR')}</div>
              <div className="text-[9px] uppercase tracking-wider text-purple-600 font-semibold">Caracteres</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center">
              <div className="text-base font-bold text-emerald-700">{stats.images}</div>
              <div className="text-[9px] uppercase tracking-wider text-emerald-600 font-semibold">Imagens</div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
              <div className="text-base font-bold text-amber-700">{stats.links}</div>
              <div className="text-[9px] uppercase tracking-wider text-amber-600 font-semibold">Links</div>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 text-center">
              <div className="text-base font-bold text-rose-700">{stats.readTime}</div>
              <div className="text-[9px] uppercase tracking-wider text-rose-600 font-semibold">Min leitura</div>
            </div>
          </div>
        </div>

        {/* === Content preview with HTML → Markdown conversion === */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> Conteúdo Convertido (preview)
            </Label>
            <div className="flex items-center gap-1 bg-zinc-100 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setShowPreviewMode('markdown')}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium transition-all',
                  showPreviewMode === 'markdown' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'
                )}
              >
                Markdown
              </button>
              <button
                type="button"
                onClick={() => setShowPreviewMode('html')}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium transition-all',
                  showPreviewMode === 'html' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'
                )}
              >
                HTML original
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowContent(!showContent)}
            className="w-full flex items-center justify-between p-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-colors"
          >
            <span className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
              {showContent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showContent ? 'Ocultar conteúdo' : 'Visualizar conteúdo'}
              <Badge variant="outline" className="text-[9px] ml-1">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                {showPreviewMode === 'markdown' ? 'Convertido' : 'Original'}
              </Badge>
            </span>
            <span className="text-[10px] text-zinc-400">
              {showPreviewMode === 'markdown' ? `${markdownPreview.length} chars` : `${stats.chars.toLocaleString('pt-BR')} chars`}
            </span>
          </button>
          {showContent && (
            <div className="mt-1.5 p-3 bg-zinc-900 rounded-lg max-h-64 overflow-y-auto ring-1 ring-zinc-800">
              <pre className="text-[10px] text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                {showPreviewMode === 'markdown' ? markdownPreview : post.content}
              </pre>
            </div>
          )}
          {showPreviewMode === 'markdown' && (
            <div className="mt-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded p-2 flex items-start gap-1.5">
              <Sparkles className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>
                O HTML do WordPress foi convertido para Markdown automaticamente: tags <code className="bg-emerald-100 px-0.5 rounded">&lt;section&gt;</code>, <code className="bg-emerald-100 px-0.5 rounded">&lt;figure&gt;</code> e atributos foram removidos; <code className="bg-emerald-100 px-0.5 rounded">&lt;strong&gt;</code> → <code className="bg-emerald-100 px-0.5 rounded">**</code>, <code className="bg-emerald-100 px-0.5 rounded">&lt;a&gt;</code> → <code className="bg-emerald-100 px-0.5 rounded">[text](url)</code>, etc.
              </span>
            </div>
          )}
        </div>

        {/* === Import configuration === */}
        <div className="border-t border-zinc-200 pt-4 space-y-3">
          <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Configurações de Importação</div>

          {/* Category select (resolved from mapping) */}
          <div>
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5 text-zinc-400" />
              Categoria principal do portal
            </Label>
            <Select value={resolvedCategoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-zinc-500 mt-1">
              Esta é a categoria principal que será usada para a matéria no portal. O mapeamento acima é salvo para importações futuras.
            </p>
          </div>

          {/* Tags */}
          <div>
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-zinc-400" />
              Tags (separadas por vírgula)
            </Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="mt-1"
            />
          </div>

          {/* Publish toggle */}
          <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
            <Switch checked={publish} onCheckedChange={setPublish} id="publish-wp" />
            <Label htmlFor="publish-wp" className="cursor-pointer flex-1">
              <div className="text-sm font-medium text-zinc-900">
                {publish ? 'Publicar imediatamente' : 'Importar como rascunho'}
              </div>
              <div className="text-[11px] text-zinc-500">
                {publish
                  ? 'A matéria ficará visível no portal assim que importada.'
                  : 'A matéria será importada como rascunho para revisão antes de publicar.'}
              </div>
            </Label>
          </div>
        </div>

        {/* === Actions === */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-200 sticky bottom-0 bg-white pb-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 px-3 py-2"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ver no site original
            </a>
            <Button
              onClick={() => onConfirm({ categoryId: resolvedCategoryId, status: publish ? 'PUBLISHED' : 'DRAFT', tags })}
              disabled={importing || !resolvedCategoryId}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {importing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Importação</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Simple HTML-to-Markdown preview (client-side, mirrors the server-side logic)
function simpleHtmlToMarkdownPreview(html: string): string {
  if (!html) return ''
  let s = html
  // Remove scripts/styles/comments
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // Unwrap section/div/figure/article
  s = s.replace(/<section[^>]*>([\s\S]*?)<\/section>/gi, '$1')
  s = s.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1')
  s = s.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, '$1')
  s = s.replace(/<article[^>]*>([\s\S]*?)<\/article>/gi, '$1')
  // Links
  s = s.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim()
    return cleanText ? `[${cleanText}](${url})` : ''
  })
  s = s.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
  // Images
  s = s.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi, '\n\n![]($1)\n\n')
  // Bold/italic/underline
  s = s.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
  s = s.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
  s = s.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
  s = s.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
  s = s.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '*$1*')
  // Headings
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
  // Lists
  s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (m, c) => '\n' + c.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n')
  s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (m, c) => { let i = 1; return '\n' + c.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, () => `${i++}. $1\n`) + '\n' })
  // Paragraphs
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  // Strip remaining tags
  s = s.replace(/<\/?[^>]+(>|$)/g, '')
  // Decode entities
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  // Cleanup
  s = s.replace(/\n{3,}/g, '\n\n').split('\n').map(l => l.trim()).join('\n').trim()
  return s
}
