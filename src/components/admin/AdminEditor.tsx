'use client'

import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Save, Eye, X, ImageIcon, Play, Link2, Loader2, Bold, Italic, Heading, List, Quote, Code, Wand2, Share2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { AIGenerator, SmartImage } from './AIGenerator'
import { ImageUpload } from './ImageUpload'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { SocialPreview } from '@/components/ui/social-preview'
import { safeJsonArray } from '@/lib/utils'

interface Props {
  postId?: string
}

export function AdminEditor({ postId }: Props) {
  const { setView } = useAppStore()
  const { toast } = useToast()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(!!postId)
  const [saving, setSaving] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [form, setForm] = useState<any>({
    title: '', subtitle: '', excerpt: '', content: '', coverImage: '',
    gallery: [], videos: [], customFields: [],
    tags: '', categoryId: '', status: 'DRAFT', featured: false, breaking: false,
    seoTitle: '', seoDescription: '', seoKeywords: '', ogImage: '', canonicalUrl: '',
    publishedAt: '',
  })
  const [currentPostId, setCurrentPostId] = useState<string | undefined>(postId)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(data => {
      const cats = data.categories || []
      setCategories(cats)
      if (cats[0] && !form.categoryId) {
        setForm((f: any) => ({ ...f, categoryId: cats[0].id }))
      }
    })
    if (postId) {
      fetch(`/api/posts/${postId}`)
        .then(r => r.json())
        .then(data => {
          if (data.post) {
            const p = data.post
            setForm({
              title: p.title || '',
              subtitle: p.subtitle || '',
              excerpt: p.excerpt || '',
              content: p.content || '',
              coverImage: p.coverImage || '',
              gallery: safeJsonArray(p.gallery, []),
              videos: safeJsonArray(p.videos, []),
              customFields: safeJsonArray(p.customFields, []),
              tags: p.tags || '',
              categoryId: p.categoryId,
              status: p.status,
              featured: p.featured,
              breaking: p.breaking,
              seoTitle: p.seoTitle || '',
              seoDescription: p.seoDescription || '',
              seoKeywords: p.seoKeywords || '',
              ogImage: p.ogImage || '',
              canonicalUrl: p.canonicalUrl || '',
              publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 16) : '',
            })
          }
        })
        .finally(() => setLoading(false))
    }
  }, [postId])

  const insertMarkdown = (before: string, after: string = '', placeholder: string = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = ta.value.substring(start, end) || placeholder
    const newText = ta.value.substring(0, start) + before + selected + after + ta.value.substring(end)
    setForm({ ...form, content: newText })
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + before.length
      ta.selectionEnd = start + before.length + selected.length
    }, 0)
  }

  const handleSave = async (newStatus?: string) => {
    if (!form.title || !form.content || !form.categoryId) {
      toast({ title: 'Preencha título, conteúdo e categoria', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body = {
        ...form,
        status: newStatus || form.status,
        publishedAt: form.publishedAt || null,
      }
      const url = currentPostId ? `/api/posts/${currentPostId}` : '/api/posts'
      const method = currentPostId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        toast({ title: currentPostId ? 'Notícia atualizada!' : 'Notícia criada!' })
        if (!currentPostId && data.post) {
          setCurrentPostId(data.post.id)
        }
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingSpinner className="py-0" />
  }

  return (
    <div className="space-y-4">
      {/* Action bar — fixed at top, full width, proper z-index */}
      <div className="flex flex-wrap items-center gap-2 justify-between bg-white/95 backdrop-blur-md border border-zinc-200 rounded-xl p-3 shadow-sm sticky top-2 z-20">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Rascunho</SelectItem>
              <SelectItem value="PUBLISHED">Publicado</SelectItem>
              <SelectItem value="SCHEDULED">Agendado</SelectItem>
              <SelectItem value="ARCHIVED">Arquivado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} id="featured" />
            <Label htmlFor="featured" className="cursor-pointer">Destaque</Label>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={form.breaking} onCheckedChange={(v) => setForm({ ...form, breaking: v })} id="breaking" />
            <Label htmlFor="breaking" className="cursor-pointer">Urgente</Label>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAiOpen(true)}
            className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-blue-100"
          >
            <Wand2 className="h-4 w-4 mr-1" /> Gerar com IA
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSave('DRAFT')} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Salvar Rascunho
          </Button>
          <Button size="sm" onClick={() => handleSave('PUBLISHED')} disabled={saving} className="bg-primary">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />}
            Publicar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="media">Mídia</TabsTrigger>
          <TabsTrigger value="custom">Campos & Links</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* CONTENT TAB */}
        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div>
                <Label>Título *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Título da notícia"
                  className="mt-1 text-lg font-bold"
                />
              </div>
              <div>
                <Label>Subtítulo</Label>
                <Input
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="Subtítulo / linha fina"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Resumo (excerpt)</Label>
                <Textarea
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                  placeholder="Resumo curto que aparece nas listagens. Se vazio, gerado automaticamente."
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Conteúdo (Markdown) *</Label>
                <p className="text-xs text-zinc-500 mt-1 mb-2">
                  Editor com preview ao vivo. Use a barra de ferramentas ou atalhos: <kbd className="px-1 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[10px] font-mono">Ctrl+B</kbd> negrito, <kbd className="px-1 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[10px] font-mono">Ctrl+I</kbd> itálico, <kbd className="px-1 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[10px] font-mono">Ctrl+K</kbd> link.
                </p>
                <RichTextEditor
                  value={form.content}
                  onChange={(v) => setForm({ ...form, content: v })}
                  minHeight={600}
                  placeholder="Escreva o conteúdo da notícia em Markdown..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MEDIA TAB */}
        <TabsContent value="media" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Imagem de Capa</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload
                value={form.coverImage}
                onChange={(url) => setForm({ ...form, coverImage: url })}
                label="Imagem de Capa"
                placeholder="URL da imagem ou faça upload"
              />
              {form.coverImage && (
                <div className="mt-3 aspect-video bg-zinc-100 rounded overflow-hidden">
                  <SmartImage key={form.coverImage} src={form.coverImage} alt="Capa" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Galeria de Imagens</span>
                <Button size="sm" variant="outline" onClick={() => setForm({ ...form, gallery: [...form.gallery, ''] })}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {form.gallery.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">Nenhuma imagem na galeria.</p>
              ) : (
                <div className="space-y-2">
                  {form.gallery.map((url: string, i: number) => (
                    <div key={`gallery-${i}-${url}`} className="flex items-center gap-2">
                      <div className="flex-1">
                        <ImageUpload
                          value={url}
                          onChange={(newUrl) => {
                            const g = [...form.gallery]; g[i] = newUrl
                            setForm({ ...form, gallery: g })
                          }}
                          placeholder="URL da imagem ou faça upload"
                        />
                      </div>
                      {url && <img src={url} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" />}
                      <Button size="icon" variant="ghost" className="text-red-600 flex-shrink-0" onClick={() => setForm({ ...form, gallery: form.gallery.filter((_: any, j: number) => j !== i) })}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Play className="h-4 w-4" /> Vídeos</span>
                <Button size="sm" variant="outline" onClick={() => setForm({ ...form, videos: [...form.videos, { url: '', type: 'youtube', caption: '' }] })}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Vídeo
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {form.videos.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">Nenhum vídeo adicionado.</p>
              ) : (
                <div className="space-y-3">
                  {form.videos.map((v: any, i: number) => (
                    <div key={`video-${i}-${v.url || ''}`} className="border border-zinc-200 rounded p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-700">Vídeo {i + 1}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={() => setForm({ ...form, videos: form.videos.filter((_: any, j: number) => j !== i) })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        value={v.url}
                        onChange={(e) => {
                          const vids = [...form.videos]; vids[i] = { ...vids[i], url: e.target.value }
                          setForm({ ...form, videos: vids })
                        }}
                        placeholder="URL embed (ex: https://www.youtube.com/embed/VIDEO_ID)"
                      />
                      <Input
                        value={v.caption || ''}
                        onChange={(e) => {
                          const vids = [...form.videos]; vids[i] = { ...vids[i], caption: e.target.value }
                          setForm({ ...form, videos: vids })
                        }}
                        placeholder="Legenda (opcional)"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CUSTOM FIELDS TAB */}
        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Campos Personalizados com Links</span>
                <Button size="sm" variant="outline" onClick={() => setForm({ ...form, customFields: [...form.customFields, { label: '', value: '', link: '' }] })}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Campo
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {form.customFields.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">Nenhum campo personalizado. Adicione fontes, documentos, links externos, etc.</p>
              ) : (
                <div className="space-y-3">
                  {form.customFields.map((f: any, i: number) => (
                    <div key={`cf-${i}-${f.label || ''}`} className="border border-zinc-200 rounded p-3 grid grid-cols-1 sm:grid-cols-[1fr_2fr_2fr_auto] gap-2 items-end">
                      <div>
                        <Label className="text-xs">Rótulo</Label>
                        <Input
                          value={f.label}
                          onChange={(e) => {
                            const c = [...form.customFields]; c[i] = { ...c[i], label: e.target.value }
                            setForm({ ...form, customFields: c })
                          }}
                          placeholder="Ex: Fonte Oficial"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Valor</Label>
                        <Input
                          value={f.value}
                          onChange={(e) => {
                            const c = [...form.customFields]; c[i] = { ...c[i], value: e.target.value }
                            setForm({ ...form, customFields: c })
                          }}
                          placeholder="Ex: Câmara Municipal"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Link (opcional)</Label>
                        <Input
                          value={f.link || ''}
                          onChange={(e) => {
                            const c = [...form.customFields]; c[i] = { ...c[i], link: e.target.value }
                            setForm({ ...form, customFields: c })
                          }}
                          placeholder="https://..."
                          className="mt-1"
                        />
                      </div>
                      <Button size="icon" variant="ghost" className="text-red-600" onClick={() => setForm({ ...form, customFields: form.customFields.filter((_: any, j: number) => j !== i) })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Tags</CardTitle></CardHeader>
            <CardContent>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="Tags separadas por vírgula: politica, camara, orcamento"
              />
              <p className="text-xs text-zinc-500 mt-1">As tags ajudam leitores a encontrar notícias relacionadas.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO TAB */}
        <TabsContent value="seo" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">SEO (por notícia)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Título SEO (override)</Label>
                <Input
                  value={form.seoTitle}
                  onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                  placeholder="Deixe vazio para usar o título da notícia"
                  className="mt-1"
                />
                <p className="text-xs text-zinc-500 mt-1">{(form.seoTitle || form.title).length}/60 caracteres recomendados</p>
              </div>
              <div>
                <Label>Descrição SEO (meta description)</Label>
                <Textarea
                  value={form.seoDescription}
                  onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                  placeholder="Descrição para mecanismos de busca e redes sociais"
                  rows={2}
                  className="mt-1"
                />
                <p className="text-xs text-zinc-500 mt-1">{(form.seoDescription || '').length}/160 caracteres recomendados</p>
              </div>
              <div>
                <Label>Palavras-chave SEO</Label>
                <Input
                  value={form.seoKeywords}
                  onChange={(e) => setForm({ ...form, seoKeywords: e.target.value })}
                  placeholder="palavra1, palavra2, palavra3"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>OpenGraph Image (override)</Label>
                <ImageUpload
                  value={form.ogImage || ''}
                  onChange={(url) => setForm({ ...form, ogImage: url })}
                  placeholder="Deixe vazio para usar imagem de capa"
                />
              </div>
              <div>
                <Label>Canonical URL</Label>
                <Input
                  value={form.canonicalUrl}
                  onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>

              {/* === Social Preview — how the article will look when shared === */}
              <div className="pt-4 border-t border-zinc-100">
                <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Share2 className="h-4 w-4 text-primary" />
                  Preview de Compartilhamento
                </Label>
                <p className="text-xs text-zinc-500 mb-3">
                  Veja como a notícia vai aparecer quando compartilhada no WhatsApp, Facebook, Twitter e outras redes.
                </p>
                <SocialPreview
                  title={form.seoTitle || form.title || 'Título da notícia'}
                  description={form.seoDescription || form.excerpt || form.subtitle || 'Descrição da notícia apareceria aqui neste espaço.'}
                  image={form.ogImage || form.coverImage}
                  siteName="Portal"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Configurações</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Categoria *</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Rascunho</SelectItem>
                    <SelectItem value="PUBLISHED">Publicado</SelectItem>
                    <SelectItem value="SCHEDULED">Agendado</SelectItem>
                    <SelectItem value="ARCHIVED">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.status === 'SCHEDULED' && (
                <div>
                  <Label>Data de Publicação</Label>
                  <Input
                    type="datetime-local"
                    value={form.publishedAt}
                    onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
                    className="mt-1"
                  />
                </div>
              )}
              <div className="flex items-center gap-6 pt-3 border-t border-zinc-100">
                <div className="flex items-center gap-2">
                  <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} id="feat2" />
                  <Label htmlFor="feat2" className="cursor-pointer">Notícia em Destaque</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.breaking} onCheckedChange={(v) => setForm({ ...form, breaking: v })} id="break2" />
                  <Label htmlFor="break2" className="cursor-pointer">Urgente / Breaking</Label>
                </div>
              </div>

              {/* Sponsored content section */}
              <div className="pt-4 border-t border-zinc-100">
                <div className="flex items-center gap-2 mb-3">
                  <Switch checked={form.isSponsored || false} onCheckedChange={(v) => setForm({ ...form, isSponsored: v })} id="sponsored" />
                  <Label htmlFor="sponsored" className="cursor-pointer text-sm font-medium">📰 Matéria Patrocinada</Label>
                </div>
                {form.isSponsored && (
                  <div className="space-y-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">
                      Matérias patrocinadas são exclusivas do anunciante e <strong>não participam do sistema aleatório de impressões de anúncios grátis</strong>.
                      Um badge "PATROCINADO" será exibido no artigo.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Nome do patrocinador</Label>
                        <Input
                          value={form.sponsorName || ''}
                          onChange={(e) => setForm({ ...form, sponsorName: e.target.value })}
                          placeholder="Ex: Empresa XYZ"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">URL do patrocinador</Label>
                        <Input
                          value={form.sponsorUrl || ''}
                          onChange={(e) => setForm({ ...form, sponsorUrl: e.target.value })}
                          placeholder="https://..."
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Logo do patrocinador (URL)</Label>
                      <ImageUpload
                        value={form.sponsorLogo || ''}
                        onChange={(url) => setForm({ ...form, sponsorLogo: url })}
                        placeholder="URL do logo ou faça upload"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* AI Generator Modal */}
      <AIGenerator
        open={aiOpen}
        onOpenChange={setAiOpen}
        categories={categories}
        onApply={(article) => {
          setForm({
            ...form,
            title: article.title,
            subtitle: article.subtitle,
            excerpt: article.excerpt,
            content: article.content,
            coverImage: article.coverImage || form.coverImage,
            gallery: article.gallery.length > 0 ? article.gallery : form.gallery,
            customFields: article.customFields.length > 0 ? article.customFields : form.customFields,
            tags: article.tags,
            seoTitle: article.seoTitle,
            seoDescription: article.seoDescription,
            seoKeywords: article.seoKeywords,
            ogImage: article.coverImage || form.ogImage,
            // Auto-select category if matches
            categoryId: (() => {
              const matched = categories.find(c =>
                article.tags.toLowerCase().includes(c.name.toLowerCase()) ||
                c.name.toLowerCase().includes(article.tags.toLowerCase().split(',')[0])
              )
              return matched?.id || form.categoryId
            })(),
          })
          toast({ title: '✨ Matéria aplicada!', description: 'Revise todos os campos antes de publicar.' })
          // Switch to content tab
          setTimeout(() => {
            const tab = document.querySelector('[role=tab][value=content]') as HTMLButtonElement
            if (tab) tab.click()
          }, 100)
        }}
      />
    </div>
  )
}
