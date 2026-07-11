'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Pencil, Trash2, Eye, EyeOff, Loader2, Flame, Wand2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function AdminPosts() {
  const { setView } = useAppStore()
  const { toast } = useToast()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/posts?limit=100&admin=true')
      const data = await res.json()
      setPosts(data.posts || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Notícia excluída!' })
      load()
    } else {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  const togglePublish = async (post: any) => {
    const newStatus = post.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      toast({ title: newStatus === 'PUBLISHED' ? 'Notícia publicada!' : 'Notícia despublicada' })
      load()
    } else {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  const filtered = posts.filter(p => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título..."
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos status</SelectItem>
              <SelectItem value="PUBLISHED">Publicados</SelectItem>
              <SelectItem value="DRAFT">Rascunhos</SelectItem>
              <SelectItem value="SCHEDULED">Agendados</SelectItem>
              <SelectItem value="ARCHIVED">Arquivados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setView({ name: 'admin', section: 'editor' })}
            className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-blue-100"
          >
            <Wand2 className="h-4 w-4 mr-2" /> Gerar com IA
          </Button>
          <Button onClick={() => setView({ name: 'admin', section: 'editor' })} className="bg-primary">
            <Plus className="h-4 w-4 mr-2" /> Nova Notícia
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8 text-zinc-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhuma notícia encontrada
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {filtered.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 hover:bg-zinc-50">
                  <div className="w-16 h-16 rounded bg-zinc-100 overflow-hidden flex-shrink-0">
                    {p.coverImage && <img src={p.coverImage} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm text-zinc-900 line-clamp-1">{p.title}</div>
                      {p.breaking && <Flame className="h-3 w-3 text-primary flex-shrink-0" />}
                      {p.featured && <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">DESTAQUE</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${p.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {p.status === 'PUBLISHED' ? 'PUBLICADO' : p.status === 'DRAFT' ? 'RASCUNHO' : p.status === 'PENDING' ? 'PENDENTE' : p.status === 'REJECTED' ? 'REJEITADO' : p.status === 'SCHEDULED' ? 'AGENDADO' : p.status === 'ARCHIVED' ? 'ARQUIVADO' : p.status}
                      </span>
                      <span>{p.category?.name}</span>
                      <span>·</span>
                      <span>{p.author?.name}</span>
                      <span>·</span>
                      <span>{new Date(p.createdAt).toLocaleDateString('pt-BR')}</span>
                      <span>·</span>
                      <span>{p.views} views</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => togglePublish(p)} title={p.status === 'PUBLISHED' ? 'Despublicar' : 'Publicar'}>
                      {p.status === 'PUBLISHED' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setView({ name: 'admin', section: 'editor', postId: p.id })} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50" title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir notícia?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A notícia "{p.title}" será permanentemente excluída.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-red-600 hover:bg-red-700">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
