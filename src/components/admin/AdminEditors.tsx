'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Users, Shield, Check, X, Loader2, Edit, Crown, Star, TrendingUp, Clock,
  AlertCircle, UserCog, Search, Mail, FileText, CheckCircle, XCircle, Eye,
  LayoutGrid, Lock, Unlock, Sparkles, Zap, RefreshCw, ExternalLink, ChevronRight,
  Calendar, Image as ImageIcon, Video, Link2, Eye as EyeIcon, FileCheck, Award,
  Sliders, Globe, Save, Rocket, ShieldCheck, Megaphone, ShoppingBag, Plus,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn, getColorClasses, formatDate } from '@/lib/utils'
import { EDITOR_LEVELS, PANEL_SECTIONS } from '@/lib/editors'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { useApiError } from '@/hooks/use-api-error'

// ===================== MAIN COMPONENT =====================
export function AdminEditors() {
  const { toast } = useToast()
  const { setView } = useAppStore()
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('ALL')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/editor-profile')
      const data = await res.json()
      setProfiles(data.profiles || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const openEdit = (profile: any) => {
    // Navigate to full-page editor config instead of opening modal
    setView({ name: 'editor-config', userId: profile.userId })
  }

  const openNew = () => {
    setEditorOpen(true)
  }

  // Filtered list (memoized)
  const filtered = useMemo(() => {
    let list = profiles
    if (levelFilter !== 'ALL') {
      list = list.filter(p => p.level === levelFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.user.name.toLowerCase().includes(q) ||
        p.user.email.toLowerCase().includes(q) ||
        (p.bioTitle || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [profiles, search, levelFilter])

  // Stats by level
  const stats = useMemo(() => {
    const byLevel: Record<string, number> = {}
    let totalPosts = 0
    let totalApproved = 0
    let avgTrust = 0
    profiles.forEach(p => {
      byLevel[p.level] = (byLevel[p.level] || 0) + 1
      totalPosts += p.user._count?.posts || 0
      totalApproved += p.totalApproved
      avgTrust += p.trustLevel
    })
    return {
      byLevel,
      total: profiles.length,
      totalPosts,
      totalApproved,
      avgTrust: profiles.length > 0 ? Math.round(avgTrust / profiles.length) : 0,
      activeBios: profiles.filter(p => p.bioIsActive).length,
    }
  }, [profiles])

  if (loading) {
    return <LoadingSpinner label="Carregando editores..." className="py-12" />
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-end gap-3">
        <Button onClick={openNew} className="bg-primary">
          <UserCog className="h-4 w-4 mr-2" /> Configurar editor
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <MiniStat label="Total" value={stats.total} icon={Users} color="zinc" />
        <MiniStat label="Bios ativas" value={stats.activeBios} icon={Globe} color="blue" />
        <MiniStat label="Posts" value={stats.totalPosts} icon={FileText} color="emerald" />
        <MiniStat label="Aprovados" value={stats.totalApproved} icon={CheckCircle} color="emerald" />
        <MiniStat label="Trust médio" value={stats.avgTrust} suffix="/100" icon={Shield} color="amber" />
        <MiniStat label="Masters" value={stats.byLevel.MASTER || 0} icon={Crown} color="purple" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou cargo..."
            className="pl-10 h-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          <FilterChip label="Todos" active={levelFilter === 'ALL'} onClick={() => setLevelFilter('ALL')} />
          {EDITOR_LEVELS.map(l => (
            <FilterChip
              key={l.value}
              label={l.label}
              color={l.color}
              count={stats.byLevel[l.value] || 0}
              active={levelFilter === l.value}
              onClick={() => setLevelFilter(l.value)}
            />
          ))}
        </div>
      </div>

      {/* Editor list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-zinc-900 mb-1">
              {search || levelFilter !== 'ALL' ? 'Nenhum editor encontrado' : 'Nenhum editor configurado'}
            </h3>
            <p className="text-sm text-zinc-500 mb-4">
              {search || levelFilter !== 'ALL'
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece configurando um usuário como editor.'}
            </p>
            {!search && levelFilter === 'ALL' && (
              <Button onClick={openNew} className="bg-primary">
                <UserCog className="h-4 w-4 mr-2" /> Configurar primeiro editor
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <EditorCard key={p.id} profile={p} onConfigure={() => openEdit(p)} onViewPublic={(slug) => setView({ name: 'editor-profile', slug })} />
          ))}
        </div>
      )}

      {/* New editor dialog (only for creating; editing is done on full-page view) */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-zinc-200">
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4 text-primary" />
              Novo editor
            </DialogTitle>
          </DialogHeader>
          <NewEditorForm onSaved={() => { setEditorOpen(false); load() }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===================== EDITOR CARD =====================
function EditorCard({ profile: p, onConfigure, onViewPublic }: { profile: any; onConfigure: () => void; onViewPublic: (slug: string) => void }) {
  const level = EDITOR_LEVELS.find(l => l.value === p.level) || EDITOR_LEVELS[0]
  const levelColors = getColorClasses(level.color)
  const allowedCats = p.categoriesAllowed === null ? 'Todas' : `${p.categoriesAllowed.length} categoria(s)`
  const postCount = p.user._count?.posts || 0
  const trustColor = p.trustLevel >= 80 ? 'purple' : p.trustLevel >= 50 ? 'amber' : p.trustLevel >= 25 ? 'emerald' : 'blue'

  return (
    <Card className="hover:shadow-md transition-all overflow-hidden">
      <div className={cn('h-1.5', `bg-${level.color}-500`)} />
      <CardContent className="p-4 space-y-3">
        {/* Header: avatar + name + actions */}
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            {p.user.avatar ? (
              <img
                src={p.user.avatar}
                alt=""
                className="h-14 w-14 rounded-full object-cover border-2 border-white shadow-sm"
                onError={(e) => {
                  const t = e.currentTarget; t.style.display='none'
                  const sib = t.nextElementSibling as HTMLElement; if (sib) sib.style.display='flex'
                }}
              />
            ) : null}
            <div
              className={cn('h-14 w-14 rounded-full flex items-center justify-center font-bold text-white text-lg shadow-sm', !p.user.avatar ? '' : 'hidden', `bg-${level.color}-500`)}
              style={{ display: p.user.avatar ? 'none' : 'flex' }}
            >
              {p.user.name.charAt(0).toUpperCase()}
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn('absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm cursor-help', levelColors.bgSolid)} title={level.label}>
                    {level.value === 'MASTER' ? <Crown className="h-3 w-3 text-white" /> : <Star className="h-3 w-3 text-white" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="text-xs">
                    <div className="font-bold">{level.label}</div>
                    <div className="opacity-80">{level.description}</div>
                    <div className="opacity-60 mt-1">Min. trust: {level.minTrust}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-zinc-900 truncate">{p.user.name}</h3>
              <Badge className={cn('text-[10px] uppercase tracking-wider', levelColors.bg, levelColors.text, `border-${level.color}-200`)} variant="outline">
                {level.label}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5 truncate">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{p.user.email}</span>
            </div>
            {p.bioTitle && (
              <div className="text-xs text-zinc-600 mt-0.5 italic">{p.bioTitle}</div>
            )}
          </div>

          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button size="sm" onClick={onConfigure} className="bg-primary h-8">
              <Edit className="h-3.5 w-3.5 mr-1" /> Configurar
            </Button>
            {p.bioIsActive && p.bioSlug && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onViewPublic(p.bioSlug)}>
                <ExternalLink className="h-3 w-3 mr-1" /> Ver bio
              </Button>
            )}
          </div>
        </div>

        {/* Trust bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-zinc-600">
              <Shield className="h-3 w-3" /> Trust Level
            </span>
            <span className={cn('font-bold', `text-${trustColor}-700`)}>{p.trustLevel}/100</span>
          </div>
          <Progress value={p.trustLevel} className={cn('h-1.5', `[&>div]:bg-${trustColor}-500`)} />
        </div>

        {/* Status badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {p.requiresApproval ? (
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">
              <Clock className="h-2.5 w-2.5 mr-1" /> Requer aprovação
            </Badge>
          ) : (
            <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">
              <Unlock className="h-2.5 w-2.5 mr-1" /> Publicação direta
            </Badge>
          )}
          {p.bioIsActive && (
            <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50 text-[10px]">
              <Globe className="h-2.5 w-2.5 mr-1" /> Bio pública
            </Badge>
          )}
          {p.consecutiveApprovals > 0 && (
            <Badge variant="outline" className="text-purple-700 border-purple-300 bg-purple-50 text-[10px]">
              <Zap className="h-2.5 w-2.5 mr-1" /> Streak {p.consecutiveApprovals}
            </Badge>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          <StatBlock icon={FileText} value={postCount} label="Posts" color="text-zinc-700" />
          <StatBlock icon={CheckCircle} value={p.totalApproved} label="Aprov." color="text-emerald-600" />
          <StatBlock icon={XCircle} value={p.totalRejected} label="Reprov." color="text-red-600" />
          <StatBlock icon={LayoutGrid} value={allowedCats} label="Cats" color="text-blue-600" isText />
        </div>

        {/* Limits row — compact chips */}
        <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-zinc-100">
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mr-1">Limites:</span>
          <LimitChip icon={Calendar} label={`${p.postLimitDaily === -1 ? '∞' : p.postLimitDaily}/dia`} />
          <LimitChip icon={Calendar} label={`${p.postLimitWeekly === -1 ? '∞' : p.postLimitWeekly}/sem`} />
          <LimitChip icon={Calendar} label={`${p.postLimitMonthly === -1 ? '∞' : p.postLimitMonthly}/mês`} />
          {p.autoRejectAfterHours && <LimitChip icon={XCircle} label={`Rej. ${p.autoRejectAfterHours}h`} color="red" />}
          {p.autoApproveAfterHours && <LimitChip icon={CheckCircle} label={`Aprov. ${p.autoApproveAfterHours}h`} color="emerald" />}
        </div>
      </CardContent>
    </Card>
  )
}

// ===================== EDITOR CONFIG MODAL (with vertical tabs) =====================
function EditorConfigForm({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const { toast } = useToast()
  const apiError = useApiError()
  const [form, setForm] = useState<any>({
    categoriesAllowed: profile.categoriesAllowed || null,
    requiresApproval: profile.requiresApproval,
    canEditOwnPosts: profile.canEditOwnPosts,
    allowImages: profile.allowImages,
    allowVideos: profile.allowVideos,
    allowLinks: profile.allowLinks,
    showEditorName: profile.showEditorName,
    postLimitDaily: profile.postLimitDaily,
    postLimitWeekly: profile.postLimitWeekly,
    postLimitMonthly: profile.postLimitMonthly,
    panelAccess: profile.panelAccess || [],
    trustLevel: profile.trustLevel,
    autoApproveThreshold: profile.autoApproveThreshold,
    autoRejectAfterHours: profile.autoRejectAfterHours,
    autoApproveAfterHours: profile.autoApproveAfterHours,
    level: profile.level,
    bioSlug: profile.bioSlug || '',
    bioTitle: profile.bioTitle || '',
    bioIsActive: profile.bioIsActive,
  })
  const [categories, setCategories] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'permissions' | 'limits' | 'panel' | 'trust' | 'bio' | 'personal' | 'metrics'>('personal')
  const [metrics, setMetrics] = useState<any>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [personalForm, setPersonalForm] = useState<any>({
    name: profile.user.name,
    email: profile.user.email,
    avatar: profile.user.avatar || '',
    bio: profile.user.bio || '',
    newPassword: '',
  })

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(data => setCategories(data.categories || []))
  }, [])

  // Load metrics on demand
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (activeTab === 'metrics' && !metrics && !metricsLoading) {
      setMetricsLoading(true)
      fetch(`/api/admin/editors/${profile.userId}/metrics`)
        .then(r => r.json())
        .then(d => setMetrics(d))
        .finally(() => setMetricsLoading(false))
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeTab, profile.userId, metrics, metricsLoading])

  // Detect changes for save button indicator
  const profileHasChanges = JSON.stringify(form) !== JSON.stringify({
    categoriesAllowed: profile.categoriesAllowed || null,
    requiresApproval: profile.requiresApproval,
    canEditOwnPosts: profile.canEditOwnPosts,
    allowImages: profile.allowImages,
    allowVideos: profile.allowVideos,
    allowLinks: profile.allowLinks,
    showEditorName: profile.showEditorName,
    postLimitDaily: profile.postLimitDaily,
    postLimitWeekly: profile.postLimitWeekly,
    postLimitMonthly: profile.postLimitMonthly,
    panelAccess: profile.panelAccess || [],
    trustLevel: profile.trustLevel,
    autoApproveThreshold: profile.autoApproveThreshold,
    autoRejectAfterHours: profile.autoRejectAfterHours,
    autoApproveAfterHours: profile.autoApproveAfterHours,
    level: profile.level,
    bioSlug: profile.bioSlug || '',
    bioTitle: profile.bioTitle || '',
    bioIsActive: profile.bioIsActive,
  })

  const personalHasChanges = (
    personalForm.name !== profile.user.name ||
    personalForm.email !== profile.user.email ||
    personalForm.avatar !== (profile.user.avatar || '') ||
    personalForm.bio !== (profile.user.bio || '') ||
    personalForm.newPassword.length > 0
  )

  const hasChanges = profileHasChanges || personalHasChanges

  const toggleCategory = (catId: string) => {
    const current = form.categoriesAllowed || []
    if (current.includes(catId)) {
      const next = current.filter((c: string) => c !== catId)
      setForm({ ...form, categoriesAllowed: next.length === 0 ? [] : next })
    } else {
      setForm({ ...form, categoriesAllowed: [...current, catId] })
    }
  }

  const selectAllCategories = () => setForm({ ...form, categoriesAllowed: null })
  const deselectAllCategories = () => setForm({ ...form, categoriesAllowed: [] })

  const togglePanel = (section: string) => {
    const current = form.panelAccess || []
    if (current.includes(section)) {
      setForm({ ...form, panelAccess: current.filter((s: string) => s !== section) })
    } else {
      setForm({ ...form, panelAccess: [...current, section] })
    }
  }

  const applyPreset = (preset: 'conservative' | 'balanced' | 'permissive') => {
    if (preset === 'conservative') {
      setForm({
        ...form,
        requiresApproval: true,
        canEditOwnPosts: false,
        allowImages: true,
        allowVideos: false,
        allowLinks: false,
        showEditorName: false,
        postLimitDaily: 3,
        postLimitWeekly: 10,
        postLimitMonthly: 30,
        autoRejectAfterHours: 48,
        autoApproveAfterHours: null,
        panelAccess: ['dashboard', 'posts', 'editor'],
      })
      toast({ title: 'Preset Conservador aplicado', description: 'Requer aprovação, limites baixos, sem vídeos.' })
    } else if (preset === 'balanced') {
      setForm({
        ...form,
        requiresApproval: true,
        canEditOwnPosts: true,
        allowImages: true,
        allowVideos: true,
        allowLinks: true,
        showEditorName: true,
        postLimitDaily: 10,
        postLimitWeekly: 40,
        postLimitMonthly: 120,
        autoRejectAfterHours: 72,
        autoApproveAfterHours: 96,
        panelAccess: ['dashboard', 'posts', 'editor', 'classifieds'],
      })
      toast({ title: 'Preset Equilibrado aplicado', description: 'Aprovação com auto-ação, todos os recursos.' })
    } else {
      setForm({
        ...form,
        requiresApproval: false,
        canEditOwnPosts: true,
        allowImages: true,
        allowVideos: true,
        allowLinks: true,
        showEditorName: true,
        postLimitDaily: -1,
        postLimitWeekly: -1,
        postLimitMonthly: -1,
        autoRejectAfterHours: null,
        autoApproveAfterHours: null,
        panelAccess: ['dashboard', 'posts', 'editor', 'ads', 'categories', 'classifieds'],
      })
      toast({ title: 'Preset Permissivo aplicado', description: 'Sem aprovação, limites ilimitados.' })
    }
  }

  const applyTrustPreset = (level: 'JUNIOR' | 'PLENO' | 'SENIOR' | 'MASTER') => {
    const l = EDITOR_LEVELS.find(x => x.value === level)!
    setForm({ ...form, trustLevel: l.minTrust, level })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // 1. Save personal data if changed
      if (personalHasChanges) {
        const personalBody: any = {
          name: personalForm.name,
          email: personalForm.email,
          avatar: personalForm.avatar,
          bio: personalForm.bio,
        }
        if (personalForm.newPassword) personalBody.newPassword = personalForm.newPassword
        const personalRes = await fetch(`/api/users/${profile.userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(personalBody),
        })
        const personalData = await personalRes.json()
        if (personalData.error) {
          apiError(personalData.error, 'Erro ao salvar dados pessoais')
          setSaving(false)
          return
        }
      }
      // 2. Save editor profile config if changed
      if (profileHasChanges) {
        const res = await fetch(`/api/editor-profile/${profile.userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (data.error) {
          apiError(data.error, 'Erro ao salvar perfil de editor')
          setSaving(false)
          return
        }
      }
      toast({ title: 'Editor atualizado!', description: personalForm.newPassword ? 'Dados, senha e configurações salvos.' : 'Todas as alterações foram salvas com sucesso.' })
      onSaved()
    } finally { setSaving(false) }
  }

  const TABS = [
    { id: 'personal', label: 'Dados Pessoais', icon: UserCog, color: 'blue' },
    { id: 'permissions', label: 'Permissões', icon: Lock, color: 'amber' },
    { id: 'limits', label: 'Limites', icon: Sliders, color: 'blue' },
    { id: 'panel', label: 'Painel', icon: LayoutGrid, color: 'emerald' },
    { id: 'trust', label: 'Confiança', icon: Shield, color: 'purple' },
    { id: 'bio', label: 'Bio pública', icon: Globe, color: 'cyan' },
    { id: 'metrics', label: 'Métricas', icon: TrendingUp, color: 'rose' },
  ] as const

  return (
    <div className="flex h-[calc(92vh-72px)]">
      {/* Left sidebar — vertical tab navigation */}
      <div className="w-56 border-r border-zinc-200 bg-zinc-50/50 flex flex-col">
        {/* Editor preview card */}
        <div className="p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            {profile.user.avatar ? (
              <img src={profile.user.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                {profile.user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-sm text-zinc-900 truncate">{profile.user.name}</div>
              <div className="text-xs text-zinc-500 truncate">{profile.user.email}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 text-center text-xs">
            <div className="bg-white rounded p-1.5 border border-zinc-100">
              <div className="font-bold text-zinc-900">{profile.user._count?.posts || 0}</div>
              <div className="text-zinc-400">Posts</div>
            </div>
            <div className="bg-white rounded p-1.5 border border-zinc-100">
              <div className="font-bold text-emerald-600">{profile.totalApproved}</div>
              <div className="text-zinc-400">Aprov.</div>
            </div>
            <div className="bg-white rounded p-1.5 border border-zinc-100">
              <div className="font-bold text-red-600">{profile.totalRejected}</div>
              <div className="text-zinc-400">Reprov.</div>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const tabColors = getColorClasses(tab.color)
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? `bg-white shadow-sm font-medium text-zinc-900 border-l-2 border-${tab.color}-500`
                    : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-900'
                )}
              >
                <Icon className={cn('h-4 w-4', isActive ? tabColors.textSolid : 'text-zinc-400')} />
                {tab.label}
                {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto text-zinc-400" />}
              </button>
            )
          })}
        </nav>

        {/* Quick presets */}
        <div className="p-3 border-t border-zinc-200">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">Presets rápidos</div>
          <div className="space-y-1">
            <button onClick={() => applyPreset('conservative')} className="w-full text-xs text-left px-2 py-1.5 rounded hover:bg-amber-50 text-amber-700 flex items-center gap-1">
              <Lock className="h-3 w-3" /> Conservador
            </button>
            <button onClick={() => applyPreset('balanced')} className="w-full text-xs text-left px-2 py-1.5 rounded hover:bg-blue-50 text-blue-700 flex items-center gap-1">
              <Shield className="h-3 w-3" /> Equilibrado
            </button>
            <button onClick={() => applyPreset('permissive')} className="w-full text-xs text-left px-2 py-1.5 rounded hover:bg-emerald-50 text-emerald-700 flex items-center gap-1">
              <Unlock className="h-3 w-3" /> Permissivo
            </button>
          </div>
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-5">
            {activeTab === 'personal' && <PersonalTab form={personalForm} setForm={setPersonalForm} profile={profile} />}
            {activeTab === 'permissions' && <PermissionsTab form={form} setForm={setForm} categories={categories} toggleCategory={toggleCategory} selectAll={selectAllCategories} deselectAll={deselectAllCategories} />}
            {activeTab === 'limits' && <LimitsTab form={form} setForm={setForm} />}
            {activeTab === 'panel' && <PanelTab form={form} togglePanel={togglePanel} />}
            {activeTab === 'trust' && <TrustTab form={form} setForm={setForm} profile={profile} applyPreset={applyTrustPreset} />}
            {activeTab === 'bio' && <BioTab form={form} setForm={setForm} />}
            {activeTab === 'metrics' && <MetricsTab metrics={metrics} loading={metricsLoading} />}
          </div>
        </ScrollArea>

        {/* Footer save bar */}
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
            <Button variant="outline" size="sm" onClick={onSaved} className="h-9">Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges} className="bg-primary h-9">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar configurações
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===================== TAB: PERMISSIONS =====================
export function PermissionsTab({ form, setForm, categories, toggleCategory, selectAll, deselectAll }: any) {
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <Lock className="h-4 w-4 text-amber-600" /> Permissões de Publicação
        </h3>
        <p className="text-sm text-zinc-500 mt-0.5">Controle o que o editor pode fazer ao publicar notícias.</p>
      </div>

      {/* Approval workflow */}
      <SectionCard
        title="Fluxo de aprovação"
        icon={FileCheck}
        color="amber"
        description="Define se os posts deste editor passam por revisão."
      >
        <PermissionToggle
          icon={form.requiresApproval ? Clock : Unlock}
          label="Requer aprovação administrativa"
          description={form.requiresApproval ? 'Posts ficam pendentes até um admin revisar.' : 'Posts são publicados imediatamente.'}
          checked={form.requiresApproval}
          onChange={(v) => setForm({ ...form, requiresApproval: v })}
          color={form.requiresApproval ? 'amber' : 'emerald'}
        />
      </SectionCard>

      {/* Categories */}
      <SectionCard
        title="Categorias permitidas"
        icon={LayoutGrid}
        color="blue"
        description="Em quais categorias o editor pode publicar."
      >
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={selectAll}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              form.categoriesAllowed === null
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            )}
          >
            <Check className="h-3 w-3 inline mr-1" /> Todas
          </button>
          <button
            onClick={deselectAll}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              form.categoriesAllowed !== null && form.categoriesAllowed.length === 0
                ? 'bg-zinc-700 text-white'
                : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
            )}
          >
            <X className="h-3 w-3 inline mr-1" /> Nenhuma
          </button>
          {form.categoriesAllowed !== null && form.categoriesAllowed.length > 0 && (
            <span className="text-xs text-zinc-500 ml-auto">{form.categoriesAllowed.length} selecionada(s)</span>
          )}
        </div>
        {form.categoriesAllowed === null ? (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800 flex items-center gap-2">
            <Check className="h-4 w-4" />
            Editor pode publicar em todas as categorias.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categories.map((c: any) => {
              const selected = form.categoriesAllowed.includes(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCategory(c.id)}
                  className={cn(
                    'flex items-center gap-2 p-2.5 border-2 rounded-md text-sm transition-all text-left',
                    selected
                      ? `border-${c.color}-500 bg-${c.color}-50 text-${c.color}-900`
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  )}
                >
                  <div className={cn(
                    'h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border',
                    selected ? `bg-${c.color}-500 border-${c.color}-500` : 'border-zinc-300'
                  )}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="font-medium truncate">{c.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Publishing features */}
      <SectionCard
        title="Recursos de publicação"
        icon={Sparkles}
        color="purple"
        description="Quais tipos de conteúdo o editor pode incluir."
      >
        <div className="space-y-1">
          <PermissionToggle icon={Edit} label="Pode editar próprios posts" description="Após publicar, ainda pode modificar." checked={form.canEditOwnPosts} onChange={(v) => setForm({ ...form, canEditOwnPosts: v })} color="blue" />
          <PermissionToggle icon={ImageIcon} label="Permitir imagens" description="Pode anexar imagens aos posts." checked={form.allowImages} onChange={(v) => setForm({ ...form, allowImages: v })} color="emerald" />
          <PermissionToggle icon={Video} label="Permitir vídeos" description="Pode incorporar vídeos (YouTube, etc.)." checked={form.allowVideos} onChange={(v) => setForm({ ...form, allowVideos: v })} color="red" />
          <PermissionToggle icon={Link2} label="Permitir links externos" description="Pode incluir links para sites externos." checked={form.allowLinks} onChange={(v) => setForm({ ...form, allowLinks: v })} color="blue" />
          <PermissionToggle icon={EyeIcon} label="Mostrar nome do editor na matéria" description="Exibe 'Por: Fulano' no rodapé do artigo." checked={form.showEditorName} onChange={(v) => setForm({ ...form, showEditorName: v })} color="amber" />
        </div>
      </SectionCard>
    </div>
  )
}

// ===================== TAB: LIMITS =====================
export function LimitsTab({ form, setForm }: any) {
  const setLimit = (key: string, value: number | null) => {
    setForm({ ...form, [key]: value })
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <Sliders className="h-4 w-4 text-blue-600" /> Limites de Publicação
        </h3>
        <p className="text-sm text-zinc-500 mt-0.5">Controle quantos posts o editor pode criar por período.</p>
      </div>

      {/* Quick presets */}
      <SectionCard
        title="Presets de limite"
        icon={Zap}
        color="amber"
        description="Aplique combinações comuns rapidamente."
      >
        <div className="grid grid-cols-3 gap-2">
          <PresetButton
            label="Restrito"
            subLabel="3/d · 10/s · 30/m"
            color="red"
            onClick={() => {
              setLimit('postLimitDaily', 3)
              setLimit('postLimitWeekly', 10)
              setLimit('postLimitMonthly', 30)
            }}
          />
          <PresetButton
            label="Moderado"
            subLabel="10/d · 40/s · 120/m"
            color="blue"
            onClick={() => {
              setLimit('postLimitDaily', 10)
              setLimit('postLimitWeekly', 40)
              setLimit('postLimitMonthly', 120)
            }}
          />
          <PresetButton
            label="Ilimitado"
            subLabel="∞ em todos"
            color="emerald"
            onClick={() => {
              setLimit('postLimitDaily', -1)
              setLimit('postLimitWeekly', -1)
              setLimit('postLimitMonthly', -1)
            }}
          />
        </div>
      </SectionCard>

      {/* Daily/Weekly/Monthly limits */}
      <SectionCard
        title="Limites por período"
        icon={Calendar}
        color="blue"
        description="Use -1 para ilimitado."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <LimitInput
            label="Diário"
            value={form.postLimitDaily}
            onChange={(v) => setLimit('postLimitDaily', v)}
            color="amber"
          />
          <LimitInput
            label="Semanal"
            value={form.postLimitWeekly}
            onChange={(v) => setLimit('postLimitWeekly', v)}
            color="blue"
          />
          <LimitInput
            label="Mensal"
            value={form.postLimitMonthly}
            onChange={(v) => setLimit('postLimitMonthly', v)}
            color="purple"
          />
        </div>
      </SectionCard>

      {/* Auto-actions */}
      <SectionCard
        title="Ações automáticas"
        icon={Clock}
        color="amber"
        description="O que acontece se um post não for revisado a tempo."
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AutoActionInput
              icon={XCircle}
              color="red"
              label="Auto-rejeitar após"
              placeholder="Ex: 48"
              value={form.autoRejectAfterHours}
              onChange={(v) => setForm({ ...form, autoRejectAfterHours: v })}
            />
            <AutoActionInput
              icon={CheckCircle}
              color="emerald"
              label="Auto-aprovar após"
              placeholder="Ex: 72"
              value={form.autoApproveAfterHours}
              onChange={(v) => setForm({ ...form, autoApproveAfterHours: v })}
            />
          </div>
          <div className={cn(
            'rounded-md p-3 text-xs border flex items-start gap-2',
            form.autoApproveAfterHours && form.autoRejectAfterHours
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          )}>
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              {form.autoApproveAfterHours && form.autoRejectAfterHours ? (
                <>Ambos configurados. <strong>Auto-aprovar tem prioridade</strong> — se o prazo de aprovação chegar primeiro, o post será aprovado.</>
              ) : form.autoApproveAfterHours ? (
                <>Apenas auto-aprovar configurado. Posts não revisados serão aprovados após {form.autoApproveAfterHours}h.</>
              ) : form.autoRejectAfterHours ? (
                <>Apenas auto-rejeitar configurado. Posts não revisados serão rejeitados após {form.autoRejectAfterHours}h.</>
              ) : (
                <>Nenhuma auto-ação configurada. Posts ficarão pendentes indefinidamente até revisão manual.</>
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ===================== TAB: PANEL ACCESS =====================
export function PanelTab({ form, togglePanel }: any) {
  const allSelected = PANEL_SECTIONS.every(s => form.panelAccess.includes(s.value))
  const noneSelected = form.panelAccess.length === 0

  const selectAll = () => PANEL_SECTIONS.forEach(s => {
    if (!form.panelAccess.includes(s.value)) togglePanel(s.value)
  })
  const deselectAll = () => form.panelAccess.forEach((s: string) => togglePanel(s))

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-emerald-600" /> Acesso ao Painel
        </h3>
        <p className="text-sm text-zinc-500 mt-0.5">Quais seções administrativas este editor pode acessar.</p>
      </div>

      <SectionCard
        title="Seleção rápida"
        icon={Zap}
        color="amber"
      >
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            disabled={allSelected}
            className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            <Check className="h-3 w-3 inline mr-1" /> Selecionar todas
          </button>
          <button
            onClick={deselectAll}
            disabled={noneSelected}
            className="px-3 py-1.5 rounded text-xs font-medium bg-zinc-50 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            <X className="h-3 w-3 inline mr-1" /> Limpar seleção
          </button>
          <span className="ml-auto text-xs text-zinc-500 self-center">{form.panelAccess.length} de {PANEL_SECTIONS.length} selecionadas</span>
        </div>
      </SectionCard>

      <SectionCard
        title="Seções disponíveis"
        icon={LayoutGrid}
        color="emerald"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PANEL_SECTIONS.map(s => {
            const selected = form.panelAccess.includes(s.value)
            const Icon = SECTION_ICONS[s.value as keyof typeof SECTION_ICONS] || LayoutGrid
            return (
              <button
                key={s.value}
                onClick={() => togglePanel(s.value)}
                className={cn(
                  'flex items-center gap-3 p-3 border-2 rounded-md transition-all text-left',
                  selected
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                )}
              >
                <div className={cn(
                  'h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0',
                  selected ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-400'
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('font-medium text-sm', selected ? 'text-emerald-900' : 'text-zinc-900')}>
                    {s.label}
                  </div>
                  <div className="text-xs text-zinc-500">{SECTION_DESCRIPTIONS[s.value as keyof typeof SECTION_DESCRIPTIONS] || 'Acesso à seção'}</div>
                </div>
                <div className={cn(
                  'h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0 border',
                  selected ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-300'
                )}>
                  {selected && <Check className="h-3 w-3 text-white" />}
                </div>
              </button>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

// ===================== TAB: TRUST =====================
export function TrustTab({ form, setForm, profile, applyPreset }: any) {
  const currentLevel = EDITOR_LEVELS.find(l => l.value === form.level) || EDITOR_LEVELS[0]

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <Shield className="h-4 w-4 text-purple-600" /> Sistema de Confiança
        </h3>
        <p className="text-sm text-zinc-500 mt-0.5">Defina o nível de confiança do editor e suas auto-aprovações.</p>
      </div>

      {/* Current level display */}
      <SectionCard
        title="Nível atual"
        icon={Crown}
        color={currentLevel.color}
      >
        <div className={cn('rounded-md p-4 border-2', `border-${currentLevel.color}-300 bg-${currentLevel.color}-50`)}>
          <div className="flex items-center gap-3">
            <div className={cn('h-12 w-12 rounded-full flex items-center justify-center', `bg-${currentLevel.color}-500`)}>
              {currentLevel.value === 'MASTER' ? <Crown className="h-6 w-6 text-white" /> : <Star className="h-6 w-6 text-white" />}
            </div>
            <div className="flex-1">
              <div className={cn('font-bold text-lg', `text-${currentLevel.color}-900`)}>{currentLevel.label}</div>
              <div className={cn('text-sm', `text-${currentLevel.color}-700`)}>{currentLevel.description}</div>
            </div>
            <div className="text-right">
              <div className={cn('text-3xl font-black', `text-${currentLevel.color}-700`)}>{form.trustLevel}</div>
              <div className="text-xs text-zinc-500">/ 100</div>
            </div>
          </div>
        </div>

        {/* Level quick-select */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {EDITOR_LEVELS.map(l => (
            <button
              key={l.value}
              onClick={() => applyPreset(l.value)}
              className={cn(
                'p-2.5 rounded-md border-2 transition-all text-center',
                form.level === l.value
                  ? `border-${l.color}-500 bg-${l.color}-50`
                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
              )}
            >
              <div className={cn('font-bold text-sm', `text-${l.color}-700`)}>{l.label}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">min. {l.minTrust}</div>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Trust slider */}
      <SectionCard
        title="Ajuste fino do Trust Level"
        icon={Sliders}
        color="purple"
      >
        <input
          type="range"
          min="0"
          max="100"
          value={form.trustLevel}
          onChange={(e) => {
            const v = parseInt(e.target.value)
            const newLevel = v >= 80 ? 'MASTER' : v >= 50 ? 'SENIOR' : v >= 25 ? 'PLENO' : 'JUNIOR'
            setForm({ ...form, trustLevel: v, level: newLevel })
          }}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-zinc-400 mt-1">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>80</span>
          <span>100</span>
        </div>
      </SectionCard>

      {/* Auto-approve threshold */}
      <SectionCard
        title="Auto-aprovação por streak"
        icon={Zap}
        color="amber"
        description="Quantas aprovações consecutivas são necessárias para auto-aprovar posts."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PresetButton label="Nunca" subLabel="0 aprovações" color="zinc" onClick={() => setForm({ ...form, autoApproveThreshold: 0 })} active={form.autoApproveThreshold === 0} />
          <PresetButton label="Padrão" subLabel="10 aprovações" color="blue" onClick={() => setForm({ ...form, autoApproveThreshold: 10 })} active={form.autoApproveThreshold === 10} />
          <PresetButton label="Rápido" subLabel="5 aprovações" color="emerald" onClick={() => setForm({ ...form, autoApproveThreshold: 5 })} active={form.autoApproveThreshold === 5} />
        </div>
        <div className="mt-3">
          <Label className="text-xs">Valor personalizado</Label>
          <Input
            type="number"
            min="0"
            value={form.autoApproveThreshold}
            onChange={(e) => setForm({ ...form, autoApproveThreshold: parseInt(e.target.value) || 0 })}
            className="mt-1 max-w-[160px]"
          />
        </div>
      </SectionCard>

      {/* Stats */}
      <SectionCard
        title="Estatísticas do editor"
        icon={TrendingUp}
        color="blue"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatBox label="Aprovações totais" value={profile.totalApproved} color="emerald" icon={CheckCircle} />
          <StatBox label="Reprovações totais" value={profile.totalRejected} color="red" icon={XCircle} />
          <StatBox label="Streak atual" value={profile.consecutiveApprovals} color="amber" icon={Zap} />
          <StatBox label="Auto-aprovados" value={profile.totalAutoApproved || 0} color="emerald" icon={Rocket} />
          <StatBox label="Auto-rejeitados" value={profile.totalAutoRejected || 0} color="red" icon={XCircle} />
          <StatBox label="Trust atual" value={profile.trustLevel} color="purple" icon={Shield} suffix="/100" />
        </div>
      </SectionCard>
    </div>
  )
}

// ===================== TAB: BIO =====================
export function BioTab({ form, setForm }: any) {
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <Globe className="h-4 w-4 text-cyan-600" /> Bio Pública
        </h3>
        <p className="text-sm text-zinc-500 mt-0.5">Configure a página pública do editor em /editores/[slug].</p>
      </div>

      <SectionCard
        title="Visibilidade"
        icon={EyeIcon}
        color="cyan"
      >
        <PermissionToggle
          icon={Globe}
          label="Bio ativa na listagem pública"
          description={form.bioIsActive ? 'Aparece em /editores para todos os visitantes.' : 'Não aparece na listagem pública.'}
          checked={form.bioIsActive}
          onChange={(v) => setForm({ ...form, bioIsActive: v })}
          color={form.bioIsActive ? 'cyan' : 'zinc'}
        />
      </SectionCard>

      <SectionCard
        title="Identidade pública"
        icon={UserCog}
        color="blue"
        description="Como o editor é apresentado publicamente."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs flex items-center gap-1">
              <Link2 className="h-3 w-3" /> Slug da URL pública
            </Label>
            <Input
              value={form.bioSlug}
              onChange={(e) => setForm({ ...form, bioSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              placeholder="ex: joao-silva"
              className="mt-1 font-mono text-sm"
            />
            {form.bioSlug && (
              <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                URL: /editores/<span className="font-mono text-cyan-700">{form.bioSlug}</span>
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1">
              <Award className="h-3 w-3" /> Título / Cargo
            </Label>
            <Input
              value={form.bioTitle}
              onChange={(e) => setForm({ ...form, bioTitle: e.target.value })}
              placeholder="ex: Editor de Política"
              className="mt-1"
            />
            <p className="text-xs text-zinc-500 mt-1">Exibido abaixo do nome na bio.</p>
          </div>
        </div>
      </SectionCard>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Campos adicionais da bio</strong> (foto, biografia, redes sociais, categorias visíveis) podem ser configurados pelo próprio editor em seu perfil. Aqui você controla apenas os campos administrativos.
        </div>
      </div>
    </div>
  )
}

// ===================== TAB: PERSONAL DATA =====================
export function PersonalTab({ form, setForm, profile }: any) {
  const [showPassword, setShowPassword] = useState(false)
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <UserCog className="h-4 w-4 text-blue-600" /> Dados Pessoais do Editor
        </h3>
        <p className="text-sm text-zinc-500 mt-0.5">Edite as informações de conta do editor. Use o campo de senha para redefini-la.</p>
      </div>

      <SectionCard title="Identidade" icon={UserCog} color="blue" description="Nome, email e avatar do editor.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nome completo *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
            {form.email !== profile.user.email && (
              <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Email será alterado ao salvar.
              </p>
            )}
          </div>
        </div>
        <div className="mt-3">
          <Label className="text-xs">Avatar</Label>
          <ImageUploadSimple value={form.avatar} onChange={(url) => setForm({ ...form, avatar: url })} />
        </div>
        <div className="mt-3">
          <Label className="text-xs">Bio (descrição)</Label>
          <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className="mt-1" placeholder="Breve biografia do editor..." />
        </div>
      </SectionCard>

      <SectionCard title="Segurança" icon={Lock} color="amber" description="Redefina a senha de acesso do editor.">
        <div>
          <Label className="text-xs flex items-center gap-1">
            <Lock className="h-3 w-3" /> Nova senha
          </Label>
          <div className="relative mt-1">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              placeholder="Deixe em branco para manter a atual"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            >
              {showPassword ? <EyeIcon className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.newPassword && form.newPassword.length < 6 && (
            <p className="text-[10px] text-red-600 mt-1">Mínimo 6 caracteres.</p>
          )}
          {form.newPassword && form.newPassword.length >= 6 && (
            <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
              <Check className="h-3 w-3" /> Senha válida — será aplicada ao salvar.
            </p>
          )}
        </div>
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Atenção:</strong> Ao alterar a senha, o editor precisará usar a nova senha no próximo login.
            Comunique a alteração ao editor de forma segura.
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Informações da conta" icon={FileText} color="zinc">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <InfoField label="ID do usuário" value={<code className="text-xs bg-zinc-100 px-1 rounded">{profile.userId.slice(0, 12)}...</code>} />
          <InfoField label="Verificação" value={profile.user.verificationStatus || 'NONE'} />
          <InfoField label="Editor desde" value={formatDate(profile.createdAt, 'short')} />
          <InfoField label="Posts publicados" value={profile.user._count?.posts || 0} />
          <InfoField label="Aprovações" value={profile.totalApproved} />
          <InfoField label="Reprovações" value={profile.totalRejected} />
        </div>
      </SectionCard>
    </div>
  )
}

// ===================== TAB: METRICS =====================
export function MetricsTab({ metrics, loading }: { metrics: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="text-center py-12 text-zinc-500 flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando métricas...
      </div>
    )
  }
  if (!metrics) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <TrendingUp className="h-10 w-10 text-zinc-300 mx-auto mb-2" />
        <p>Não foi possível carregar as métricas.</p>
      </div>
    )
  }

  const s = metrics.summary
  const maxCatCount = Math.max(...(metrics.categoriesDistribution || []).map((c: any) => c.count), 1)
  const maxDayCount = Math.max(...(metrics.postsByDay || []).map((d: any) => d.count), 1)
  const maxReviewCount = Math.max(...(metrics.recentReviews || []).map((_: any) => 1), 1)

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-rose-600" /> Métricas de Desempenho
        </h3>
        <p className="text-sm text-zinc-500 mt-0.5">Visão geral da produção e qualidade do editor.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        <KpiCard icon={FileText} label="Posts totais" value={s.totalPosts} color="blue" />
        <KpiCard icon={Eye} label="Views totais" value={s.totalViews} color="purple" />
        <KpiCard icon={TrendingUp} label="Views/post" value={s.avgViewsPerPost} color="emerald" />
        <KpiCard icon={CheckCircle} label="% Aprovação" value={`${s.approvalPct}%`} color="emerald" />
        <KpiCard icon={Star} label="Avaliação" value={s.avgRating > 0 ? s.avgRating.toFixed(1) : '—'} color="amber" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <MiniKpi label="Posts 7d" value={s.posts7d} />
        <MiniKpi label="Posts 30d" value={s.posts30d} />
        <MiniKpi label="Views 7d" value={s.totalViews7d} />
        <MiniKpi label="Publicados" value={s.publishedCount} color="emerald" />
        <MiniKpi label="Rascunhos" value={s.draftCount} color="amber" />
        <MiniKpi label="Rejeitados" value={s.rejectedByReview ?? s.rejectedCount} color="red" />
      </div>

      {/* Two-column: posts by day + categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Produção (7 dias)" icon={Calendar} color="blue">
          <div className="flex items-end gap-2 h-32">
            {(metrics.postsByDay || []).map((d: any) => {
              const height = (d.count / maxDayCount) * 100
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs font-bold text-zinc-700">{d.count}</div>
                  <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }} />
                  <div className="text-[10px] text-zinc-500">{new Date(d.date).toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                </div>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard title="Categorias mais publicadas" icon={LayoutGrid} color="emerald">
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {(metrics.categoriesDistribution || []).slice(0, 6).map((c: any) => {
              const pct = (c.count / maxCatCount) * 100
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <div className="text-xs font-medium text-zinc-700 w-24 truncate">{c.name}</div>
                  <div className="flex-1 bg-zinc-100 rounded h-4 overflow-hidden">
                    <div className={cn('h-full', `bg-${c.color}-500`)} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs font-bold text-zinc-900 w-6 text-right">{c.count}</div>
                </div>
              )
            })}
            {(!metrics.categoriesDistribution || metrics.categoriesDistribution.length === 0) && (
              <p className="text-xs text-zinc-500 text-center py-4">Ainda não há posts publicados.</p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Trust history */}
      {metrics.trustHistory && (
        <SectionCard title="Histórico de confiança" icon={Shield} color="purple">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TrustBox label="Trust atual" value={`${metrics.trustHistory.current}/100`} color="purple" />
            <TrustBox label="Nível" value={metrics.trustHistory.level} color="purple" />
            <TrustBox label="Streak" value={`${metrics.trustHistory.consecutiveApprovals}/${metrics.trustHistory.autoApproveThreshold}`} color="amber" />
            <TrustBox label="Total aprovados" value={metrics.trustHistory.totalApproved} color="emerald" />
            <TrustBox label="Total rejeitados" value={metrics.trustHistory.totalRejected} color="red" />
            <TrustBox label="Auto-aprovados" value={metrics.trustHistory.totalAutoApproved} color="emerald" />
            <TrustBox label="Auto-rejeitados" value={metrics.trustHistory.totalAutoRejected} color="red" />
            <TrustBox label="Avaliações recebidas" value={s.ratingsCount} color="amber" />
          </div>
        </SectionCard>
      )}

      {/* Top posts */}
      <SectionCard title="Top 5 posts mais vistos" icon={TrendingUp} color="rose">
        <div className="space-y-2">
          {(metrics.topPosts || []).map((p: any, i: number) => (
            <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 rounded">
              <div className="text-zinc-400 font-bold text-sm w-5">#{i + 1}</div>
              <div className="w-10 h-10 rounded bg-zinc-100 overflow-hidden flex-shrink-0">
                {p.coverImage && <img src={p.coverImage} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-900 line-clamp-1">{p.title}</div>
                <div className="text-xs text-zinc-500">{p.category?.name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-purple-700 flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {p.views}
                </div>
                <div className="text-[10px] text-zinc-400">{p.publishedAt ? formatDate(p.publishedAt, 'short') : '—'}</div>
              </div>
            </div>
          ))}
          {(!metrics.topPosts || metrics.topPosts.length === 0) && (
            <p className="text-xs text-zinc-500 text-center py-4">Nenhum post publicado ainda.</p>
          )}
        </div>
      </SectionCard>

      {/* Recent reviews */}
      <SectionCard title="Últimas revisões (10)" icon={FileCheck} color="amber">
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {(metrics.recentReviews || []).map((r: any) => {
            const actionLabels: Record<string, { label: string; color: string }> = {
              APPROVED: { label: 'Aprovado', color: 'emerald' },
              REJECTED: { label: 'Rejeitado', color: 'red' },
              AUTO_APPROVED: { label: 'Auto-aprovado', color: 'emerald' },
              AUTO_REJECTED: { label: 'Auto-rejeitado', color: 'red' },
              SUBMITTED: { label: 'Enviado', color: 'blue' },
              EDITED: { label: 'Editado', color: 'amber' },
              REPUBLISHED: { label: 'Republicado', color: 'blue' },
            }
            const a = actionLabels[r.action] || { label: r.action, color: 'zinc' }
            const aColors = getColorClasses(a.color)
            return (
              <div key={r.id} className="flex items-start gap-3 p-2 hover:bg-zinc-50 rounded text-sm">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0', aColors.bg, `text-${a.color}-700`)}>
                  {a.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-900 line-clamp-1">{r.post?.title || '—'}</div>
                  <div className="text-[11px] text-zinc-500">
                    {r.reviewer?.name ? `Por ${r.reviewer.name} · ` : ''}{formatDate(r.createdAt, 'datetime')}
                    {r.reason ? ` · Motivo: ${r.reason}` : ''}
                  </div>
                </div>
              </div>
            )
          })}
          {(!metrics.recentReviews || metrics.recentReviews.length === 0) && (
            <p className="text-xs text-zinc-500 text-center py-4">Nenhuma revisão registrada ainda.</p>
          )}
        </div>
      </SectionCard>

      {/* Editor ratings */}
      <SectionCard title={`Avaliações de leitores (${metrics.ratings?.length || 0})`} icon={Star} color="amber">
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {(metrics.ratings || []).map((r: any, i: number) => (
            <div key={i} className="flex items-start gap-3 p-2 hover:bg-zinc-50 rounded text-sm">
              <div className="flex">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star key={n} className={cn('h-3 w-3', n <= r.rating ? 'fill-amber-500 text-amber-500' : 'text-zinc-300')} />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                {r.comment && <div className="text-sm text-zinc-900 line-clamp-2">"{r.comment}"</div>}
                <div className="text-[11px] text-zinc-500">
                  {r.rater?.name || 'Anônimo'} · {formatDate(r.createdAt, 'short')}
                </div>
              </div>
            </div>
          ))}
          {(!metrics.ratings || metrics.ratings.length === 0) && (
            <p className="text-xs text-zinc-500 text-center py-4">Nenhuma avaliação recebida ainda.</p>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// ===================== NEW EDITOR FORM =====================
function NewEditorForm({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast()
  const apiError = useApiError()
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [newForm, setNewForm] = useState({
    name: '', email: '', password: '', bio: '', avatar: '',
    bioTitle: '', bioSlug: '', bioIsActive: true,
  })
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => setUsers((data.users || []).filter((u: any) => u.role === 'READER' || u.role === 'EDITOR')))
  }, [])

  const filtered = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreateExisting = async () => {
    if (!userId) {
      toast({ title: 'Selecione um usuário', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/editor-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        toast({ title: 'Editor criado!', description: 'Perfil padrão aplicado. Configure as permissões.' })
        onSaved()
      }
    } finally { setLoading(false) }
  }

  const handleCreateNew = async () => {
    if (!newForm.name || !newForm.email || !newForm.password) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }
    if (newForm.password.length < 6) {
      toast({ title: 'Senha precisa ter no mínimo 6 caracteres', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/editor-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      })
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        toast({ title: 'Editor criado!', description: `${newForm.name} foi cadastrado com perfil de editor.` })
        onSaved()
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col" style={{ maxHeight: 'calc(92vh - 72px)' }}>
      {/* Mode switcher */}
      <div className="px-5 pt-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-lg">
          <button
            onClick={() => setMode('existing')}
            className={cn(
              'px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2',
              mode === 'existing' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-600'
            )}
          >
            <UserCog className="h-4 w-4" /> Promover usuário existente
          </button>
          <button
            onClick={() => setMode('new')}
            className={cn(
              'px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2',
              mode === 'new' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-600'
            )}
          >
            <Plus className="h-4 w-4" /> Criar novo editor
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5">
          {mode === 'existing' ? (
            <div className="space-y-4 max-w-2xl">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-800 flex items-start gap-3">
                <UserCog className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-1">Promover usuário existente</strong>
                  Selecione um usuário já cadastrado para configurar como editor. Ele receberá um perfil padrão que você poderá ajustar nas próximas telas.
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Buscar usuário</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou email..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="border border-zinc-200 rounded-md max-h-80 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-sm text-zinc-500">
                    <Users className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                    Nenhum usuário disponível.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {filtered.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => setUserId(u.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 text-left transition-colors',
                          userId === u.id ? 'bg-primary/5' : 'hover:bg-zinc-50'
                        )}
                      >
                        <div className={cn(
                          'h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          userId === u.id ? 'border-primary bg-primary' : 'border-zinc-300'
                        )}>
                          {userId === u.id && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center font-bold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-zinc-900">{u.name}</div>
                          <div className="text-xs text-zinc-500">{u.email}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-2xl">
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 text-sm text-emerald-800 flex items-start gap-3">
                <Plus className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-1">Criar novo editor com login</strong>
                  Cadastre um novo usuário já com papel de editor. Será criada a conta + o perfil de editor com configurações padrão em uma única operação.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome completo *</Label>
                  <Input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} className="mt-1" placeholder="Ex: João Silva" />
                </div>
                <div>
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} className="mt-1" placeholder="joao@exemplo.com" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Senha *</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newForm.password}
                    onChange={(e) => setNewForm({ ...newForm, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                    {showPassword ? <EyeIcon className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs">Bio (opcional)</Label>
                <Textarea value={newForm.bio} onChange={(e) => setNewForm({ ...newForm, bio: e.target.value })} rows={2} className="mt-1" placeholder="Breve biografia..." />
              </div>

              <div>
                <Label className="text-xs">Avatar URL (opcional)</Label>
                <Input value={newForm.avatar} onChange={(e) => setNewForm({ ...newForm, avatar: e.target.value })} className="mt-1" placeholder="https://..." />
              </div>

              <div className="border-t border-zinc-100 pt-3">
                <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">Bio pública (opcional)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Título/cargo</Label>
                    <Input value={newForm.bioTitle} onChange={(e) => setNewForm({ ...newForm, bioTitle: e.target.value })} className="mt-1" placeholder="Ex: Editor de Política" />
                  </div>
                  <div>
                    <Label className="text-xs">Slug da URL</Label>
                    <Input
                      value={newForm.bioSlug}
                      onChange={(e) => setNewForm({ ...newForm, bioSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                      className="mt-1 font-mono text-sm"
                      placeholder="joao-silva"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <Switch checked={newForm.bioIsActive} onCheckedChange={(v) => setNewForm({ ...newForm, bioIsActive: v })} />
                  <span className="text-sm">Bio ativa na listagem pública</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-zinc-200 bg-white p-3 flex justify-end gap-2">
        <Button variant="outline" onClick={onSaved}>Cancelar</Button>
        <Button
          onClick={mode === 'existing' ? handleCreateExisting : handleCreateNew}
          disabled={loading || (mode === 'existing' ? !userId : !newForm.name || !newForm.email || !newForm.password)}
          className="bg-primary"
        >
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCog className="h-4 w-4 mr-2" />}
          {mode === 'existing' ? 'Promover a editor' : 'Criar novo editor'}
        </Button>
      </div>
    </div>
  )
}

// ===================== SHARED UI COMPONENTS =====================
function MiniStat({ label, value, icon: Icon, color, suffix }: { label: string; value: number; icon: any; color: string; suffix?: string }) {
  const colors: Record<string, string> = {
    zinc: 'bg-zinc-50 text-zinc-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className={cn('rounded-lg p-2.5', colors[color])}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-70 mb-0.5">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="text-lg font-black">
        {value.toLocaleString('pt-BR')}{suffix}
      </div>
    </div>
  )
}

function FilterChip({ label, color, count, active, onClick }: { label: string; color?: string; count?: number; active: boolean; onClick: () => void }) {
  const cColors = color ? getColorClasses(color) : null
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1',
        active
          ? cColors ? cn(cColors.bgSolid, 'text-white') : 'bg-zinc-800 text-white'
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

function StatBlock({ icon: Icon, value, label, color, isText }: { icon: any; value: number | string; label: string; color: string; isText?: boolean }) {
  return (
    <div className="bg-zinc-50 rounded-md p-2 text-center">
      <Icon className={cn('h-3.5 w-3.5 mx-auto mb-0.5', color)} />
      <div className={cn('font-bold text-sm leading-tight', color)}>
        {isText ? value : (value as number).toLocaleString('pt-BR')}
      </div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
    </div>
  )
}

function LimitChip({ icon: Icon, label, color }: { icon: any; label: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    red: 'bg-red-50 text-red-700 border-red-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    default: 'bg-zinc-50 text-zinc-700 border-zinc-200',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', colorClasses[color || 'default'])}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

export function SectionCard({ title, icon: Icon, color, description, children }: { title: string; icon: any; color: string; description?: string; children: React.ReactNode }) {
  const cColors = getColorClasses(color)
  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className={cn('px-4 py-2.5 border-b border-zinc-100 flex items-center gap-2', `bg-${color}-50/50`)}>
        <Icon className={cn('h-4 w-4', cColors.textSolid)} />
        <div>
          <div className="font-bold text-sm text-zinc-900">{title}</div>
          {description && <div className="text-xs text-zinc-500">{description}</div>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function PermissionToggle({ icon: Icon, label, description, checked, onChange, color }: { icon: any; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 p-2.5 rounded-md transition-colors', checked ? `bg-${color}-50` : 'hover:bg-zinc-50')}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={cn('h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0', checked ? `bg-${color}-500 text-white` : 'bg-zinc-100 text-zinc-400')}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-900">{label}</div>
          {description && <div className="text-xs text-zinc-500 mt-0.5">{description}</div>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function PresetButton({ label, subLabel, color, onClick, active }: { label: string; subLabel: string; color: string; onClick: () => void; active?: boolean }) {
  const colors: Record<string, string> = {
    red: 'border-red-500 bg-red-50 text-red-900',
    blue: 'border-blue-500 bg-blue-50 text-blue-900',
    emerald: 'border-emerald-500 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-500 bg-amber-50 text-amber-900',
    purple: 'border-purple-500 bg-purple-50 text-purple-900',
    zinc: 'border-zinc-500 bg-zinc-50 text-zinc-900',
  }
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-3 rounded-md border-2 transition-all text-center',
        active ? colors[color] : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-900'
      )}
    >
      <div className="font-bold text-sm">{label}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{subLabel}</div>
    </button>
  )
}

function LimitInput({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div>
      <Label className={cn('text-xs flex items-center gap-1', `text-${color}-700`)}>
        <Calendar className="h-3 w-3" /> {label}
      </Label>
      <div className="mt-1 flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="flex-1"
        />
        <button
          onClick={() => onChange(-1)}
          className={cn(
            'px-2.5 py-2 rounded text-xs font-medium transition-colors',
            value === -1 ? `bg-${color}-500 text-white` : `bg-${color}-50 text-${color}-700 hover:bg-${color}-100`
          )}
          title="Ilimitado"
        >
          ∞
        </button>
      </div>
      <div className="text-[10px] text-zinc-400 mt-1">
        {value === -1 ? 'Ilimitado' : `${value} posts`}
      </div>
    </div>
  )
}

function AutoActionInput({ icon: Icon, color, label, placeholder, value, onChange }: { icon: any; color: string; label: string; placeholder: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <Label className={cn('text-xs flex items-center gap-1', `text-${color}-700`)}>
        <Icon className="h-3 w-3" /> {label}
      </Label>
      <div className="mt-1 flex items-center gap-2">
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
          placeholder={placeholder}
          className="flex-1"
        />
        <span className="text-sm text-zinc-500">horas</span>
      </div>
      <div className="text-[10px] text-zinc-400 mt-1">
        {value ? `Após ${value}h sem revisão` : 'Desativado'}
      </div>
    </div>
  )
}

function StatBox({ label, value, color, icon: Icon, suffix }: { label: string; value: number; color: string; icon: any; suffix?: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return (
    <div className={cn('rounded-md p-3 border', colors[color])}>
      <div className="flex items-center justify-between mb-1">
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="text-2xl font-black">
        {value}{suffix}
      </div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return (
    <div className={cn('rounded-md p-3 border', colors[color])}>
      <Icon className="h-4 w-4 opacity-70 mb-1" />
      <div className="text-xl font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">{label}</div>
    </div>
  )
}

function MiniKpi({ label, value, color = 'zinc' }: { label: string; value: any; color?: string }) {
  const colors: Record<string, string> = {
    zinc: 'bg-zinc-50 text-zinc-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return (
    <div className={cn('rounded-md p-2 text-center', colors[color])}>
      <div className="text-base font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
    </div>
  )
}

function TrustBox({ label, value, color }: { label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  return (
    <div className={cn('rounded-md p-2 border', colors[color])}>
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">{label}</div>
      <div className="text-sm text-zinc-900 font-medium mt-0.5">{value}</div>
    </div>
  )
}

function ImageUploadSimple({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      {value && (
        <img src={value} alt="" className="h-12 w-12 rounded-full object-cover border border-zinc-200" />
      )}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="URL da imagem ou faça upload" className="flex-1" />
    </div>
  )
}

// Icons and descriptions for panel sections
const SECTION_ICONS = {
  dashboard: LayoutGrid,
  posts: FileText,
  editor: Edit,
  ads: Megaphone,
  categories: LayoutGrid,
  seo: Globe,
  users: Users,
  classifieds: ShoppingBag,
} as const

const SECTION_DESCRIPTIONS = {
  dashboard: 'Visão geral e métricas',
  posts: 'Listar, editar e excluir notícias',
  editor: 'Criar nova notícia',
  ads: 'Gerenciar anúncios e monetização',
  categories: 'Criar e editar categorias',
  seo: 'Configurações de SEO e aparência',
  users: 'Gerenciar usuários do portal',
  classifieds: 'Moderar classificados',
} as const
