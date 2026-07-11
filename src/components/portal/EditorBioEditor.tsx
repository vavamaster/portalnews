'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  ChevronLeft, Save, Loader2, ExternalLink, AlertCircle, Check, Globe,
  Camera, MessageSquare, Eye, Star, TrendingUp, Sparkles,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ImageUpload } from '@/components/admin/ImageUpload'

interface SocialLinks {
  twitter?: string; facebook?: string; instagram?: string; linkedin?: string; website?: string
}

export function EditorBioEditor() {
  const { user, setView } = useAppStore()
  const { toast } = useToast()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    fetch('/api/editor-profile/mine')
      .then(r => r.json())
      .then(data => {
        setProfile(data.profile)
        if (data.profile) {
          setForm({
            bioSlug: data.profile.bioSlug || '',
            bioTitle: data.profile.bioTitle || '',
            bioAvatar: data.profile.bioAvatar || '',
            bioSocialLinks: data.profile.bioSocialLinks || { twitter: '', facebook: '', instagram: '', linkedin: '', website: '' },
            bioShowPhoto: data.profile.bioShowPhoto,
            bioShowBio: data.profile.bioShowBio,
            bioShowCategories: data.profile.bioShowCategories,
            bioShowSocial: data.profile.bioShowSocial,
            bioShowRecentPosts: data.profile.bioShowRecentPosts,
            bioShowStats: data.profile.bioShowStats,
            bioShowRating: data.profile.bioShowRating,
            bioIsActive: data.profile.bioIsActive,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (!user) {
    return (
      <div className="news-container py-16 text-center">
        <AlertCircle className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Faça login</h1>
        <Button onClick={() => setView({ name: 'login' })} className="bg-primary mt-3">Entrar</Button>
      </div>
    )
  }

  if (user.role !== 'EDITOR' && user.role !== 'ADMIN' && user.role !== 'MASTER') {
    return (
      <div className="news-container py-16 text-center">
        <AlertCircle className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Acesso restrito a editores</h1>
        <p className="text-zinc-600 mb-4">Apenas editores podem configurar uma bio pública.</p>
        <Button onClick={() => setView({ name: 'home' })} className="bg-primary">Voltar ao início</Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="news-container py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
        <p className="text-zinc-500">Carregando perfil...</p>
      </div>
    )
  }

  if (!profile || !form) {
    return (
      <div className="news-container py-16 text-center">
        <AlertCircle className="h-12 w-12 text-amber-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Perfil de editor não encontrado</h1>
        <p className="text-zinc-600 mb-4">Você ainda não tem um perfil de editor configurado.</p>
        <Button onClick={() => setView({ name: 'profile' })} className="bg-primary">Voltar ao perfil</Button>
      </div>
    )
  }

  const handleSave = async () => {
    // Validate slug format
    if (form.bioSlug && !/^[a-z0-9-]+$/.test(form.bioSlug)) {
      toast({ title: 'Slug inválido', description: 'Use apenas letras minúsculas, números e hífens.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/editor-profile/mine', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        toast({ title: 'Bio atualizada!', description: 'Suas configurações foram salvas.' })
        setProfile(data.profile)
      }
    } finally { setSaving(false) }
  }

  const setSocial = (key: keyof SocialLinks, value: string) => {
    setForm({ ...form, bioSocialLinks: { ...form.bioSocialLinks, [key]: value } })
  }

  return (
    <div className="news-container py-6 animate-fade-in max-w-4xl">
      <button onClick={() => setView({ name: 'profile' })} className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-primary mb-4">
        <ChevronLeft className="h-4 w-4" /> Voltar ao perfil
      </button>

      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-black text-3xl text-zinc-900 flex items-center gap-2">
            <Globe className="h-7 w-7 text-cyan-600" /> Minha Bio Pública
          </h1>
          <p className="text-zinc-600 text-sm mt-1">
            Configure como você aparece na página <button onClick={() => setView({ name: 'editors' })} className="text-primary underline">/editores</button> e na sua URL pública.
          </p>
        </div>
        {form.bioIsActive && form.bioSlug && (
          <Button variant="outline" onClick={() => setView({ name: 'editor-profile', slug: form.bioSlug })}>
            <ExternalLink className="h-4 w-4 mr-2" /> Ver bio pública
          </Button>
        )}
      </div>

      {/* Visibility */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-600" /> Visibilidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-md">
            <div>
              <div className="font-medium text-sm">Bio ativa na listagem pública</div>
              <div className="text-xs text-zinc-500">{form.bioIsActive ? 'Aparece em /editores para todos os visitantes.' : 'Não aparece na listagem pública.'}</div>
            </div>
            <Switch checked={form.bioIsActive} onCheckedChange={(v) => setForm({ ...form, bioIsActive: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Identity */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600" /> Identidade pública
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Slug da URL pública</Label>
              <Input
                value={form.bioSlug}
                onChange={(e) => setForm({ ...form, bioSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                placeholder="ex: joao-silva"
                className="mt-1 font-mono text-sm"
              />
              {form.bioSlug && (
                <p className="text-xs text-cyan-700 mt-1 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  URL: /editores/<span className="font-mono">{form.bioSlug}</span>
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Título / Cargo</Label>
              <Input
                value={form.bioTitle}
                onChange={(e) => setForm({ ...form, bioTitle: e.target.value })}
                placeholder="ex: Editor de Política"
                className="mt-1"
                maxLength={100}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Avatar da bio (opcional — sobrepõe o avatar do perfil)</Label>
            <ImageUpload
              value={form.bioAvatar}
              onChange={(url) => setForm({ ...form, bioAvatar: url })}
              placeholder="URL da imagem ou faça upload"
            />
          </div>
        </CardContent>
      </Card>

      {/* Social links */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" /> Redes sociais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Twitter / X</Label>
              <Input
                value={form.bioSocialLinks?.twitter || ''}
                onChange={(e) => setSocial('twitter', e.target.value)}
                placeholder="https://twitter.com/..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Facebook</Label>
              <Input
                value={form.bioSocialLinks?.facebook || ''}
                onChange={(e) => setSocial('facebook', e.target.value)}
                placeholder="https://facebook.com/..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Instagram</Label>
              <Input
                value={form.bioSocialLinks?.instagram || ''}
                onChange={(e) => setSocial('instagram', e.target.value)}
                placeholder="https://instagram.com/..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">LinkedIn</Label>
              <Input
                value={form.bioSocialLinks?.linkedin || ''}
                onChange={(e) => setSocial('linkedin', e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Website pessoal</Label>
              <Input
                value={form.bioSocialLinks?.website || ''}
                onChange={(e) => setSocial('website', e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visibility toggles */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-emerald-600" /> O que mostrar na bio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow label="Foto" description="Exibe seu avatar na bio." checked={form.bioShowPhoto} onChange={(v) => setForm({ ...form, bioShowPhoto: v })} />
          <ToggleRow label="Biografia" description="Exibe o texto bio do seu perfil de usuário." checked={form.bioShowBio} onChange={(v) => setForm({ ...form, bioShowBio: v })} />
          <ToggleRow label="Categorias" description="Mostra em quais categorias você publica." checked={form.bioShowCategories} onChange={(v) => setForm({ ...form, bioShowCategories: v })} />
          <ToggleRow label="Redes sociais" description="Mostra links para suas redes." checked={form.bioShowSocial} onChange={(v) => setForm({ ...form, bioShowSocial: v })} />
          <ToggleRow label="Posts recentes" description="Lista suas últimas 6 matérias publicadas." checked={form.bioShowRecentPosts} onChange={(v) => setForm({ ...form, bioShowRecentPosts: v })} />
          <ToggleRow label="Estatísticas" description="Mostra total de posts, aprovações, etc." checked={form.bioShowStats} onChange={(v) => setForm({ ...form, bioShowStats: v })} />
          <ToggleRow label="Avaliação de leitores" description="Mostra notas e comentários dados pelos leitores." checked={form.bioShowRating} onChange={(v) => setForm({ ...form, bioShowRating: v })} />
        </CardContent>
      </Card>

      {/* Stats preview */}
      <Card className="mb-4 bg-zinc-50/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" /> Suas estatísticas atuais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <StatBox icon={Check} value={profile.totalApproved} label="Aprovações" color="emerald" />
            <StatBox icon={AlertCircle} value={profile.totalRejected} label="Reprovações" color="red" />
            <StatBox icon={Star} value={profile.trustLevel} label="Trust Level" color="amber" />
            <StatBox icon={Sparkles} value={profile.consecutiveApprovals} label="Streak" color="purple" />
          </div>
        </CardContent>
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-4 bg-white border border-zinc-200 rounded-lg p-3 shadow-lg flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          {profile.bioSlug ? (
            <>Bio ativa em <code className="bg-zinc-100 px-1 rounded">/editores/{profile.bioSlug}</code></>
          ) : (
            <span className="text-amber-700">Defina um slug para ativar sua bio pública.</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView({ name: 'profile' })}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar bio
          </Button>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md hover:bg-zinc-50">
      <div>
        <div className="text-sm font-medium text-zinc-900">{label}</div>
        <div className="text-xs text-zinc-500">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function StatBox({ icon: Icon, value, label, color }: { icon: any; value: number; label: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return (
    <div className={`rounded-md p-3 border ${colors[color]}`}>
      <Icon className="h-4 w-4 mx-auto opacity-70 mb-1" />
      <div className="text-2xl font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
    </div>
  )
}
