'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus, Pencil, Trash2, Loader2, ShieldCheck, Crown, UserCog, User as UserIcon,
  Award, Coins, Mail, Lock, Eye, EyeOff, Save, KeyRound, AlertCircle, Search,
  BadgeCheck, Clock, XCircle, FileText, ShoppingBag, CreditCard, Megaphone,
  Sparkles, RefreshCw, X, Check, ChevronRight,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ImageUpload } from './ImageUpload'

const ROLES = [
  { value: 'MASTER', label: 'Master (super Admin)', short: 'Master', icon: Crown, color: 'purple' },
  { value: 'ADMIN', label: 'Administrador', short: 'Admin', icon: ShieldCheck, color: 'amber' },
  { value: 'EDITOR', label: 'Editor', short: 'Editor', icon: UserCog, color: 'blue' },
  { value: 'READER', label: 'Leitor', short: 'Leitor', icon: UserIcon, color: 'zinc' },
]

const VERIFICATION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  NONE: { label: 'Não verificada', color: 'zinc', icon: XCircle },
  PENDING: { label: 'Pendente', color: 'amber', icon: Clock },
  VERIFIED: { label: 'Verificada', color: 'emerald', icon: BadgeCheck },
  REJECTED: { label: 'Rejeitada', color: 'red', icon: XCircle },
}

function formatDocument(doc: string | null | undefined, type: string | null | undefined) {
  if (!doc) return ''
  const d = doc.replace(/\D/g, '')
  if (type === 'CPF') return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (type === 'CNPJ') return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return d
}

export function AdminUsers() {
  const { toast } = useToast()
  const { user: currentUser, setView } = useAppStore()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [verifFilter, setVerifFilter] = useState('ALL')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setUsers(data.users || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let list = users
    if (roleFilter !== 'ALL') list = list.filter(u => u.role === roleFilter)
    if (verifFilter !== 'ALL') list = list.filter(u => (u.verificationStatus || 'NONE') === verifFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    }
    return list
  }, [users, search, roleFilter, verifFilter])

  const stats = useMemo(() => {
    const byRole: Record<string, number> = {}
    let pendingVerif = 0
    let verified = 0
    users.forEach(u => {
      byRole[u.role] = (byRole[u.role] || 0) + 1
      if (u.verificationStatus === 'PENDING') pendingVerif++
      if (u.verificationStatus === 'VERIFIED') verified++
    })
    return { byRole, total: users.length, pendingVerif, verified }
  }, [users])

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Usuário removido' })
      load()
    } else {
      const data = await res.json()
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          <strong className="text-zinc-900">{stats.total}</strong> usuário(s) cadastrado(s)
        </p>
        {currentUser?.role === 'MASTER' && (
          <Button onClick={() => setNewOpen(true)} className="bg-primary">
            <Plus className="h-4 w-4 mr-2" /> Novo Usuário
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <MiniStat label="Total" value={stats.total} icon={UserIcon} color="zinc" />
        <MiniStat label="Masters" value={stats.byRole.MASTER || 0} icon={Crown} color="purple" />
        <MiniStat label="Admins" value={stats.byRole.ADMIN || 0} icon={ShieldCheck} color="amber" />
        <MiniStat label="Editores" value={stats.byRole.EDITOR || 0} icon={UserCog} color="blue" />
        <MiniStat label="Verificados" value={stats.verified} icon={BadgeCheck} color="emerald" />
        <MiniStat label="Verif. pend." value={stats.pendingVerif} icon={Clock} color="amber" onClick={stats.pendingVerif > 0 ? () => setVerifFilter('PENDING') : undefined} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou email..." className="pl-10 h-9" />
        </div>
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          <FilterChip label="Todos" active={roleFilter === 'ALL'} onClick={() => setRoleFilter('ALL')} />
          {ROLES.map(r => (
            <FilterChip key={r.value} label={r.short} color={r.color} count={stats.byRole[r.value] || 0} active={roleFilter === r.value} onClick={() => setRoleFilter(r.value)} />
          ))}
        </div>
        <Select value={verifFilter} onValueChange={setVerifFilter}>
          <SelectTrigger className="h-9 w-40 text-xs"><SelectValue placeholder="Verificação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Verificação: Todas</SelectItem>
            <SelectItem value="NONE">Não verificadas</SelectItem>
            <SelectItem value="PENDING">Pendentes</SelectItem>
            <SelectItem value="VERIFIED">Verificadas</SelectItem>
            <SelectItem value="REJECTED">Rejeitadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8 text-zinc-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <UserIcon className="h-10 w-10 text-zinc-200 mx-auto mb-2" />
              <p>Nenhum usuário encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {filtered.map((u) => {
                const role = ROLES.find(r => r.value === u.role) || ROLES[3]
                const RoleIcon = role.icon
                const verif = VERIFICATION_LABELS[u.verificationStatus || 'NONE']
                const VerifIcon = verif.icon
                return (
                  <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-zinc-50">
                    <div className="relative">
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="h-11 w-11 rounded-full object-cover" onError={(e) => {
                          const t = e.currentTarget; t.style.display='none'
                          const sib = t.nextElementSibling as HTMLElement; if (sib) sib.style.display='flex'
                        }} />
                      ) : null}
                      <div className={cn('h-11 w-11 rounded-full text-white flex items-center justify-center font-bold text-sm', !u.avatar ? '' : 'hidden', `bg-${role.color}-500`)} style={{ display: u.avatar ? 'none' : 'flex' }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      {u.verificationStatus === 'VERIFIED' && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center" title="Verificado">
                          <BadgeCheck className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-sm text-zinc-900">{u.name}</div>
                        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold', `bg-${role.color}-100 text-${role.color}-700`)}>
                          <RoleIcon className="h-2.5 w-2.5" /> {role.short}
                        </span>
                        {u.verificationStatus === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                            <Clock className="h-2.5 w-2.5" /> Verif. pendente
                          </span>
                        )}
                        {u.editorProfile ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                            <UserCog className="h-2.5 w-2.5" /> Editor ({u.editorProfile.level})
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" /> {u.email}
                        {u.verificationDoc && (
                          <span className="ml-2 text-zinc-400">· {verif.label}: {formatDocument(u.verificationDoc, u.verificationType)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 flex-wrap">
                        <span className="flex items-center gap-0.5"><FileText className="h-2.5 w-2.5" /> {u._count?.posts || 0} posts</span>
                        <span className="flex items-center gap-0.5"><ShoppingBag className="h-2.5 w-2.5" /> {u._count?.classifiedListings || 0} classif.</span>
                        <span className="flex items-center gap-0.5"><CreditCard className="h-2.5 w-2.5" /> {u._count?.subscriptions || 0} subs</span>
                        <span className="flex items-center gap-1 text-amber-600"><Award className="h-2.5 w-2.5" /> {u.points}</span>
                        <span className="flex items-center gap-1 text-emerald-600"><Coins className="h-2.5 w-2.5" /> {u.credits}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(u); setEditOpen(true) }} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {currentUser?.role === 'MASTER' && u.id !== currentUser.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                              <AlertDialogDescription>{u.name} ({u.email}) será removido permanentemente. Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(u.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-zinc-200">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="h-4 w-4 text-primary" /> Editar Usuário
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <EditUserForm
              user={editing}
              currentUser={currentUser}
              onSaved={() => { setEditOpen(false); load() }}
              onCancel={() => setEditOpen(false)}
              onViewEditorProfile={(userId) => {
                setEditOpen(false)
                setView({ name: 'admin', section: 'editors' })
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* New dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <NewUserForm onSaved={() => { setNewOpen(false); load() }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ EDIT USER FORM (with tabs) ============
function EditUserForm({ user, currentUser, onSaved, onCancel, onViewEditorProfile }: {
  user: any
  currentUser: any
  onSaved: () => void
  onCancel: () => void
  onViewEditorProfile: (userId: string) => void
}) {
  const { toast } = useToast()
  const [tab, setTab] = useState('identity')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || '',
    bio: user.bio || '',
    points: user.points,
    credits: user.credits,
    verificationStatus: user.verificationStatus || 'NONE',
    verificationType: user.verificationType || 'CPF',
    verificationDoc: user.verificationDoc || '',
  })
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const originalRole = user.role

  const hasChanges = JSON.stringify({
    name: user.name, email: user.email, role: user.role, avatar: user.avatar || '',
    bio: user.bio || '', points: user.points, credits: user.credits,
    verificationStatus: user.verificationStatus || 'NONE',
    verificationType: user.verificationType || 'CPF',
    verificationDoc: user.verificationDoc || '',
  }) !== JSON.stringify(form) || newPassword.length > 0

  const handleSave = async () => {
    if (!form.name || !form.email) {
      toast({ title: 'Nome e email são obrigatórios', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body: any = { ...form }
      if (newPassword) body.newPassword = newPassword
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        toast({
          title: 'Usuário atualizado!',
          description: form.role === 'EDITOR' && originalRole !== 'EDITOR'
            ? 'Tornou-se editor — perfil criado em /admin?section=editors'
            : newPassword ? 'Dados e senha atualizados.' : 'Dados atualizados com sucesso.',
        })
        onSaved()
      }
    } finally { setSaving(false) }
  }

  const TabsList_ = (
    <TabsList className="grid grid-cols-4 w-full">
      <TabsTrigger value="identity" className="text-xs">Identidade</TabsTrigger>
      <TabsTrigger value="verification" className="text-xs">Verificação</TabsTrigger>
      <TabsTrigger value="security" className="text-xs">Segurança</TabsTrigger>
      <TabsTrigger value="gamification" className="text-xs">Pontos</TabsTrigger>
    </TabsList>
  )

  return (
    <div className="flex flex-col" style={{ maxHeight: 'calc(92vh - 72px)' }}>
      {/* User header preview */}
      <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center gap-3">
        {form.avatar ? (
          <img src={form.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
            {form.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-zinc-900 truncate">{form.name || 'Sem nome'}</div>
          <div className="text-xs text-zinc-500 truncate">{form.email}</div>
        </div>
        {form.role === 'EDITOR' && (
          <Button size="sm" variant="outline" onClick={() => onViewEditorProfile(user.id)}>
            <UserCog className="h-3.5 w-3.5 mr-1" /> Ver perfil editor
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 pt-3 border-b border-zinc-100">
          {TabsList_}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5">
            {/* Identity tab */}
            <TabsContent value="identity" className="mt-0 space-y-4">
              <SectionTitle icon={UserIcon} title="Dados pessoais" color="blue" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome completo *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Bio (descrição pública)</Label>
                <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className="mt-1" placeholder="Breve biografia do usuário..." />
              </div>
              <div>
                <Label className="text-xs">Avatar</Label>
                <ImageUpload value={form.avatar} onChange={(url) => setForm({ ...form, avatar: url })} placeholder="URL da imagem ou faça upload" />
              </div>

              <SectionTitle icon={ShieldCheck} title="Papel no sistema" color="amber" description="Define as permissões de acesso." />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ROLES.filter(r => r.value !== 'MASTER' || currentUser?.role === 'MASTER').map(r => {
                  const Icon = r.icon
                  const selected = form.role === r.value
                  return (
                    <button
                      key={r.value}
                      onClick={() => setForm({ ...form, role: r.value })}
                      className={cn(
                        'p-3 rounded-md border-2 transition-all text-center',
                        selected ? `border-${r.color}-500 bg-${r.color}-50` : 'border-zinc-200 hover:border-zinc-300'
                      )}
                    >
                      <Icon className={cn('h-5 w-5 mx-auto mb-1', selected ? `text-${r.color}-600` : 'text-zinc-400')} />
                      <div className={cn('text-xs font-bold', selected ? `text-${r.color}-700` : 'text-zinc-700')}>{r.short}</div>
                    </button>
                  )
                })}
              </div>
              {form.role === 'EDITOR' && originalRole !== 'EDITOR' && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Tornar editor:</strong> Ao salvar, será criado automaticamente um perfil de editor com configurações padrão.
                    Você poderá ajustar permissões, limites e bio na seção <strong>Editores</strong>.
                  </div>
                </div>
              )}
              {form.role !== 'EDITOR' && originalRole === 'EDITOR' && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Remover editor:</strong> O perfil de editor será mantido (mas inativo). Para remover completamente, vá em <strong>Editores</strong>.
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Verification tab */}
            <TabsContent value="verification" className="mt-0 space-y-4">
              <SectionTitle icon={BadgeCheck} title="Verificação de CPF/CNPJ" color="emerald" description="Status da verificação de identidade do usuário." />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['NONE', 'PENDING', 'VERIFIED', 'REJECTED'] as const).map(status => {
                  const v = VERIFICATION_LABELS[status]
                  const Icon = v.icon
                  const selected = form.verificationStatus === status
                  return (
                    <button
                      key={status}
                      onClick={() => setForm({ ...form, verificationStatus: status })}
                      className={cn(
                        'p-3 rounded-md border-2 transition-all text-center flex flex-col items-center gap-1',
                        selected ? `border-${v.color}-500 bg-${v.color}-50` : 'border-zinc-200 hover:border-zinc-300'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', selected ? `text-${v.color}-600` : 'text-zinc-400')} />
                      <div className={cn('text-xs font-bold', selected ? `text-${v.color}-700` : 'text-zinc-700')}>{v.label}</div>
                    </button>
                  )
                })}
              </div>

              {form.verificationStatus !== 'NONE' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Tipo de documento</Label>
                      <Select value={form.verificationType} onValueChange={(v) => setForm({ ...form, verificationType: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CPF">CPF (11 dígitos)</SelectItem>
                          <SelectItem value="CNPJ">CNPJ (14 dígitos)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Número do documento</Label>
                      <Input
                        value={formatDocument(form.verificationDoc, form.verificationType)}
                        onChange={(e) => setForm({ ...form, verificationDoc: e.target.value.replace(/\D/g, '') })}
                        placeholder={form.verificationType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                        className="mt-1"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {form.verificationDoc ? `${form.verificationDoc.replace(/\D/g, '').length} dígitos` : 'Digite apenas números'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      Ao marcar como <strong>VERIFIED</strong>, o usuário receberá o selo de verificado e ganhará o achievement de verificação.
                      Ao marcar como <strong>REJECTED</strong>, ele será notificado para reenviar com correções.
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Security tab */}
            <TabsContent value="security" className="mt-0 space-y-4">
              <SectionTitle icon={Lock} title="Senha de acesso" color="amber" description="Altere a senha do usuário. Deixe em branco para manter a atual." />

              <div>
                <Label className="text-xs flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Nova senha
                </Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword && newPassword.length < 6 && (
                  <p className="text-[10px] text-red-600 mt-1">A senha precisa ter no mínimo 6 caracteres.</p>
                )}
                {newPassword && newPassword.length >= 6 && (
                  <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Senha válida — será aplicada ao salvar.
                  </p>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Segurança:</strong> Ao alterar a senha, todas as sessões ativas do usuário serão invalidadas na próxima tentativa de login.
                  Recomendado: comunique a nova senha ao usuário de forma segura.
                </div>
              </div>

              <div className="text-xs text-zinc-500">
                <div className="font-medium text-zinc-700 mb-1">Informações da conta</div>
                <div>Último login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('pt-BR') : 'Nunca'}</div>
                <div>Cadastrado em: {new Date(user.createdAt).toLocaleDateString('pt-BR')}</div>
                <div>Streak de check-in: {user.checkInStreak || 0} dia(s)</div>
                {user.referralCode && <div>Código de indicação: <code className="bg-zinc-100 px-1 rounded">{user.referralCode}</code></div>}
              </div>
            </TabsContent>

            {/* Gamification tab */}
            <TabsContent value="gamification" className="mt-0 space-y-4">
              <SectionTitle icon={Award} title="Pontos e Créditos" color="amber" description="Ajuste manualmente os saldos do usuário." />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <Label className="text-xs flex items-center gap-1 text-amber-700">
                    <Award className="h-3 w-3" /> Pontos
                  </Label>
                  <Input
                    type="number"
                    value={form.points}
                    onChange={(e) => setForm({ ...form, points: parseInt(e.target.value) || 0 })}
                    className="mt-1 bg-white"
                  />
                  <p className="text-[10px] text-amber-700 mt-1">Usados para boost de anúncios e criação de anúncios extras.</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3">
                  <Label className="text-xs flex items-center gap-1 text-emerald-700">
                    <Coins className="h-3 w-3" /> Créditos
                  </Label>
                  <Input
                    type="number"
                    value={form.credits}
                    onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value) || 0 })}
                    className="mt-1 bg-white"
                  />
                  <p className="text-[10px] text-emerald-700 mt-1">Usados para anúncios grátis no portal (1 crédito = 1 anúncio).</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800 flex items-start gap-2">
                <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Dica:</strong> Use pontos para recompensar usuários por bom comportamento, e créditos para conceder anúncios gratuitos como cortesia.
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-zinc-50 rounded-md p-2">
                  <FileText className="h-4 w-4 mx-auto mb-1 text-zinc-500" />
                  <div className="font-bold text-zinc-900">{user._count?.posts || 0}</div>
                  <div className="text-zinc-500">Posts</div>
                </div>
                <div className="bg-zinc-50 rounded-md p-2">
                  <ShoppingBag className="h-4 w-4 mx-auto mb-1 text-zinc-500" />
                  <div className="font-bold text-zinc-900">{user._count?.classifiedListings || 0}</div>
                  <div className="text-zinc-500">Classificados</div>
                </div>
                <div className="bg-zinc-50 rounded-md p-2">
                  <CreditCard className="h-4 w-4 mx-auto mb-1 text-zinc-500" />
                  <div className="font-bold text-zinc-900">{user._count?.subscriptions || 0}</div>
                  <div className="text-zinc-500">Assinaturas</div>
                </div>
                <div className="bg-zinc-50 rounded-md p-2">
                  <Megaphone className="h-4 w-4 mx-auto mb-1 text-zinc-500" />
                  <div className="font-bold text-zinc-900">{user._count?.payments || 0}</div>
                  <div className="text-zinc-500">Pagamentos</div>
                </div>
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>

      {/* Footer */}
      <div className="border-t border-zinc-200 bg-white p-3 flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-500 flex items-center gap-1">
          {hasChanges ? (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              <span>Alterações não salvas</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>Tudo salvo</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="h-9">Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges} className="bg-primary h-9">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar alterações
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============ NEW USER FORM ============
function NewUserForm({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'EDITOR', bio: '', avatar: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!form.name || !form.email || !form.password) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }
    if (form.password.length < 6) {
      toast({ title: 'Senha precisa ter no mínimo 6 caracteres', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        toast({
          title: 'Usuário criado!',
          description: form.role === 'EDITOR' ? 'Editor criado com perfil padrão. Configure permissões em /admin?section=editors.' : 'Usuário criado com sucesso.',
        })
        onSaved()
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nome completo *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="Ex: João Silva" />
        </div>
        <div>
          <Label className="text-xs">Email *</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" placeholder="joao@exemplo.com" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Senha *</Label>
        <div className="relative mt-1">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Mínimo 6 caracteres"
            className="pr-10"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <Label className="text-xs">Papel</Label>
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ADMIN">Administrador</SelectItem>
            <SelectItem value="EDITOR">Editor (cria perfil de editor automaticamente)</SelectItem>
            <SelectItem value="READER">Leitor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Bio (opcional)</Label>
        <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={2} className="mt-1" placeholder="Breve descrição..." />
      </div>
      <div>
        <Label className="text-xs">Avatar URL (opcional)</Label>
        <Input value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} className="mt-1" placeholder="https://..." />
      </div>
      {form.role === 'EDITOR' && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800 flex items-start gap-2">
          <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            Ao criar um editor, será gerado automaticamente um perfil de editor com configurações padrão.
            Você poderá ajustar permissões, limites, bio pública e trust level na seção <strong>Editores</strong>.
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
        <Button onClick={handleSave} disabled={loading} className="bg-primary">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Criar usuário
        </Button>
      </div>
    </div>
  )
}

// ============ SHARED UI ============
function MiniStat({ label, value, icon: Icon, color, onClick }: { label: string; value: number; icon: any; color: string; onClick?: () => void }) {
  const colors: Record<string, string> = {
    zinc: 'bg-zinc-50 text-zinc-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div
      className={cn('rounded-lg p-2.5', colors[color], onClick && 'cursor-pointer hover:brightness-95')}
      onClick={onClick}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-70 mb-0.5">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="text-lg font-black">{value.toLocaleString('pt-BR')}</div>
    </div>
  )
}

function FilterChip({ label, color, count, active, onClick }: { label: string; color?: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1',
        active
          ? color ? `bg-${color}-600 text-white` : 'bg-zinc-800 text-white'
          : 'text-zinc-600 hover:text-zinc-900'
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn('text-[10px] rounded-full px-1', active ? 'bg-white/20' : 'bg-zinc-200')}>{count}</span>
      )}
    </button>
  )
}

function SectionTitle({ icon: Icon, title, color, description }: { icon: any; title: string; color: string; description?: string }) {
  return (
    <div className="flex items-start gap-2 pt-2">
      <div className={cn('h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0', `bg-${color}-100 text-${color}-600`)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="font-bold text-sm text-zinc-900">{title}</div>
        {description && <div className="text-xs text-zinc-500">{description}</div>}
      </div>
    </div>
  )
}
