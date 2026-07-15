'use client'

import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatDate } from '@/lib/utils'
import {
  Loader2, Plus, Trash2, RefreshCw, Download, Search, Globe,
  CheckCircle, ExternalLink, FileText, Image as ImageIcon, ChevronLeft, ChevronRight, XCircle, Eye,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { WordPressImportPreview } from './WordPressImportPreview'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { useApiError } from '@/hooks/use-api-error'

export function AdminWordPress() {
  const { toast } = useToast()
  const apiError = useApiError()
  const [connections, setConnections] = useState<any[]>([])
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeConn, setActiveConn] = useState<string | null>(null)
  const [wpPosts, setWpPosts] = useState<any[]>([])
  const [wpLoading, setWpLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalPosts, setTotalPosts] = useState(0)
  const [importing, setImporting] = useState<number | null>(null)
  const [showConnect, setShowConnect] = useState(false)
  const [form, setForm] = useState({ siteUrl: '', username: '', appPassword: '' })
  const [categories, setCategories] = useState<any[]>([])
  const [previewPost, setPreviewPost] = useState<any | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState<string>('all')
  const [bulkTargetCategory, setBulkTargetCategory] = useState<string>('')
  const [bulkPublish, setBulkPublish] = useState(false)
  const [bulkImporting, setBulkImporting] = useState(false)
  const [showBulkConfig, setShowBulkConfig] = useState(false)

  // Category stats state — WP categories with post counts
  const [wpCategoryStats, setWpCategoryStats] = useState<any[]>([])
  const [wpStatsLoading, setWpStatsLoading] = useState(false)

  // Auto-import all state
  const [autoImportOpen, setAutoImportOpen] = useState(false)
  const [autoImportCategory, setAutoImportCategory] = useState('')
  const [autoImportPublish, setAutoImportPublish] = useState(false)
  const [autoImportMax, setAutoImportMax] = useState(100)
  const [autoCreateCats, setAutoCreateCats] = useState(true)
  const [autoImporting, setAutoImporting] = useState(false)
  const [autoImportResult, setAutoImportResult] = useState<any>(null)

  // Per-post category mapping for bulk import (wpPostId → portal categoryId)
  const [perPostCategories, setPerPostCategories] = useState<Record<number, string>>({})

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/wordpress')
      const d = await r.json()
      setConnections(d.connections || [])
      setRecentLogs(d.recentLogs || [])
      if (d.connections?.[0]) setActiveConn(d.connections[0].id)
    } finally { setLoading(false) }
    // Load portal categories for the preview modal
    try {
      const cr = await fetch('/api/categories')
      const cd = await cr.json()
      setCategories(cd.categories || [])
    } catch {}
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const loadWpPosts = async (p = 1, s = '') => {
    if (!activeConn) return
    setWpLoading(true)
    try {
      const r = await fetch(`/api/admin/wordpress/import?connectionId=${activeConn}&page=${p}&search=${encodeURIComponent(s)}`)
      const d = await r.json()
      if (d.error) { apiError(d.error) }
      else { setWpPosts(d.posts || []); setTotalPages(d.totalPages || 1); setTotalPosts(d.totalPosts || 0); setPage(d.currentPage || 1) }
    } finally { setWpLoading(false) }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (activeConn) loadWpPosts(1, search)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeConn])

  // Load WordPress category stats (post counts per category)
  const loadWpCategoryStats = async () => {
    if (!activeConn) return
    setWpStatsLoading(true)
    try {
      const r = await fetch(`/api/admin/wordpress/categories?connectionId=${activeConn}`)
      const d = await r.json()
      setWpCategoryStats(d.categories || [])
    } catch {} finally { setWpStatsLoading(false) }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (activeConn) loadWpCategoryStats()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeConn])

  // Auto-import ALL posts from WordPress
  const handleAutoImport = async () => {
    if (!activeConn) return
    setAutoImporting(true)
    setAutoImportResult(null)
    try {
      const r = await fetch('/api/admin/wordpress/import/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: activeConn,
          categoryId: autoImportCategory || undefined,
          publish: autoImportPublish,
          maxPosts: autoImportMax,
          autoCreateCategories: autoCreateCats,
        }),
      })
      const d = await r.json()
      if (d.error) {
        apiError(d.error)
      } else {
        setAutoImportResult(d.summary)
        toast({
          title: '✓ Importação automática concluída!',
          description: `${d.summary.imported} importadas · ${d.summary.skipped} puladas · ${d.summary.failed} falhadas`,
        })
        loadWpPosts(1, search)
        loadWpCategoryStats()
      }
    } catch (e: any) {
      apiError(e.message)
    } finally {
      setAutoImporting(false)
    }
  }

  const connect = async () => {
    if (!form.siteUrl) {
      toast({ title: 'Erro', description: 'Informe a URL do site WordPress', variant: 'destructive' }); return
    }
    const r = await fetch('/api/admin/wordpress', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await r.json()
    if (d.error) { apiError(d.error) }
    else {
      const modeMsg = d.mode === 'readonly'
        ? 'Conectado em modo somente leitura (sem credenciais)'
        : `Conectado como: ${d.wpUser?.name || ''}`
      toast({ title: '✓ Conectado!', description: modeMsg })
      setShowConnect(false); setForm({ siteUrl: '', username: '', appPassword: '' }); load()
    }
  }

  const removeConn = async (id: string) => {
    if (!confirm('Remover esta conexão?')) return
    await fetch(`/api/admin/wordpress?id=${id}`, { method: 'DELETE' })
    toast({ title: 'Conexão removida' }); load()
  }

  // Open preview modal — user reviews data before confirming
  const openPreview = (wpPost: any) => {
    setPreviewPost(wpPost)
    setPreviewOpen(true)
  }

  // Bulk selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    const visiblePosts = filteredPosts
    const allSelected = visiblePosts.every(p => selectedIds.has(p.id))
    if (allSelected) {
      // Deselect only visible
      setSelectedIds(prev => {
        const next = new Set(prev)
        visiblePosts.forEach(p => next.delete(p.id))
        return next
      })
    } else {
      // Select all visible
      setSelectedIds(prev => {
        const next = new Set(prev)
        visiblePosts.forEach(p => next.add(p.id))
        return next
      })
    }
  }

  const clearSelection = () => setSelectedIds(new Set())

  // Filter posts by WP category for bulk selection
  const filteredPosts = bulkCategoryFilter === 'all'
    ? wpPosts
    : wpPosts.filter(p => p.categories?.includes(bulkCategoryFilter))

  // Get all unique WP categories from current page
  const wpCategories = useMemo(() => {
    const set = new Set<string>()
    wpPosts.forEach(p => p.categories?.forEach((c: string) => set.add(c)))
    return Array.from(set).sort()
  }, [wpPosts])

  // Bulk import — sends all selected posts to /api/admin/wordpress/import/bulk
  const handleBulkImport = async () => {
    if (selectedIds.size === 0 || !activeConn) return
    if (!bulkTargetCategory) {
      toast({ title: 'Selecione a categoria destino', description: 'Escolha para qual categoria do portal as matérias serão importadas.', variant: 'destructive' })
      return
    }

    setBulkImporting(true)
    try {
      const selectedPosts = wpPosts.filter(p => selectedIds.has(p.id))
      const items = selectedPosts.map(p => ({
        wpPostId: p.id,
        title: p.title,
        content: p.content,
        excerpt: p.excerpt,
        featuredImage: p.featuredImage,
        categories: p.categories,
        author: p.author,
        slug: p.slug,
        // Use per-post category if set, otherwise use global bulkTargetCategory
        categoryId: perPostCategories[p.id] || bulkTargetCategory,
        tags: p.categories.join(', '),
        publish: bulkPublish,
      }))

      const r = await fetch('/api/admin/wordpress/import/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: activeConn, items }),
      })
      const d = await r.json()
      if (d.error) {
        apiError(d.error)
      } else {
        toast({
          title: '✓ Importação em massa concluída!',
          description: `${d.summary.imported} importadas · ${d.summary.skipped} puladas · ${d.summary.failed} falhadas`,
        })
        setShowBulkConfig(false)
        setSelectedIds(new Set())
        loadWpPosts(page, search)
      }
    } catch (e: any) {
      apiError(e.message)
    } finally {
      setBulkImporting(false)
    }
  }

  // Actual import — called from preview modal after user confirms
  const importPost = async (overrides: { categoryId: string; status: 'DRAFT' | 'PUBLISHED'; tags: string }) => {
    if (!previewPost || !activeConn) return
    setImporting(previewPost.id)
    try {
      const r = await fetch('/api/admin/wordpress/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: activeConn,
          wpPostId: previewPost.id,
          title: previewPost.title,
          content: previewPost.content,
          excerpt: previewPost.excerpt,
          featuredImage: previewPost.featuredImage,
          categories: previewPost.categories,
          author: previewPost.author,
          slug: previewPost.slug,
          categorySlug: categories.find(c => c.id === overrides.categoryId)?.slug,
          tags: overrides.tags,
          publish: overrides.status === 'PUBLISHED',
        }),
      })
      const d = await r.json()
      if (d.error) { apiError(d.error) }
      else {
        toast({
          title: '✓ Matéria importada!',
          description: overrides.status === 'PUBLISHED'
            ? 'Publicada no portal'
            : 'Salva como rascunho',
        })
        setPreviewOpen(false)
        setPreviewPost(null)
        loadWpPosts(page, search)
      }
    } finally { setImporting(null) }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
      </div>

      {/* Connections */}
      {connections.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <Globe className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
          Nenhuma conexão WordPress. Conecte seu site.
        </div>
      ) : (
        connections.map(c => (
          <div key={c.id} className={cn('bg-white border rounded-lg p-3 flex items-center gap-3', activeConn === c.id ? 'border-primary' : 'border-zinc-200')}>
            <div className={cn('h-2.5 w-2.5 rounded-full', c.isActive ? 'bg-emerald-500' : 'bg-zinc-300')} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-zinc-900 truncate">{c.siteUrl}</div>
              <div className="text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
                {c.username ? (
                  <><span>Usuário: {c.username}</span></>
                ) : (
                  <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">Somente leitura</Badge>
                )}
                {c.lastSyncAt && <><span>·</span><span>Última sync: {formatDate(c.lastSyncAt, 'datetime')}</span></>}
              </div>
            </div>
            <Button size="sm" variant={activeConn === c.id ? 'default' : 'outline'} onClick={() => setActiveConn(c.id)} className="h-7 text-xs">
              {activeConn === c.id ? 'Selecionado' : 'Selecionar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => removeConn(c.id)} className="h-7 w-7 p-0 text-red-600"><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))
      )}

      {/* Connect form */}
      {showConnect ? (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-3">
          <div>
            <Label className="text-xs font-bold">Nova conexão WordPress</Label>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Para sites públicos, basta informar a URL. Para sites privados ou com firewall, informe usuário + senha de aplicativo.
            </p>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">URL do site *</Label>
            <Input placeholder="https://meusite.com" value={form.siteUrl} onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} className="h-8 text-xs mt-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Usuário (opcional)</Label>
              <Input placeholder="usuario_wp" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Application Password (opcional)</Label>
              <Input type="password" placeholder="xxxx xxxx xxxx xxxx" value={form.appPassword} onChange={(e) => setForm({ ...form, appPassword: e.target.value })} className="h-8 text-xs mt-1" />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px] text-blue-900">
            <strong>Como criar Application Password:</strong> WordPress Admin → Usuários → Perfil → Application Passwords → Adicionar nova.
            <br />
            <strong>WAF/Firewall:</strong> Se você receber erro 403 mesmo com credenciais corretas, o firewall do site pode estar bloqueando o header <code className="bg-blue-100 px-1 rounded">Authorization</code>. Nesse caso, o sistema tentará modo somente leitura (sem auth).
          </div>
          <div className="flex gap-2">
            <Button onClick={connect} className="bg-primary h-8 text-xs">Conectar</Button>
            <Button variant="outline" onClick={() => setShowConnect(false)} className="h-8 text-xs">Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setShowConnect(true)} variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" /> Nova conexão</Button>
      )}

      {/* === Category Summary Cards + Auto-Import === */}
      {activeConn && (
        <div className="space-y-3">
          {/* Category chips with post counts */}
          {wpStatsLoading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400 py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando categorias...</div>
          ) : wpCategoryStats.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Categorias do WordPress</div>
                <Badge variant="outline" className="text-[9px]">{wpCategoryStats.reduce((s, c) => s + c.postCount, 0)} matérias</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {wpCategoryStats.map(cat => (
                  <button
                    key={cat.wpId}
                    onClick={() => setBulkCategoryFilter(bulkCategoryFilter === cat.name ? 'all' : cat.name)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-all',
                      bulkCategoryFilter === cat.name
                        ? 'bg-primary text-white border-primary'
                        : cat.mappedTo
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : cat.autoMatch
                            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                    )}
                    title={cat.mappedTo ? `Mapeada para: ${cat.mappedTo.name}` : cat.autoMatch ? `Auto-match: ${cat.autoMatch.name}` : cat.needsMapping ? 'Precisa de mapeamento' : ''}
                  >
                    <span className="font-medium">{cat.name}</span>
                    <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', bulkCategoryFilter === cat.name ? 'bg-white/20' : 'bg-white/60')}>{cat.postCount}</span>
                    {cat.mappedTo && <span className="text-[8px]">→ {cat.mappedTo.name}</span>}
                    {cat.needsMapping && <span className="text-[8px]">⚠ nova</span>}
                  </button>
                ))}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-3 mt-2 text-[9px] text-zinc-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Mapeada</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Auto-match</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Precisa mapear</span>
              </div>
            </div>
          )}

          {/* Auto-import all button */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAutoImportOpen(!autoImportOpen)}
              className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-blue-100"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Importar tudo automaticamente
            </Button>
            {autoImportResult && (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                Última: {autoImportResult.imported} importadas · {autoImportResult.skipped} puladas · {autoImportResult.failed} falhas
              </Badge>
            )}
          </div>

          {/* Auto-import panel */}
          {autoImportOpen && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-purple-900">Importação automática</div>
                <Button variant="ghost" size="sm" onClick={() => setAutoImportOpen(false)} className="h-7 text-xs">Fechar</Button>
              </div>
              <p className="text-xs text-purple-700">
                Importa todas as matérias do WordPress automaticamente. Categorias não mapeadas serão criadas automaticamente como novas no portal.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Categoria destino (opcional)</Label>
                  <p className="text-[10px] text-zinc-400 mb-1">Deixe vazio para auto-detectar/criar por matéria</p>
                  <select
                    value={autoImportCategory}
                    onChange={(e) => setAutoImportCategory(e.target.value)}
                    className="w-full h-9 text-sm rounded-md border border-zinc-200 px-2 bg-white"
                  >
                    <option value="">Auto-detectar / criar</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Máximo de matérias</Label>
                  <Input
                    type="number"
                    value={autoImportMax}
                    onChange={(e) => setAutoImportMax(parseInt(e.target.value) || 100)}
                    className="mt-1"
                    min={1}
                    max={500}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={autoCreateCats} onChange={(e) => setAutoCreateCats(e.target.checked)} className="h-4 w-4 rounded" />
                  Criar categorias inexistentes automaticamente
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" checked={!autoImportPublish} onChange={() => setAutoImportPublish(false)} className="h-4 w-4" />
                  Rascunho
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" checked={autoImportPublish} onChange={() => setAutoImportPublish(true)} className="h-4 w-4" />
                  Publicar
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-purple-100">
                <Button variant="outline" size="sm" onClick={() => setAutoImportOpen(false)} className="h-8">Cancelar</Button>
                <Button size="sm" onClick={handleAutoImport} disabled={autoImporting} className="h-8 bg-purple-600 hover:bg-purple-700">
                  {autoImporting ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Importando até {autoImportMax} matérias...</>
                  ) : (
                    <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Iniciar importação automática</>
                  )}
                </Button>
              </div>
              {autoImportResult && (
                <div className="bg-white rounded-lg p-3 border border-purple-100">
                  <div className="text-xs font-semibold text-zinc-900 mb-2">Resultado da última importação:</div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center"><div className="text-lg font-bold text-emerald-600">{autoImportResult.imported}</div><div className="text-[10px] text-zinc-500">Importadas</div></div>
                    <div className="text-center"><div className="text-lg font-bold text-amber-600">{autoImportResult.skipped}</div><div className="text-[10px] text-zinc-500">Puladas</div></div>
                    <div className="text-center"><div className="text-lg font-bold text-red-600">{autoImportResult.failed}</div><div className="text-[10px] text-zinc-500">Falhas</div></div>
                    <div className="text-center"><div className="text-lg font-bold text-blue-600">{autoImportResult.pagesScanned}</div><div className="text-[10px] text-zinc-500">Páginas</div></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* WordPress posts browser */}
      {activeConn && (
        <div className="space-y-3">
          {/* Search + filter bar */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadWpPosts(1, search)}
                placeholder="Buscar matérias no WordPress..."
                className="h-8 text-xs pl-7"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => loadWpPosts(1, search)} className="h-8"><Search className="h-3.5 w-3.5" /></Button>
            {/* Filter by WP category */}
            <select
              value={bulkCategoryFilter}
              onChange={(e) => setBulkCategoryFilter(e.target.value)}
              className="h-8 text-xs rounded-md border border-zinc-200 px-2 bg-white"
            >
              <option value="all">Todas as categorias WP</option>
              {wpCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Bulk selection toolbar */}
          {wpPosts.length > 0 && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filteredPosts.length > 0 && filteredPosts.every(p => selectedIds.has(p.id))}
                    onChange={selectAllVisible}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <span className="font-medium">Selecionar todos ({filteredPosts.length})</span>
                </label>
                {selectedIds.size > 0 && (
                  <>
                    <Badge className="bg-primary text-white text-[10px]">{selectedIds.size} selecionada(s)</Badge>
                    <button onClick={clearSelection} className="text-[11px] text-zinc-500 hover:text-red-600">Limpar seleção</button>
                  </>
                )}
              </div>
              {selectedIds.size > 0 && (
                <Button size="sm" onClick={() => setShowBulkConfig(true)} className="h-7 text-xs bg-primary">
                  <Download className="h-3 w-3 mr-1" /> Importar {selectedIds.size} em massa
                </Button>
              )}
            </div>
          )}

          {/* Bulk configuration panel */}
          {showBulkConfig && selectedIds.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-blue-900">Configuração de importação em massa</div>
                <Button variant="ghost" size="sm" onClick={() => setShowBulkConfig(false)} className="h-7 text-xs">Cancelar</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Categoria destino no portal</Label>
                  <select
                    value={bulkTargetCategory}
                    onChange={(e) => setBulkTargetCategory(e.target.value)}
                    className="mt-1 w-full h-9 text-sm rounded-md border border-zinc-200 px-2 bg-white"
                  >
                    <option value="">Selecione...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="text-[10px] text-zinc-500 mt-1">Todas as {selectedIds.size} matérias serão importadas para esta categoria.</p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Status</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        checked={!bulkPublish}
                        onChange={() => setBulkPublish(false)}
                        className="h-4 w-4"
                      />
                      Rascunho
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        checked={bulkPublish}
                        onChange={() => setBulkPublish(true)}
                        className="h-4 w-4"
                      />
                      Publicar
                    </label>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">{bulkPublish ? 'Serão visíveis no portal imediatamente.' : 'Ficarão como rascunho para revisão.'}</p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="text-xs font-semibold text-zinc-900 mb-2">Resumo da importação:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <div className="text-zinc-500">Total selecionado</div>
                    <div className="font-bold text-zinc-900">{selectedIds.size}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Já importadas</div>
                    <div className="font-bold text-amber-600">{wpPosts.filter(p => selectedIds.has(p.id) && p.isImported).length}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">A importar</div>
                    <div className="font-bold text-emerald-600">{wpPosts.filter(p => selectedIds.has(p.id) && !p.isImported).length}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Status</div>
                    <div className="font-bold text-blue-600">{bulkPublish ? 'Publicar' : 'Rascunho'}</div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-blue-100">
                <Button variant="outline" size="sm" onClick={() => setShowBulkConfig(false)} className="h-8">Cancelar</Button>
                <Button size="sm" onClick={handleBulkImport} disabled={bulkImporting || !bulkTargetCategory} className="h-8 bg-emerald-600 hover:bg-emerald-700">
                  {bulkImporting ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Importando...</>
                  ) : (
                    <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Confirmar Importação de {selectedIds.size} matérias</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Posts list */}
          {wpLoading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : wpPosts.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Nenhuma matéria encontrada.</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Nenhuma matéria na categoria "{bulkCategoryFilter}".</div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-zinc-500 flex items-center justify-between">
                <span>{totalPosts} matérias encontradas · página {page} de {totalPages}</span>
                {bulkCategoryFilter !== 'all' && <Badge variant="outline" className="text-[9px]">Filtro: {bulkCategoryFilter} ({filteredPosts.length})</Badge>}
              </div>
              {filteredPosts.map(p => (
                <div
                  key={p.id}
                  className={cn(
                    'bg-white border rounded-lg p-3 flex gap-3 transition-all',
                    p.isImported ? 'border-emerald-200 bg-emerald-50/30' : 'border-zinc-200',
                    selectedIds.has(p.id) && 'ring-2 ring-primary border-primary'
                  )}
                >
                  {/* Checkbox for bulk selection */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="h-4 w-4 mt-1 rounded border-zinc-300 flex-shrink-0"
                  />

                  {/* Featured image thumbnail */}
                  {p.featuredImage ? (
                    <img src={p.featuredImage} alt="" className="h-16 w-24 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="h-16 w-24 bg-zinc-100 rounded flex items-center justify-center flex-shrink-0"><ImageIcon className="h-5 w-5 text-zinc-300" /></div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                      <span className="font-medium text-sm text-zinc-900 line-clamp-1">{p.title}</span>
                      {p.isImported && <Badge className="text-[9px] bg-emerald-100 text-emerald-700">Importado</Badge>}
                    </div>
                    <div className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{p.excerpt}</div>
                    <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{formatDate(p.date, 'short')}</span>
                      <span>·</span>
                      <span>{p.author}</span>
                      {p.categories.length > 0 && <><span>·</span><span>{p.categories.join(', ')}</span></>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {p.isImported ? (
                      <Badge variant="outline" className="text-[9px] bg-emerald-50"><CheckCircle className="h-3 w-3 mr-1" /> Importado</Badge>
                    ) : (
                      <Button size="sm" onClick={() => openPreview(p)} className="h-7 text-xs bg-primary">
                        <Eye className="h-3 w-3 mr-1" />
                        Pré-visualizar
                      </Button>
                    )}
                    <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 justify-center">
                      <ExternalLink className="h-2.5 w-2.5" /> Ver original
                    </a>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => loadWpPosts(page - 1, search)} className="h-7 text-xs">
                  <ChevronLeft className="h-3 w-3 mr-1" /> Anterior
                </Button>
                <span className="text-xs text-zinc-500">{page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => loadWpPosts(page + 1, search)} className="h-7 text-xs">
                  Próxima <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import history */}
      {recentLogs.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-lg p-3">
          <Label className="text-xs font-bold mb-2 block">Importações recentes ({recentLogs.length})</Label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {recentLogs.map(l => (
              <div key={l.id} className="flex items-center gap-2 text-xs border border-zinc-100 rounded p-2">
                {l.status === 'IMPORTED' ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                <span className="flex-1 truncate text-zinc-700">{l.title}</span>
                <Badge variant="outline" className="text-[9px]">{l.status}</Badge>
                <span className="text-[9px] text-zinc-400">{formatDate(l.createdAt, 'datetime')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === Preview Modal — review all data before importing === */}
      <WordPressImportPreview
        post={previewPost}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        categories={categories}
        connectionId={activeConn}
        onCategoriesChanged={load}
        onConfirm={importPost}
        importing={importing !== null}
      />
    </div>
  )
}
