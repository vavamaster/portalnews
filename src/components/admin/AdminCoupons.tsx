'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
<<<<<<< HEAD
import { cn } from '@/lib/utils'
=======
import { cn, formatDate } from '@/lib/utils'
>>>>>>> 005f2b6696919b4e97f780cf36cf435993d447e1
import { Save, Plus, Trash2, Edit, Tag, RefreshCw, XCircle, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { useApiError } from '@/hooks/use-api-error'

export function AdminCoupons() {
  const { toast } = useToast()
  const apiError = useApiError()
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>({
    code: '', type: 'PERCENT', value: 10, minAmountCents: 0, maxRedemptions: -1,
    validFrom: '', validUntil: '', isActive: true, description: '', appliesTo: 'SUBSCRIPTION', firstTimeOnly: false,
  })

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/coupons')
      const d = await r.json()
      setCoupons(d.coupons || [])
    } finally { setLoading(false) }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const save = async () => {
    if (!form.code.trim()) { toast({ title: 'Erro', description: 'Código é obrigatório', variant: 'destructive' }); return }
    const r = await fetch('/api/admin/coupons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await r.json()
    if (d.error) { apiError(d.error) }
    else { toast({ title: '✓ Cupom criado' }); setCreating(false); setForm({ code: '', type: 'PERCENT', value: 10, minAmountCents: 0, maxRedemptions: -1, validFrom: '', validUntil: '', isActive: true, description: '', appliesTo: 'SUBSCRIPTION', firstTimeOnly: false }); load() }
  }

  const update = async (id: string) => {
    const r = await fetch(`/api/admin/coupons/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    if (d.error) { apiError(d.error) }
    else { toast({ title: '✓ Cupom atualizado' }); setEditingId(null); load() }
  }

  const remove = async (id: string, code: string) => {
    if (!confirm(`Excluir cupom "${code}"?`)) return
    await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
    toast({ title: 'Cupom excluído' }); load()
  }

  const startEdit = (c: any) => {
    setEditingId(c.id)
    setForm({
      code: c.code, type: c.type, value: c.value, minAmountCents: c.minAmountCents,
      maxRedemptions: c.maxRedemptions, validFrom: c.validFrom ? new Date(c.validFrom).toISOString().split('T')[0] : '',
      validUntil: c.validUntil ? new Date(c.validUntil).toISOString().split('T')[0] : '',
      isActive: c.isActive, description: c.description || '', appliesTo: c.appliesTo, firstTimeOnly: c.firstTimeOnly,
    })
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
      </div>

      {coupons.length === 0 && !creating && (
        <div className="text-center py-8 text-zinc-500">
          <Tag className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
          Nenhum cupom. Crie o primeiro.
        </div>
      )}

      {coupons.map(c => (
        <div key={c.id} className="bg-white border border-zinc-200 rounded-lg p-3">
          {editingId === c.id ? (
            <CouponForm form={form} setForm={setForm} onSave={() => update(c.id)} onCancel={() => setEditingId(null)} />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono font-bold bg-zinc-100 px-2 py-0.5 rounded">{c.code}</code>
                  <Badge variant="outline" className="text-[10px]">{c.type === 'PERCENT' ? `${c.value}%` : `R$ ${(c.value / 100).toFixed(2)}`}</Badge>
                  <Badge variant="outline" className="text-[10px]">{c.appliesTo}</Badge>
                  {c.isActive ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-zinc-400" />}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {c.description || 'Sem descrição'} · {c._count?.redemptions || 0} resgates
                  {c.maxRedemptions > 0 && ` / ${c.maxRedemptions}`}
                  {c.validUntil && ` · até ${formatDate(c.validUntil, 'short')}`}
                  {c.firstTimeOnly && ' · só 1ª vez'}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startEdit(c)} className="h-7 w-7 p-0"><Edit className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id, c.code)} className="h-7 w-7 p-0 text-red-600"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {creating ? (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
          <CouponForm form={form} setForm={setForm} onSave={save} onCancel={() => setCreating(false)} />
        </div>
      ) : (
        <Button onClick={() => setCreating(true)} variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" /> Novo cupom</Button>
      )}
    </div>
  )
}

function CouponForm({ form, setForm, onSave, onCancel }: any) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Código</Label>
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="BEMVINDO10" className="h-8 text-xs font-mono" />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="PERCENT">Percentual (%)</SelectItem><SelectItem value="FIXED">Valor fixo (R$)</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">{form.type === 'PERCENT' ? 'Desconto (%)' : 'Valor (R$)'}</Label>
          <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">Máx. resgates (-1=inf)</Label>
          <Input type="number" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: parseInt(e.target.value) || -1 })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">Aplica a</Label>
          <Select value={form.appliesTo} onValueChange={v => setForm({ ...form, appliesTo: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="SUBSCRIPTION">Assinaturas</SelectItem><SelectItem value="BOOST">Boost</SelectItem><SelectItem value="ALL">Tudo</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Válido de</Label><Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Válido até</Label><Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="h-8 text-xs" /></div>
      </div>
      <Input placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-8 text-xs" />
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs"><Switch checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v })} /> Ativo</label>
        <label className="flex items-center gap-1.5 text-xs"><Switch checked={form.firstTimeOnly} onCheckedChange={v => setForm({ ...form, firstTimeOnly: v })} /> Só 1ª vez</label>
      </div>
      <div className="flex gap-2">
        <Button onClick={onSave} className="bg-primary h-8 text-xs"><Save className="h-3 w-3 mr-1" /> Salvar</Button>
        <Button variant="outline" onClick={onCancel} className="h-8 text-xs">Cancelar</Button>
      </div>
    </div>
  )
}
