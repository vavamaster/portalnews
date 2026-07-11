'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Loader2, Plus, Trash2, RefreshCw, Download, Search, Globe,
  CheckCircle, ExternalLink, FileText, Image as ImageIcon, ChevronLeft, ChevronRight, XCircle, Eye,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { WordPressImportPreview } from './WordPressImportPreview'

export function AdminWordPress() {
  const { toast } = useToast()
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

  useEffect(() => { load() }, [])

  const loadWpPosts = async (p = 1, s = '') => {
    if (!activeConn) return
    setWpLoading(true)
    try {
      const r = await fetch(`/api/admin/wordpress/import?connectionId=${activeConn}&page=${p}&search=${encodeURIComponent(s)}`)
      const d = await r.json()
      if (d.error) { toast({ title: 'Erro', description: d.error, variant: 'destructive' }) }
      else { setWpPosts(d.posts || []); setTotalPages(d.totalPages || 1); setTotalPosts(d.totalPosts || 0); setPage(d.currentPage || 1) }
    } finally { setWpLoading(false) }
  }

  useEffect(() => { if (activeConn) loadWpPosts(1, search) }, [activeConn])

  const connect = async () => {
    if (!form.siteUrl) {
      toast({ title: 'Erro', description: 'Informe a URL do site WordPress', variant: 'destructive' }); return
    }
    const r = await fetch('/api/admin/wordpress', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await r.json()
    if (d.error) { toast({ title: 'Erro', description: d.error, variant: 'destructive' }) }
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
      if (d.error) { toast({ title: 'Erro', description: d.error, variant: 'destructive' }) }
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

  if (loading) return <div className="text-zinc-500 flex items-center gap-2 py-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>

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
                {c.lastSyncAt && <><span>·</span><span>Última sync: {new Date(c.lastSyncAt).toLocaleString('pt-BR')}</span></>}
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

      {/* WordPress posts browser */}
      {activeConn && (
        <div className="space-y-2">
          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
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
          </div>

          {/* Posts list */}
          {wpLoading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : wpPosts.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Nenhuma matéria encontrada.</div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-zinc-500">{totalPosts} matérias encontradas · página {page} de {totalPages}</div>
              {wpPosts.map(p => (
                <div key={p.id} className={cn('bg-white border rounded-lg p-3 flex gap-3', p.isImported ? 'border-emerald-200 bg-emerald-50/30' : 'border-zinc-200')}>
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
                      <span>{new Date(p.date).toLocaleDateString('pt-BR')}</span>
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
                <span className="text-[9px] text-zinc-400">{new Date(l.createdAt).toLocaleString('pt-BR')}</span>
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
