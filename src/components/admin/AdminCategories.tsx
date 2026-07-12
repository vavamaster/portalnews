'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { notifyPortalUpdate } from '@/lib/portal-sync'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const COLORS = ['rose', 'red', 'emerald', 'amber', 'purple', 'sky', 'teal', 'lime', 'indigo', 'slate']

export function AdminCategories() {
  const { toast } = useToast()
  const [cats, setCats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [open, setOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      setCats(data.categories || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Categoria removida' }); notifyPortalUpdate('categories')
      load()
    } else {
      const data = await res.json()
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">{cats.length} categoria(s)</div>
        <Button onClick={() => { setEditing(null); setOpen(true) }} className="bg-primary">
          <Plus className="h-4 w-4 mr-2" /> Nova Categoria
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8 text-zinc-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {cats.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3 hover:bg-zinc-50">
                  <div className={`h-3 w-3 rounded-full bg-${c.color || 'slate'}-500`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-zinc-900">{c.name}</div>
                    <div className="text-xs text-zinc-500">/{c.slug} · {c._count?.posts || 0} posts</div>
                    {c.description && <div className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{c.description}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true) }} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                          <AlertDialogDescription>Posts dessa categoria podem ficar sem categoria.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          {open && (
            <CategoryForm
              key={editing?.id || 'new'}
              category={editing}
              onSaved={() => { setOpen(false); load() }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CategoryForm({ category, onSaved }: { category: any; onSaved: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState<any>(() => category ? {
    name: category.name, slug: category.slug, description: category.description || '',
    color: category.color || 'slate', icon: category.icon || 'Newspaper',
  } : { name: '', slug: '', description: '', color: 'slate', icon: 'Newspaper' })

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      toast({ title: 'Nome e slug obrigatórios', variant: 'destructive' })
      return
    }
    const url = category ? `/api/categories` : '/api/categories'
    const method = category ? 'PUT' : 'POST'
    const body = category ? { id: category.id, ...form } : form
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.error) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    } else {
      toast({ title: category ? 'Categoria atualizada!' : 'Categoria criada!' }); notifyPortalUpdate('categories')
      onSaved()
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm">Nome *</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="Ex: Política" />
      </div>
      <div>
        <Label className="text-sm">Slug *</Label>
        <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="mt-1" placeholder="Ex: politica" />
      </div>
      <div>
        <Label className="text-sm">Descrição</Label>
        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-sm">Cor</Label>
          <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COLORS.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className={`inline-block h-2 w-2 rounded-full bg-${c}-500 mr-2`} />
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Ícone (nome lucide)</Label>
          <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="mt-1" placeholder="Newspaper" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-3">
        <Button onClick={handleSave} className="bg-primary">Salvar</Button>
      </div>
    </div>
  )
}
