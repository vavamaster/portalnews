'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2, Save, ChevronLeft, UserCog, Lock, Sliders, LayoutGrid, Shield,
  Globe, TrendingUp, Check, AlertCircle, ExternalLink,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn, getColorClasses } from '@/lib/utils'
import { EDITOR_LEVELS } from '@/lib/editors'
import { UserAvatar } from '@/components/portal/UserAvatar'
import {
  PersonalTab, PermissionsTab, LimitsTab, PanelTab, TrustTab, BioTab, MetricsTab,
} from './AdminEditors'

interface Props {
  userId: string
}

type TabId = 'personal' | 'permissions' | 'limits' | 'panel' | 'trust' | 'bio' | 'metrics'

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'personal', label: 'Dados Pessoais', icon: UserCog },
  { id: 'permissions', label: 'Permissões', icon: Lock },
  { id: 'limits', label: 'Limites', icon: Sliders },
  { id: 'panel', label: 'Painel', icon: LayoutGrid },
  { id: 'trust', label: 'Confiança', icon: Shield },
  { id: 'bio', label: 'Bio pública', icon: Globe },
  { id: 'metrics', label: 'Métricas', icon: TrendingUp },
]

export function EditorConfigPage({ userId }: Props) {
  const { toast } = useToast()
  const { setView } = useAppStore()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('personal')
  const [categories, setCategories] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  const [form, setForm] = useState<any>(null)
  const [personalForm, setPersonalForm] = useState<any>(null)

  // Load profile on mount
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [profilesRes, catsRes] = await Promise.all([
          fetch(`/api/editor-profile/${userId}`).then(r => r.json()),
          fetch('/api/categories').then(r => r.json()),
        ])
        if (cancelled) return
        const found = profilesRes.profile
        if (!found) {
          toast({ title: 'Editor não encontrado', variant: 'destructive' })
          setView({ name: 'admin', section: 'editors' })
          return
        }
        setProfile(found)
        setCategories(catsRes.categories || [])
        setForm({
          categoriesAllowed: found.categoriesAllowed || null,
          requiresApproval: found.requiresApproval,
          canEditOwnPosts: found.canEditOwnPosts,
          allowImages: found.allowImages,
          allowVideos: found.allowVideos,
          allowLinks: found.allowLinks,
          showEditorName: found.showEditorName,
          postLimitDaily: found.postLimitDaily,
          postLimitWeekly: found.postLimitWeekly,
          postLimitMonthly: found.postLimitMonthly,
          panelAccess: found.panelAccess || [],
          trustLevel: found.trustLevel,
          autoApproveThreshold: found.autoApproveThreshold,
          autoRejectAfterHours: found.autoRejectAfterHours,
          autoApproveAfterHours: found.autoApproveAfterHours,
          level: found.level,
          bioSlug: found.bioSlug || '',
          bioTitle: found.bioTitle || '',
          bioIsActive: found.bioIsActive,
        })
        setPersonalForm({
          name: found.user.name,
          email: found.user.email,
          avatar: found.user.avatar || '',
          bio: found.user.bio || '',
          newPassword: '',
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  // Load metrics on demand
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (activeTab === 'metrics' && !metrics && !metricsLoading && profile) {
      setMetricsLoading(true)
      fetch(`/api/admin/editors/${userId}/metrics`)
        .then(r => r.json())
        .then(d => setMetrics(d))
        .finally(() => setMetricsLoading(false))
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeTab, userId, profile, metrics, metricsLoading])

  // Toggle helpers
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
  const applyTrustPreset = (level: 'JUNIOR' | 'PLENO' | 'SENIOR' | 'MASTER') => {
    const l = EDITOR_LEVELS.find(x => x.value === level)!
    setForm({ ...form, trustLevel: l.minTrust, level })
  }

  // Change detection
  const profileHasChanges = profile && form && JSON.stringify(form) !== JSON.stringify({
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

  const personalHasChanges = profile && personalForm && (
    personalForm.name !== profile.user.name ||
    personalForm.email !== profile.user.email ||
    personalForm.avatar !== (profile.user.avatar || '') ||
    personalForm.bio !== (profile.user.bio || '') ||
    personalForm.newPassword.length > 0
  )

  const hasChanges = profileHasChanges || personalHasChanges

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    try {
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
          toast({ title: 'Erro ao salvar dados pessoais', description: personalData.error, variant: 'destructive' })
          setSaving(false)
          return
        }
      }
      if (profileHasChanges) {
        const res = await fetch(`/api/editor-profile/${profile.userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (data.error) {
          toast({ title: 'Erro ao salvar perfil de editor', description: data.error, variant: 'destructive' })
          setSaving(false)
          return
        }
      }
      toast({
        title: 'Editor atualizado!',
        description: personalForm?.newPassword ? 'Dados, senha e configurações salvos.' : 'Todas as alterações foram salvas com sucesso.',
      })
      setView({ name: 'admin', section: 'editors' })
    } finally { setSaving(false) }
  }

  // Loading state
  if (loading || !profile || !form || !personalForm) {
    return (
      <div className="news-container py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
        <p className="text-zinc-500">Carregando editor...</p>
      </div>
    )
  }

  const level = EDITOR_LEVELS.find(l => l.value === profile.level) || EDITOR_LEVELS[0]
  const levelColors = getColorClasses(level.color)

  return (
    <div className="bg-zinc-50 pb-8">
      {/* === Compact action header === */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => setView({ name: 'admin', section: 'editors' })} className="flex-shrink-0">
              <ChevronLeft className="h-4 w-4 mr-1" /> Editores
            </Button>
            <div className="h-6 w-px bg-zinc-200" />
            <div className="flex items-center gap-2 min-w-0">
              <UserAvatar name={profile.user.name} avatar={profile.user.avatar} size="sm" fallback="icon" />
              <div className="min-w-0">
                <div className="font-bold text-sm text-zinc-900 truncate">{profile.user.name}</div>
                <div className="text-xs text-zinc-500 truncate">{profile.user.email}</div>
              </div>
              <Badge className={cn('text-[10px] uppercase tracking-wider ml-1', levelColors.bg, levelColors.text, levelColors.borderLight)} variant="outline">
                {level.label}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {hasChanges ? (
              <span className="text-xs text-amber-700 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md">
                <AlertCircle className="h-3.5 w-3.5" /> Alterações não salvas
              </span>
            ) : (
              <span className="text-xs text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md">
                <Check className="h-3.5 w-3.5" /> Tudo salvo
              </span>
            )}
            {profile.bioIsActive && profile.bioSlug && (
              <Button variant="outline" size="sm" onClick={() => setView({ name: 'editor-profile', slug: profile.bioSlug })}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ver bio
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges} className="bg-primary">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>
      </div>

      {/* === Page content === */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[232px_1fr] gap-4">
          {/* === Left sidebar (sticky on desktop) === */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
              {/* Editor mini-preview */}
              <div className="p-3.5">
                <div className="flex items-center gap-3">
                  <UserAvatar name={profile.user.name} avatar={profile.user.avatar} size="md" fallback="icon" />
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
              <nav className="p-2 space-y-0.5 border-t border-zinc-100">
                {TABS.map(tab => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors text-left',
                        isActive
                          ? 'bg-zinc-900 font-medium text-white shadow-sm'
                          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-white' : 'text-zinc-400')} />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* === Right content === */}
          <div className="min-w-0">
            {activeTab === 'personal' && <PersonalTab form={personalForm} setForm={setPersonalForm} profile={profile} />}
            {activeTab === 'permissions' && (
              <PermissionsTab
                form={form}
                setForm={setForm}
                categories={categories}
                toggleCategory={toggleCategory}
                selectAll={selectAllCategories}
                deselectAll={deselectAllCategories}
              />
            )}
            {activeTab === 'limits' && <LimitsTab form={form} setForm={setForm} />}
            {activeTab === 'panel' && <PanelTab form={form} togglePanel={togglePanel} />}
            {activeTab === 'trust' && <TrustTab form={form} setForm={setForm} profile={profile} applyPreset={applyTrustPreset} />}
            {activeTab === 'bio' && <BioTab form={form} setForm={setForm} />}
            {activeTab === 'metrics' && <MetricsTab metrics={metrics} loading={metricsLoading} />}
          </div>
        </div>
      </div>
    </div>
  )
}
