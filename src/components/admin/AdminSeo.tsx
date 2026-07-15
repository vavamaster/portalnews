'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ColorPicker } from '@/components/ui/color-picker'
import { Switch } from '@/components/ui/switch'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, getColorClasses } from '@/lib/utils'
import {
  Save, Loader2, Search, Share2, Coins, CloudSun, Image as ImageIcon, Upload, Palette,
  ShieldCheck, KeyRound, RefreshCw, CheckCircle2, AlertCircle, Clock, ExternalLink,
  AlertTriangle, Lightbulb, LayoutTemplate, SlidersHorizontal, Type, Megaphone, MousePointerClick,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { notifyPortalUpdate } from '@/lib/portal-sync'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { useApiError } from '@/hooks/use-api-error'
import {
  DEFAULT_HEADER_THEME,
  FONT_FAMILY_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  BUTTON_SIZE_PRESETS,
} from '@/lib/header-theme'

const FIELDS = [
  { key: 'site_name', label: 'Nome do Site (global)', section: 'Geral', type: 'text', required: true },
  { key: 'site_tagline', label: 'Slogan / Tagline', section: 'Geral', type: 'text' },
  { key: 'site_url', label: 'URL do Site', section: 'Geral', type: 'text', required: true },
  { key: 'site_description', label: 'Descrição (meta tag)', section: 'Geral', type: 'textarea' },
  { key: 'site_keywords', label: 'Palavras-chave (meta)', section: 'Geral', type: 'text' },
  { key: 'site_about', label: 'Texto Sobre o Portal (página /sobre)', section: 'Geral', type: 'textarea' },
  { key: 'site_city', label: 'Cidade de cobertura', section: 'Geral', type: 'text' },
  { key: 'site_state', label: 'Estado (UF)', section: 'Geral', type: 'text' },
  { key: 'google_analytics_id', label: 'Google Analytics ID', section: 'Geral', type: 'text' },
  // site_logo, site_logo_dark, logo_style, logo_size, header_template, primary_color, secondary_color,
  // accent_color, header_bg_color, header_text_color, nav_bg_color → ALL in "Header & Logo" tab
  { key: 'site_favicon', label: 'Favicon (16x16 ou 32x32 .ico/.png)', section: 'Aparência', type: 'text' },
  { key: 'og_image', label: 'OpenGraph Image (1200x630)', section: 'Aparência', type: 'text' },
  { key: 'twitter_card', label: 'Twitter Card Type', section: 'Aparência', type: 'text' },
  { key: 'twitter_handle', label: 'Twitter Handle (@seu_site)', section: 'Aparência', type: 'text' },
  { key: 'fb_app_id', label: 'Facebook App ID', section: 'Aparência', type: 'text' },
  { key: 'footer_about', label: 'Texto do Rodapé (descrição do portal)', section: 'Aparência', type: 'textarea' },
  { key: 'footer_address', label: 'Endereço (rodapé)', section: 'Aparência', type: 'text' },
  { key: 'footer_phone', label: 'Telefone (rodapé)', section: 'Aparência', type: 'text' },
  { key: 'footer_email', label: 'Email (rodapé)', section: 'Aparência', type: 'text' },
  { key: 'footer_cnpj', label: 'CNPJ (rodapé)', section: 'Aparência', type: 'text' },
  { key: 'facebook_url', label: 'Facebook URL', section: 'Redes Sociais', type: 'text' },
  { key: 'instagram_url', label: 'Instagram URL', section: 'Redes Sociais', type: 'text' },
  { key: 'twitter_url', label: 'X (Twitter) URL', section: 'Redes Sociais', type: 'text' },
  { key: 'youtube_url', label: 'YouTube URL', section: 'Redes Sociais', type: 'text' },
  { key: 'whatsapp_url', label: 'WhatsApp URL', section: 'Redes Sociais', type: 'text' },
  { key: 'points_per_read', label: 'Pontos por leitura', section: 'Pontos & Créditos', type: 'number' },
  { key: 'max_reads_per_post', label: 'Máx. pontos por post (leitura)', section: 'Pontos & Créditos', type: 'number' },
  { key: 'points_per_reaction', label: 'Pontos por reação', section: 'Pontos & Créditos', type: 'number' },
  { key: 'max_reactions_per_post', label: 'Máx. pontos por post (reação)', section: 'Pontos & Créditos', type: 'number' },
  { key: 'credits_conversion_rate', label: 'Pontos por crédito (conversão)', section: 'Pontos & Créditos', type: 'number' },
  { key: 'free_ad_cost_credits', label: 'Custo em créditos (anúncio grátis)', section: 'Pontos & Créditos', type: 'number' },
  { key: 'impressions_per_credit', label: 'Impressões por crédito', section: 'Pontos & Créditos', type: 'number' },
  { key: 'weather_default_city', label: 'Cidade padrão', section: 'Previsão do Tempo', type: 'text' },
  { key: 'weather_default_lat', label: 'Latitude', section: 'Previsão do Tempo', type: 'text' },
  { key: 'weather_default_lon', label: 'Longitude', section: 'Previsão do Tempo', type: 'text' },
]

const TABS = [
  { id: 'Geral', icon: Search },
  { id: 'Licença', icon: ShieldCheck },
  { id: 'Aparência', icon: Palette },
  { id: 'Header & Logo', icon: LayoutTemplate },
  { id: 'Header Theme', icon: SlidersHorizontal },
  { id: 'Redes Sociais', icon: Share2 },
  { id: 'Pontos & Créditos', icon: Coins },
  { id: 'Previsão do Tempo', icon: CloudSun },
]

// Required fields for the portal to be considered "configured"
const REQUIRED_KEYS = ['site_name', 'site_url']

// Highly recommended fields — shown in the setup banner if empty
const RECOMMENDED_KEYS = ['site_city', 'site_state', 'site_logo', 'header_template', 'weather_default_city', 'weather_default_lat', 'weather_default_lon']

export function AdminSeo() {
  const { toast } = useToast()
  const apiError = useApiError()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('Geral')
  const [showSetupBanner, setShowSetupBanner] = useState(false)

  useEffect(() => {
    fetch('/api/seo')
      .then(r => r.json())
      .then(data => {
        setSettings(data.settings || {})
        setLoading(false)
      })
  }, [])

  // Check if any required/recommended fields are missing → show banner
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (loading) return
    const missing = [...REQUIRED_KEYS, ...RECOMMENDED_KEYS].filter(k => !settings[k]?.trim())
    setShowSetupBanner(missing.length > 0)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [settings, loading])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        toast({ title: 'Configurações salvas!' })
        setSettings(data.settings || settings)
        // Notify portal (same tab) + other tabs that SEO was updated
        notifyPortalUpdate('seo')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (file: File, key: string) => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/upload', { method: 'POST', body: fd })
    const d = await r.json()
    if (d.error) { apiError(d.error, 'Erro no upload'); return }
    setSettings({ ...settings, [key]: d.url })
    toast({ title: 'Upload concluído!' })
  }

  if (loading) return <LoadingSpinner className="py-0" />

  const tabFields = FIELDS.filter(f => f.section === activeTab)
  const missingRequired = REQUIRED_KEYS.filter(k => !settings[k]?.trim())
  const missingRecommended = RECOMMENDED_KEYS.filter(k => !settings[k]?.trim())

  return (
    <div className="space-y-4">
      {/* === Setup banner (shown when required/recommended fields are missing) === */}
      {showSetupBanner && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-amber-400 text-white p-2 rounded-lg flex-shrink-0">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-amber-900 text-sm">Configure seu portal para deixá-lo totalmente funcional</div>
              <p className="text-xs text-amber-800 mt-1">
                Alguns campos essenciais ainda estão vazios. Preencha-os para que o portal funcione corretamente.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {missingRequired.map(k => {
                  const field = FIELDS.find(f => f.key === k)
                  return (
                    <button
                      key={k}
                      onClick={() => setActiveTab(field?.section || 'Geral')}
                      className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-2 py-1.5 hover:bg-red-100 transition-colors text-left"
                    >
                      <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                      <span className="text-red-700"><strong>Obrigatório:</strong> {field?.label || k}</span>
                    </button>
                  )
                })}
                {missingRecommended.map(k => {
                  const field = FIELDS.find(f => f.key === k)
                  return (
                    <button
                      key={k}
                      onClick={() => setActiveTab(field?.section || 'Geral')}
                      className="flex items-center gap-2 bg-white border border-amber-200 rounded px-2 py-1.5 hover:bg-amber-50 transition-colors text-left"
                    >
                      <Lightbulb className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      <span className="text-amber-800"><strong>Recomendado:</strong> {field?.label || k}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === Tabs === */}
      <div className="flex items-center gap-1 border-b border-zinc-200 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px whitespace-nowrap',
                isActive ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-zinc-800'
              )}
              style={{ fontWeight: isActive ? 600 : 400 }}
            >
              <Icon className="h-4 w-4" /> {tab.id}
            </button>
          )
        })}
      </div>

      {/* === Save button === */}
      <div className="flex items-center justify-end">
        <Button onClick={handleSave} className="bg-primary" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      {/* === Active tab fields === */}
      {activeTab === 'Licença' ? (
        <LicenseSection settings={settings} setSettings={setSettings} />
      ) : activeTab === 'Aparência' ? (
        <AppearanceSection settings={settings} setSettings={setSettings} tabFields={tabFields} handleUpload={handleUpload} />
      ) : activeTab === 'Header & Logo' ? (
        <HeaderLogoSection settings={settings} setSettings={setSettings} handleUpload={handleUpload} />
      ) : activeTab === 'Header Theme' ? (
        <HeaderThemeSection settings={settings} setSettings={setSettings} />
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
          {tabFields.map(f => (
            <div key={f.key}>
              <Label className="text-sm font-medium flex items-center gap-1">
                {f.label}
                {(f as any).required && <span className="text-red-500">*</span>}
              </Label>
              {f.type === 'textarea' ? (
                <Textarea
                  value={settings[f.key] || ''}
                  onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                  className="mt-1" rows={3}
                />
              ) : (
                <div className="flex gap-2 mt-1">
                  <Input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={settings[f.key] || ''}
                    onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                  />
                  {(f.key === 'og_image' || f.key === 'site_favicon') && (
                    <label className="cursor-pointer flex-shrink-0">
                      <input
                        type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file, f.key) }}
                      />
                      <span className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-zinc-200 hover:bg-zinc-50 text-sm gap-1">
                        <Upload className="h-4 w-4" /> Upload
                      </span>
                    </label>
                  )}
                </div>
              )}
              {/* Preview for image fields */}
              {(f.key === 'og_image' || f.key === 'site_favicon') && settings[f.key] && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={settings[f.key]} alt="Preview" className={cn('rounded border border-zinc-200', f.key === 'og_image' ? 'h-16 w-32 object-cover' : 'h-12 w-12 object-contain')} />
                  <span className="text-xs text-zinc-400">Preview</span>
                </div>
              )}
              {/* Helper text */}
              {f.key === 'site_city' && (
                <p className="text-xs text-zinc-400 mt-1">Usada em todo o portal: header, footer, IA, SEO, etc.</p>
              )}
              {(f.key === 'weather_default_lat' || f.key === 'weather_default_lon') && (
                <p className="text-xs text-zinc-400 mt-1">Use coordenadas decimais (ex: -16.9556). Você pode obter em <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Maps</a>.</p>
              )}
              <p className="text-xs text-zinc-400 mt-1">Chave: <code className="bg-zinc-100 px-1 rounded">{f.key}</code></p>
            </div>
          ))}
        </div>
      )}

      {/* === Info card === */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2 text-sm text-blue-900">
          <ImageIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Dica:</strong> A aba <strong>Aparência</strong> permite fazer upload do logo e imagem OpenGraph.
            A imagem OG (1200x630px) aparece quando o site é compartilhado no WhatsApp, Facebook e outras redes.
            A <strong>cor primária</strong> substitui a cor padrão do tema em todo o portal.
          </div>
        </div>
      </div>
    </div>
  )
}

// ============= APPEARANCE SECTION (with visual Color Picker) =============

function AppearanceSection({ settings, setSettings, tabFields, handleUpload }: {
  settings: Record<string, string>
  setSettings: (s: Record<string, string>) => void
  tabFields: any[]
  handleUpload: (file: File, key: string) => void
}) {
  const primaryColor = settings.primary_color || '#2563eb'
  const siteName = settings.site_name || 'Portal de Notícias'

  // All fields in Aparência tab are rendered normally (site_logo and primary_color moved to Header & Logo)
  const tabFieldsToRender = tabFields

  return (
    <div className="space-y-4">
      {/* Info banner — colors moved to Header & Logo tab */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 text-sm">
        <Palette className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <strong className="text-blue-900">Cores do tema movidas</strong>
          <div className="text-blue-700 text-xs mt-0.5">
            As cores do tema (primária, secundária, destaque, header, etc.) e a configuração de logo agora ficam na aba <strong>"Header & Logo"</strong>. Esta aba mantém apenas OpenGraph, Twitter Card e textos do rodapé.
          </div>
        </div>
      </div>

      {/* === Live preview card === */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">Preview ao vivo</div>
        <div className="rounded-lg overflow-hidden border border-zinc-200">
          {/* Preview header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2">
              {settings.site_logo ? (
                <img src={settings.site_logo} alt="logo" className="h-6 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
              ) : (
                <span className="text-white font-black text-sm">{siteName.slice(0, 2).toUpperCase()}</span>
              )}
              <span className="text-white font-bold text-sm hidden sm:inline">{siteName}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-white/80">
              <span>Início</span>
              <span>Notícias</span>
              <span>Contato</span>
            </div>
          </div>
          {/* Preview body with accents */
          }
          <div className="p-4 bg-white">
            <div className="text-[10px] uppercase font-bold mb-1" style={{ color: primaryColor }}>Destaques</div>
            <div className="text-sm font-bold text-zinc-900 mb-1">Título da notícia de exemplo</div>
            <div className="text-xs text-zinc-500 mb-3">Descrição curta da notícia apareceria aqui neste espaço.</div>
            <button
              className="text-[10px] font-semibold px-3 py-1 rounded-md text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Ler mais
            </button>
          </div>
          {/* Preview footer */}
          <div
            className="px-4 py-2 text-[10px] text-white/80"
            style={{ backgroundColor: primaryColor }}
          >
            © 2026 {siteName} — Todos os direitos reservados
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 mt-2">Pré-visualização de como a cor aparece no header, botões e rodapé do portal.</p>
      </div>

      {/* === Primary color picker (visual) === */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Label className="text-sm font-medium flex items-center gap-1">
          <Palette className="h-4 w-4 text-primary" />
          Cor Primária do Portal
        </Label>
        <p className="text-xs text-zinc-500 mt-0.5 mb-3">
          Esta cor substitui a cor padrão do tema em todo o portal: header, botões, links e rodapé.
        </p>
        <ColorPicker
          value={primaryColor}
          onChange={(v) => setSettings({ ...settings, primary_color: v })}
        />
      </div>

      {/* === Other appearance fields === */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
        {tabFieldsToRender.map(f => (
          <div key={f.key}>
            <Label className="text-sm font-medium flex items-center gap-1">
              {f.label}
              {(f as any).required && <span className="text-red-500">*</span>}
            </Label>
            {f.type === 'textarea' ? (
              <Textarea
                value={settings[f.key] || ''}
                onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                className="mt-1" rows={3}
              />
            ) : (
              <div className="flex gap-2 mt-1">
                <Input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={settings[f.key] || ''}
                  onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                />
                {(f.key === 'og_image' || f.key === 'site_favicon') && (
                  <label className="cursor-pointer flex-shrink-0">
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file, f.key) }}
                    />
                    <span className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-zinc-200 hover:bg-zinc-50 text-sm gap-1">
                      <Upload className="h-4 w-4" /> Upload
                    </span>
                  </label>
                )}
              </div>
            )}
            {(f.key === 'og_image' || f.key === 'site_favicon') && settings[f.key] && (
              <div className="mt-2 flex items-center gap-2">
                <img src={settings[f.key]} alt="Preview" className={cn('rounded border border-zinc-200', f.key === 'og_image' ? 'h-16 w-32 object-cover' : 'h-12 w-12 object-contain')} />
                <span className="text-xs text-zinc-400">Preview</span>
              </div>
            )}
            <p className="text-xs text-zinc-400 mt-1">Chave: <code className="bg-zinc-100 px-1 rounded">{f.key}</code></p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============= HEADER & LOGO SECTION (3 templates, logo styles, theme colors) =============

function HeaderLogoSection({ settings, setSettings, handleUpload }: {
  settings: Record<string, string>
  setSettings: (s: Record<string, string>) => void
  handleUpload: (file: File, key: string) => void
}) {
  const headerTemplate = settings.header_template || 'classic'
  const logoStyle = settings.logo_style || 'logo-text'
  const logoSize = settings.logo_size || 'md'

  const templates = [
    { id: 'classic', name: 'Clássico', desc: 'Utility bar + brand + nav + ticker', icon: '📰' },
    { id: 'modern', name: 'Moderno', desc: 'Brand+search+user em linha + nav', icon: '✨' },
    { id: 'minimal', name: 'Minimalista', desc: 'Logo centralizado + hamburger menu', icon: '🎯' },
  ]

  const logoStyles = [
    { id: 'text', name: 'Somente Texto', desc: 'Apenas nome + tagline' },
    { id: 'logo', name: 'Somente Logo', desc: 'Apenas imagem do logo' },
    { id: 'logo-text', name: 'Logo + Texto', desc: 'Logo + nome do site' },
    { id: 'logo-text-subtitle', name: 'Logo + Texto + Subtítulo', desc: 'Logo + nome + tagline' },
  ]

  const logoSizes = [
    { id: 'sm', name: 'Pequeno', height: 'h-7', px: '28px' },
    { id: 'md', name: 'Médio', height: 'h-10', px: '40px' },
    { id: 'lg', name: 'Grande', height: 'h-14', px: '56px' },
    { id: 'xl', name: 'Extra Grande', height: 'h-20', px: '80px' },
  ]

  const colorFields = [
    { key: 'primary_color', label: 'Cor Primária', desc: 'Botões, links ativos, badges' },
    { key: 'secondary_color', label: 'Cor Secundária', desc: 'Acentos, hover, ícones' },
    { key: 'accent_color', label: 'Cor de Destaque', desc: 'CTAs, notificações, badges urgentes' },
    { key: 'header_bg_color', label: 'Fundo do Header', desc: 'Background do cabeçalho' },
    { key: 'header_text_color', label: 'Texto do Header', desc: 'Cor do texto no cabeçalho' },
    { key: 'nav_bg_color', label: 'Fundo da Navegação', desc: 'Background do menu' },
  ]

  const siteName = settings.site_name || 'Portal de Notícias'
  const siteTagline = settings.site_tagline || 'Jornalismo & Verdade'
  const siteLogo = settings.site_logo || ''
  const siteLogoDark = settings.site_logo_dark || ''
  const currentSize = logoSizes.find(s => s.id === logoSize) || logoSizes[1]

  return (
    <div className="space-y-4">
      {/* === Live Preview === */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">Preview ao vivo</div>
        <div className="rounded-lg overflow-hidden border border-zinc-200 shadow-sm">
          {/* Mini header preview */}
          <div
            className="px-4 py-2 flex items-center gap-3"
            style={{
              backgroundColor: settings.header_bg_color || '#ffffff',
              color: settings.header_text_color || '#18181b',
            }}
          >
            {/* Logo preview */}
            {(logoStyle === 'logo' || logoStyle === 'logo-text' || logoStyle === 'logo-text-subtitle') && siteLogo && (
              <img src={siteLogo} alt={siteName} className={cn(currentSize.height, 'w-auto rounded')} />
            )}
            {(logoStyle === 'logo' || logoStyle === 'logo-text' || logoStyle === 'logo-text-subtitle') && !siteLogo && (
              <div
                className={cn(currentSize.height, 'aspect-[2/1] rounded flex items-center justify-center text-white text-xs font-bold')}
                style={{ backgroundColor: settings.primary_color || '#2563eb' }}
              >
                {siteName.slice(0, 2).toUpperCase()}
              </div>
            )}
            {(logoStyle === 'text' || logoStyle === 'logo-text' || logoStyle === 'logo-text-subtitle') && (
              <div className="leading-tight">
                <div className="font-bold text-sm" style={{ color: settings.header_text_color || '#18181b' }}>
                  {siteName}
                </div>
                {logoStyle === 'logo-text-subtitle' && (
                  <div className="text-[9px] uppercase tracking-wider opacity-60">{siteTagline}</div>
                )}
              </div>
            )}
            <div className="flex-1" />
            <div
              className="h-6 px-3 rounded-full text-[10px] flex items-center text-white font-medium"
              style={{ backgroundColor: settings.primary_color || '#2563eb' }}
            >
              Entrar
            </div>
          </div>
          {/* Mini nav preview */}
          <div
            className="px-4 py-1.5 flex items-center gap-3 text-[10px] font-medium border-t"
            style={{
              backgroundColor: settings.nav_bg_color || '#fafafa',
              borderColor: '#f4f4f5',
            }}
          >
            <span style={{ color: settings.primary_color || '#2563eb' }}>Início</span>
            <span style={{ color: settings.header_text_color || '#71717a' }}>Política</span>
            <span style={{ color: settings.header_text_color || '#71717a' }}>Esportes</span>
            <span style={{ color: settings.header_text_color || '#71717a' }}>Cidades</span>
          </div>
        </div>
      </div>

      {/* === Header Template === */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
          <LayoutTemplate className="h-4 w-4 text-primary" />
          Modelo de Header (Topo)
        </Label>
        <p className="text-xs text-zinc-500 mb-3">
          Escolha o layout do cabeçalho do portal. Cada modelo tem comportamento e densidade diferentes.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSettings({ ...settings, header_template: t.id })}
              className={cn(
                'text-left p-3 border-2 rounded-xl transition-all',
                headerTemplate === t.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
              )}
            >
              <div className="text-2xl mb-1">{t.icon}</div>
              <div className="text-sm font-bold text-zinc-900">{t.name}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5 leading-tight">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* === Logo Configuration === */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          Configuração do Logo
        </Label>

        {/* Logo upload */}
        <div>
          <Label className="text-xs font-medium">Imagem do Logo</Label>
          <p className="text-[11px] text-zinc-500 mb-2">
            Recomendado: formato PNG ou SVG com fundo transparente, proporção 2:1 (ex: 200x100px).
          </p>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Input
                value={settings.site_logo || ''}
                onChange={(e) => setSettings({ ...settings, site_logo: e.target.value })}
                placeholder="URL do logo ou faça upload"
              />
            </div>
            <label className="cursor-pointer flex-shrink-0">
              <input
                type="file" accept="image/*" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file, 'site_logo') }}
              />
              <span className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-zinc-200 hover:bg-zinc-50 text-sm gap-1">
                <Upload className="h-4 w-4" /> Upload
              </span>
            </label>
          </div>
          {siteLogo && (
            <div className="mt-2 flex items-center gap-2">
              <img src={siteLogo} alt="Logo" className={cn('h-10 w-auto rounded border border-zinc-200 p-1 bg-white')} />
              <span className="text-xs text-zinc-400">Preview</span>
            </div>
          )}
        </div>

        {/* Dark mode logo upload */}
        <div className="border-t border-zinc-100 pt-4">
          <Label className="text-xs font-medium">Imagem do Logo — modo escuro</Label>
          <p className="text-[11px] text-zinc-500 mb-2">
            Use uma versão clara da marca, em PNG ou SVG transparente. Se ficar vazio, o portal reutiliza o logo principal.
          </p>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Input
                value={settings.site_logo_dark || ''}
                onChange={(e) => setSettings({ ...settings, site_logo_dark: e.target.value })}
                placeholder="URL do logo para fundo escuro ou faça upload"
              />
            </div>
            <label className="cursor-pointer flex-shrink-0">
              <input
                type="file" accept="image/*" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file, 'site_logo_dark') }}
              />
              <span className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-zinc-200 hover:bg-zinc-50 text-sm gap-1">
                <Upload className="h-4 w-4" /> Upload
              </span>
            </label>
          </div>
          <div className="mt-2 rounded-lg bg-zinc-900 border border-zinc-700 min-h-14 px-3 py-2 flex items-center gap-3">
            {(siteLogoDark || siteLogo) ? (
              <img src={siteLogoDark || siteLogo} alt="Logo no modo escuro" className="h-10 w-auto max-w-[220px] object-contain" />
            ) : (
              <span className="text-xs text-zinc-500">Nenhum logo configurado</span>
            )}
            <span className="text-[10px] text-zinc-400">Preview em fundo escuro</span>
          </div>
        </div>

        {/* Logo style */}
        <div>
          <Label className="text-xs font-medium mb-2 block">Estilo do Logo</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {logoStyles.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSettings({ ...settings, logo_style: s.id })}
                className={cn(
                  'text-left p-2 border rounded-lg transition-all',
                  logoStyle === s.id ? 'border-primary bg-primary/5' : 'border-zinc-200 hover:border-zinc-300'
                )}
              >
                <div className="text-xs font-semibold text-zinc-900">{s.name}</div>
                <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Logo size */}
        <div>
          <Label className="text-xs font-medium mb-2 block">Tamanho do Logo</Label>
          <div className="grid grid-cols-4 gap-2">
            {logoSizes.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSettings({ ...settings, logo_size: s.id })}
                className={cn(
                  'p-2 border rounded-lg transition-all text-center',
                  logoSize === s.id ? 'border-primary bg-primary/5' : 'border-zinc-200 hover:border-zinc-300'
                )}
              >
                <div className="text-xs font-semibold text-zinc-900">{s.name}</div>
                <div className="text-[10px] text-zinc-500">{s.px}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* === Theme Colors === */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Palette className="h-4 w-4 text-primary" />
          Cores do Tema (global)
        </Label>
        <p className="text-xs text-zinc-500 mb-4">
          As cores são aplicadas em todo o portal via CSS variables. Use o seletor visual para escolher.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {colorFields.map(field => (
            <div key={field.key}>
              <Label className="text-xs font-medium">{field.label}</Label>
              <p className="text-[10px] text-zinc-400 mb-1.5">{field.desc}</p>
              <ColorPicker
                value={settings[field.key] || defaultColorFor(field.key)}
                onChange={(v) => setSettings({ ...settings, [field.key]: v })}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">
            💡 Dica: use cores com bom contraste. Teste o tema em diferentes páginas após salvar.
          </p>
          <button
            type="button"
            onClick={() => {
              const defaults: Record<string, string> = {
                primary_color: '#2563eb',
                secondary_color: '#0ea5e9',
                accent_color: '#f59e0b',
                header_bg_color: '#ffffff',
                header_text_color: '#18181b',
                nav_bg_color: '#fafafa',
              }
              setSettings({ ...settings, ...defaults })
            }}
            className="text-[11px] text-zinc-500 hover:text-zinc-700 underline"
          >
            Restaurar padrão
          </button>
        </div>
      </div>
    </div>
  )
}

function defaultColorFor(key: string): string {
  const defaults: Record<string, string> = {
    primary_color: '#2563eb',
    secondary_color: '#0ea5e9',
    accent_color: '#f59e0b',
    header_bg_color: '#ffffff',
    header_text_color: '#18181b',
    nav_bg_color: '#fafafa',
  }
  return defaults[key] || '#2563eb'
}

// ============= HEADER THEME SECTION (topbar, nav, ticker, ad fallback, buttons, quotes) =============

type HeaderThemeKey = keyof typeof DEFAULT_HEADER_THEME

function HeaderThemeSection({ settings, setSettings }: {
  settings: Record<string, string>
  setSettings: (s: Record<string, string>) => void
}) {
  // Read a typed value from the settings record (falls back to DEFAULT_HEADER_THEME).
  const get = <K extends HeaderThemeKey>(key: K): string | number | boolean => {
    const v = key === 'nav_bg_color'
      ? (settings.nav_bg_color || settings.header_theme_nav_bg_color)
      : settings[`header_theme_${key}`]
    const fallback = DEFAULT_HEADER_THEME[key]
    if (v === undefined || v === '') return fallback
    if (typeof fallback === 'boolean') return v === 'true'
    if (typeof fallback === 'number') {
      const n = parseFloat(v)
      return isNaN(n) ? fallback : n
    }
    return v
  }

  // Write a value to the settings record under the `header_theme_*` key.
  const set = (key: HeaderThemeKey, value: string | number | boolean) => {
    const next = { ...settings, [`header_theme_${key}`]: String(value) }
    if (key === 'nav_bg_color') next.nav_bg_color = String(value)
    setSettings(next)
  }

  const restoreDefaults = () => {
    const defaults: Record<string, string> = {}
    for (const [k, v] of Object.entries(DEFAULT_HEADER_THEME)) {
      defaults[`header_theme_${k}`] = String(v)
    }
    defaults.nav_bg_color = DEFAULT_HEADER_THEME.nav_bg_color
    setSettings({ ...settings, ...defaults })
  }

  // Convenience typed accessors used by the JSX below.
  const topbarShow = get('topbar_show') as boolean
  const topbarBg = get('topbar_bg_color') as string
  const topbarText = get('topbar_text_color') as string
  const navFontFamily = get('nav_font_family') as string
  const navFontWeight = get('nav_font_weight') as number
  const navFontSize = get('nav_font_size') as number
  const navTextColor = get('nav_text_color') as string
  const navHoverColor = get('nav_hover_color') as string
  const navActiveColor = get('nav_active_color') as string
  const navBgColor = get('nav_bg_color') as string
  const navHeight = get('nav_height') as number
  const breakingLabelText = get('breaking_label_text') as string
  const breakingSpeed = get('breaking_speed') as number
  const breakingBgColor = get('breaking_bg_color') as string
  const breakingTextColor = get('breaking_text_color') as string
  const breakingFontSize = get('breaking_font_size') as number
  const adFallbackEnabled = get('ad_fallback_enabled') as boolean
  const adFallbackText = get('ad_fallback_text') as string
  const adFallbackLinkUrl = get('ad_fallback_link_url') as string
  const adFallbackBgColor = get('ad_fallback_bg_color') as string
  const adFallbackTextColor = get('ad_fallback_text_color') as string
  const adFallbackBorderColor = get('ad_fallback_border_color') as string
  const adFallbackBorderWidth = get('ad_fallback_border_width') as number
  const adFallbackFontSize = get('ad_fallback_font_size') as number
  const adFallbackHeight = get('ad_fallback_height') as number
  const classifiedButtonSize = get('classified_button_size') as string
  const storeButtonSize = get('store_button_size') as string
  const quotesWidgetSize = get('quotes_widget_size') as string

  // Resolved breaking bg (empty = primary color fallback).
  const primaryColor = settings.primary_color || '#2563eb'
  const resolvedBreakingBg = breakingBgColor || primaryColor

  // Font family CSS for preview.
  const navFontCss = FONT_FAMILY_OPTIONS.find(f => f.value === navFontFamily)?.css || 'inherit'

  // Breaking-news "URGENTE" badge classes (color-coded).
  const breakingBadge = getColorClasses('red')

  // Button size options reused for the two-button selectors.
  const buttonSizeOptions: { value: 'compact' | 'default' | 'large'; label: string }[] = [
    { value: 'compact', label: 'Compacto' },
    { value: 'default', label: 'Padrão' },
    { value: 'large', label: 'Grande' },
  ]

  const quotesSizeOptions: { value: 'small' | 'medium' | 'large'; label: string }[] = [
    { value: 'small', label: 'Pequeno' },
    { value: 'medium', label: 'Médio' },
    { value: 'large', label: 'Grande' },
  ]

  return (
    <div className="space-y-4">
      {/* === Header with restore-all button === */}
      <div className="flex items-start justify-between gap-3 bg-white border border-zinc-200 rounded-lg p-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="bg-primary/10 text-primary p-2 rounded-lg flex-shrink-0">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm text-zinc-900">Personalize o cabeçalho completo</div>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
              Ajuste a barra superior, menu, ticker de notícias, fallback de anúncios e botões de ação.
              As configurações são salvas como <code className="bg-zinc-100 px-1 rounded text-[11px]">header_theme_*</code> no banco.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={restoreDefaults} className="flex-shrink-0">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Restaurar Padrão
        </Button>
      </div>

      {/* === Live preview === */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">Preview ao vivo</div>
        <div className="rounded-lg overflow-hidden border border-zinc-200 shadow-sm">
          {/* Topbar */}
          {topbarShow && (
            <div
              className="px-4 py-1.5 flex items-center justify-between text-[10px]"
              style={{ backgroundColor: topbarBg, color: topbarText }}
            >
              <span>{settings.site_city || 'São Paulo'}, {settings.site_state || 'SP'}</span>
              <span className="opacity-80">{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          )}
          {/* Nav preview */}
          <div
            className="px-4 flex items-center gap-4 border-b"
            style={{
              backgroundColor: navBgColor || '#ffffff',
              height: `${navHeight}px`,
              fontFamily: navFontCss,
              fontWeight: navFontWeight,
              fontSize: `${navFontSize}px`,
              color: navTextColor,
              borderBottomColor: '#f4f4f5',
            }}
          >
            <span style={{ color: navActiveColor, fontWeight: navFontWeight }}>Início</span>
            <span className="hover:underline">Política</span>
            <span className="hover:underline">Esportes</span>
            <span className="hover:underline">Cidades</span>
          </div>
          {/* Breaking ticker preview */}
          <div
            className="px-2 flex items-center gap-2 overflow-hidden"
            style={{
              backgroundColor: resolvedBreakingBg,
              color: breakingTextColor,
              fontSize: `${breakingFontSize}px`,
              height: `${Math.max(breakingFontSize + 12, 24)}px`,
            }}
          >
            <span
              className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]',
                    breakingBadge.bgSolid, 'text-white'
              )}
            >
              {breakingLabelText || 'URGENTE'}
            </span>
            <span className="truncate opacity-90">Última atualização disponível — arraste para ver mais →</span>
          </div>
          {/* Ad fallback preview */}
          {adFallbackEnabled && (
            <div
              className="flex items-center justify-center"
              style={{
                backgroundColor: adFallbackBgColor,
                color: adFallbackTextColor,
                border: `${adFallbackBorderWidth}px solid ${adFallbackBorderColor}`,
                fontSize: `${adFallbackFontSize}px`,
                height: `${adFallbackHeight}px`,
              }}
            >
              {adFallbackText || 'Anuncie Aqui'}
            </div>
          )}
        </div>
      </div>

      {/* === Group 1: Barra Superior === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-primary" /> Barra Superior
          </CardTitle>
          <CardDescription>Barra de utilidades no topo do cabeçalho (data, cidade, links rápidos)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="header_theme_topbar_show" className="text-sm font-medium">Exibir barra superior</Label>
              <p className="text-[11px] text-zinc-500 mt-0.5">Ative/desative a barra de utilidades no topo do portal.</p>
            </div>
            <Switch
              id="header_theme_topbar_show"
              checked={topbarShow}
              onCheckedChange={(v) => set('topbar_show', v)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorField
              label="Cor de fundo"
              value={topbarBg}
              onChange={(v) => set('topbar_bg_color', v)}
            />
            <ColorField
              label="Cor do texto"
              value={topbarText}
              onChange={(v) => set('topbar_text_color', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* === Group 2: Navegação === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" /> Navegação (Menu)
          </CardTitle>
          <CardDescription>Tipografia e cores do menu principal do cabeçalho</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-medium">Fonte dos links</Label>
              <p className="text-[10px] text-zinc-400 mb-1.5">Família tipográfica usada nos itens de menu.</p>
              <Select value={navFontFamily} onValueChange={(v) => set('nav_font_family', v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Fonte" /></SelectTrigger>
                <SelectContent>
                  {FONT_FAMILY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span style={{ fontFamily: opt.css }}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Peso da fonte</Label>
              <p className="text-[10px] text-zinc-400 mb-1.5">Espessura dos caracteres no menu.</p>
              <Select
                value={String(navFontWeight)}
                onValueChange={(v) => set('nav_font_weight', parseInt(v, 10))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Peso" /></SelectTrigger>
                <SelectContent>
                  {FONT_WEIGHT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      <span style={{ fontWeight: opt.value }}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NumberField
              label="Tamanho da fonte (px)"
              value={navFontSize}
              onChange={(v) => set('nav_font_size', v)}
              min={10}
              max={24}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorField
              label="Cor do texto"
              value={navTextColor}
              onChange={(v) => set('nav_text_color', v)}
            />
            <ColorField
              label="Cor do hover"
              value={navHoverColor}
              onChange={(v) => set('nav_hover_color', v)}
            />
            <ColorField
              label="Cor ativo (página atual)"
              value={navActiveColor}
              onChange={(v) => set('nav_active_color', v)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorField
              label="Cor de fundo do menu"
              value={navBgColor}
              onChange={(v) => set('nav_bg_color', v)}
              allowEmpty
              emptyHint="Vazio = transparente (herda do header)"
            />
            <NumberField
              label="Altura do menu (px)"
              value={navHeight}
              onChange={(v) => set('nav_height', v)}
              min={36}
              max={60}
            />
          </div>
        </CardContent>
      </Card>

      {/* === Group 3: Breaking News === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" /> Breaking News (Ticker)
          </CardTitle>
          <CardDescription>Faixa de notícias urgentes que percorre o cabeçalho</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Texto do rótulo (ex: URGENTE)</Label>
              <p className="text-[10px] text-zinc-400 mb-1.5">Aparece à esquerda do ticker em destaque.</p>
              <Input
                value={breakingLabelText}
                onChange={(e) => set('breaking_label_text', e.target.value)}
                placeholder="URGENTE"
              />
            </div>
            <NumberField
              label="Velocidade (segundos)"
              value={breakingSpeed}
              onChange={(v) => set('breaking_speed', v)}
              min={10}
              max={300}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorField
              label="Cor de fundo (vazio = cor primária)"
              value={breakingBgColor}
              onChange={(v) => set('breaking_bg_color', v)}
              allowEmpty
              emptyHint="Vazio = usa a cor primária do portal"
            />
            <ColorField
              label="Cor do texto"
              value={breakingTextColor}
              onChange={(v) => set('breaking_text_color', v)}
            />
            <NumberField
              label="Tamanho da fonte (px)"
              value={breakingFontSize}
              onChange={(v) => set('breaking_font_size', v)}
              min={10}
              max={18}
            />
          </div>
        </CardContent>
      </Card>

      {/* === Group 4: Fallback de Anúncios === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-primary" /> Fallback de Anúncios ("Anuncie Aqui")
          </CardTitle>
          <CardDescription>Card exibido quando um slot de anúncio está vazio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="header_theme_ad_fallback_enabled" className="text-sm font-medium">
                Ativar "Anuncie Aqui" quando não há anúncios
              </Label>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Mostra um placeholder clicável nos espaços de publicidade vazios.
              </p>
            </div>
            <Switch
              id="header_theme_ad_fallback_enabled"
              checked={adFallbackEnabled}
              onCheckedChange={(v) => set('ad_fallback_enabled', v)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Texto exibido</Label>
              <Input
                value={adFallbackText}
                onChange={(e) => set('ad_fallback_text', e.target.value)}
                placeholder="Anuncie Aqui"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Link ao clicar (WhatsApp ou URL, vazio = sem link)</Label>
              <Input
                value={adFallbackLinkUrl}
                onChange={(e) => set('ad_fallback_link_url', e.target.value)}
                placeholder="https://wa.me/55..."
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorField
              label="Cor de fundo"
              value={adFallbackBgColor}
              onChange={(v) => set('ad_fallback_bg_color', v)}
            />
            <ColorField
              label="Cor do texto"
              value={adFallbackTextColor}
              onChange={(v) => set('ad_fallback_text_color', v)}
            />
            <ColorField
              label="Cor da borda"
              value={adFallbackBorderColor}
              onChange={(v) => set('ad_fallback_border_color', v)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberField
              label="Largura da borda (px, 0 = sem borda)"
              value={adFallbackBorderWidth}
              onChange={(v) => set('ad_fallback_border_width', v)}
              min={0}
              max={5}
            />
            <NumberField
              label="Tamanho da fonte (px)"
              value={adFallbackFontSize}
              onChange={(v) => set('ad_fallback_font_size', v)}
              min={11}
              max={20}
            />
            <NumberField
              label="Altura (px)"
              value={adFallbackHeight}
              onChange={(v) => set('ad_fallback_height', v)}
              min={30}
              max={120}
            />
          </div>
        </CardContent>
      </Card>

      {/* === Group 5: Botões de Ação === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-primary" /> Botões de Ação
          </CardTitle>
          <CardDescription>Tamanho dos botões de classificados e do botão "Anuncie Grátis"</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Classified button size */}
          <div>
            <Label className="text-xs font-medium">Tamanho dos botões de classificados</Label>
            <p className="text-[10px] text-zinc-400 mb-1.5">Usado nos botões de ação dos classificados.</p>
            <Select
              value={classifiedButtonSize}
              onValueChange={(v) => set('classified_button_size', v)}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {buttonSizeOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Visual preview of each size */}
            <div className="mt-3 flex items-end gap-4 bg-zinc-50 border border-zinc-200 rounded-md p-3 flex-wrap">
              {buttonSizeOptions.map(o => {
                const preset = BUTTON_SIZE_PRESETS[o.value]
                const isActive = classifiedButtonSize === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => set('classified_button_size', o.value)}
                    className={cn(
                      'inline-flex items-center rounded-md bg-primary text-white font-medium transition-all',
                      preset.padding, preset.fontSize, preset.height,
                      isActive ? 'ring-2 ring-offset-1 ring-primary' : 'opacity-70 hover:opacity-100'
                    )}
                  >
                    Anuncie
                  </button>
                )
              })}
            </div>
          </div>

          {/* Store button size */}
          <div>
            <Label className="text-xs font-medium">Tamanho do botão "Anuncie Grátis"</Label>
            <p className="text-[10px] text-zinc-400 mb-1.5">Botão de CTA principal para anúncios grátis.</p>
            <Select
              value={storeButtonSize}
              onValueChange={(v) => set('store_button_size', v)}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {buttonSizeOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-3 flex items-end gap-4 bg-zinc-50 border border-zinc-200 rounded-md p-3 flex-wrap">
              {buttonSizeOptions.map(o => {
                const preset = BUTTON_SIZE_PRESETS[o.value]
                const isActive = storeButtonSize === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => set('store_button_size', o.value)}
                    className={cn(
                      'inline-flex items-center rounded-md bg-primary text-white font-medium transition-all',
                      preset.padding, preset.fontSize, preset.height,
                      isActive ? 'ring-2 ring-offset-1 ring-primary' : 'opacity-70 hover:opacity-100'
                    )}
                  >
                    Anuncie Grátis
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === Group 6: Cotações === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" /> Cotações
          </CardTitle>
          <CardDescription>Tamanho do widget de cotações (dólar, euro, etc.)</CardDescription>
        </CardHeader>
        <CardContent>
          <Label className="text-xs font-medium">Tamanho do widget de cotações</Label>
          <p className="text-[10px] text-zinc-400 mb-1.5">Controla densidade e tamanho da fonte das cotações.</p>
          <Select
            value={quotesWidgetSize}
            onValueChange={(v) => set('quotes_widget_size', v)}
          >
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {quotesSizeOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Visual size preview */}
          <div className="mt-3 flex items-end gap-4 bg-zinc-50 border border-zinc-200 rounded-md p-3 flex-wrap">
            {quotesSizeOptions.map(o => {
              const isActive = quotesWidgetSize === o.value
              const previewHeight = o.value === 'small' ? 'h-7' : o.value === 'medium' ? 'h-8' : 'h-10'
              const previewFont = o.value === 'small' ? 'text-[10px]' : o.value === 'medium' ? 'text-xs' : 'text-sm'
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set('quotes_widget_size', o.value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md bg-white border border-zinc-300 px-2 transition-all',
                    previewHeight, previewFont,
                    isActive ? 'ring-2 ring-offset-1 ring-primary border-primary' : 'opacity-70 hover:opacity-100'
                  )}
                >
                  <span className="font-semibold text-emerald-600">USD</span>
                  <span className="text-zinc-700">R$ 5,12</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* === Info card === */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2 text-sm text-blue-900">
          <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Dica:</strong> As configurações desta seção são armazenadas com o prefixo{' '}
            <code className="bg-blue-100 px-1 rounded">header_theme_</code> e aplicadas em tempo real no cabeçalho do portal.
            Use o botão <strong>Restaurar Padrão</strong> no topo para voltar aos valores de fábrica.
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Reusable color field with hex preview + optional "clear" link for optional colors.
 * Uses the existing ColorPicker component (which already shows the hex value).
 */
function ColorField({ label, value, onChange, allowEmpty = false, emptyHint }: {
  label: string
  value: string
  onChange: (v: string) => void
  allowEmpty?: boolean
  emptyHint?: string
}) {
  return (
    <div>
      <Label className="text-xs font-medium">{label}</Label>
      {allowEmpty && (
        <p className={cn('text-[10px] mb-1.5', value ? 'text-zinc-400' : 'text-amber-600')}>
          {value ? 'Vazio = usa padrão.' : `⚠ ${emptyHint || 'Vazio = usa valor padrão'}`}
        </p>
      )}
      <div className="flex items-center gap-2 mt-1">
        <ColorPicker value={value || '#2563eb'} onChange={onChange} />
        {allowEmpty && value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] text-zinc-500 hover:text-zinc-700 underline"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}

/** Reusable number input with min/max hints. */
function NumberField({ label, value, onChange, min, max, suffix }: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <div>
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const n = parseFloat(e.target.value)
            if (!isNaN(n)) onChange(n)
          }}
          className="w-24"
        />
        {suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
      </div>
      {min !== undefined && max !== undefined && (
        <p className="text-[10px] text-zinc-400 mt-0.5">Faixa: {min}–{max}</p>
      )}
    </div>
  )
}

// ============= LICENSE SECTION =============

interface LicenseStatus {
  hasKey: boolean
  key: string // masked: VS-ABCD-••••-1234
  raw: string
  valid: boolean
  status: string
  message: string
  data: {
    client_id?: number
    product?: string
    plan?: string
    max_users?: number
    is_trial?: boolean
    trial_ends_at?: string | null
    expires_at?: string
    domain?: string
  } | null
  checkedAt: string | null
  stale: boolean
}

function LicenseSection({ settings, setSettings }: {
  settings: Record<string, string>
  setSettings: (s: Record<string, string>) => void
}) {
  const { toast } = useToast()
  const apiError = useApiError()
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [validating, setValidating] = useState(false)
  // Local input value — formatted with VS-XXXX-XXXX-XXXX mask
  const [inputValue, setInputValue] = useState('')

  // Load license status on mount
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const r = await fetch('/api/license/status')
      const data = await r.json()
      setStatus(data)
      // Sync the input with the stored raw key
      if (data.raw) setInputValue(data.raw)
    } catch (e) {
      console.error('License status error:', e)
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadStatus()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadStatus])

  // Mask the input as the user types: VS-XXXX-XXXX-XXXX
  const maskKey = (raw: string): string => {
    // Strip everything except alphanumeric
    const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    // Must start with VS
    let result = clean
    if (!result.startsWith('VS')) {
      // If the user typed something that doesn't start with VS, prepend VS
      if (result.length > 0 && /^[A-Z0-9]+$/.test(result)) {
        result = 'VS' + result
      } else {
        result = 'VS'
      }
    }
    // Take the 12 chars after VS
    const rest = result.slice(2, 14)
    // Group into 4-4-4
    const groups: string[] = []
    if (rest.length > 0) groups.push(rest.slice(0, 4))
    if (rest.length > 4) groups.push(rest.slice(4, 8))
    if (rest.length > 8) groups.push(rest.slice(8, 12))
    return 'VS' + (groups.length > 0 ? '-' + groups.join('-') : '')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskKey(e.target.value)
    setInputValue(masked)
    // Update the settings state with the raw (unmasked) value
    setSettings({ ...settings, license_key: masked })
  }

  // Save the key + immediately validate
  const handleValidate = async () => {
    setValidating(true)
    try {
      // First save the key via /api/seo
      const saveRes = await fetch('/api/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { ...settings, license_key: inputValue } }),
      })
      const saveData = await saveRes.json()
      if (saveData.error) {
        apiError(saveData.error, 'Erro ao salvar')
        return
      }

      // Then validate via /api/license/validate
      const valRes = await fetch('/api/license/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: inputValue }),
      })
      const valData = await valRes.json()
      if (valData.error) {
        apiError(valData.error, 'Erro na validação')
      } else if (valData.valid) {
        toast({ title: '✓ Licença válida!', description: valData.message })
      } else {
        apiError(valData.message, 'Licença inválida')
      }
      // Refresh status
      await loadStatus()
    } finally {
      setValidating(false)
    }
  }

  // Force re-validation without changing the key
  const handleSync = async () => {
    setValidating(true)
    try {
      const valRes = await fetch('/api/license/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // empty body → uses the stored key
      })
      const valData = await valRes.json()
      if (valData.error) {
        apiError(valData.error, 'Erro na sincronização')
      } else if (valData.valid) {
        toast({ title: '✓ Licença sincronizada!', description: valData.message })
      } else {
        apiError(valData.message, 'Licença inválida')
      }
      await loadStatus()
    } finally {
      setValidating(false)
    }
  }

  // Status badge
  const statusBadge = (() => {
    if (loadingStatus) return <Badge tone="zinc" icon={Loader2} spin>Verificando...</Badge>
    if (!status?.hasKey) return <Badge tone="zinc" icon={KeyRound}>Sem chave</Badge>
    if (status.valid) return <Badge tone="emerald" icon={CheckCircle2}>Ativa</Badge>
    if (status.status === 'suspended') return <Badge tone="amber" icon={AlertCircle}>Suspensa</Badge>
    if (status.status === 'expired') return <Badge tone="red" icon={AlertCircle}>Expirada</Badge>
    if (status.status === 'invalid') return <Badge tone="red" icon={AlertCircle}>Inválida</Badge>
    if (status.status === 'api_unreachable') return <Badge tone="amber" icon={AlertCircle}>Servidor indisponível</Badge>
    if (status.status === 'not_validated') return <Badge tone="blue" icon={Clock}>Não validada</Badge>
    return <Badge tone="zinc" icon={AlertCircle}>{status.status}</Badge>
  })()

  return (
    <div className="space-y-4">
      {/* === Status card === */}
      <div className={cn(
        'border rounded-lg p-5',
        status?.valid ? 'bg-emerald-50 border-emerald-200' :
        status?.hasKey ? 'bg-amber-50 border-amber-200' :
        'bg-zinc-50 border-zinc-200'
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg flex-shrink-0',
              status?.valid ? 'bg-emerald-500 text-white' :
              status?.hasKey ? 'bg-amber-500 text-white' :
              'bg-zinc-400 text-white'
            )}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-zinc-900">Status da Licença</h3>
                {statusBadge}
              </div>
              <p className="text-sm text-zinc-700">
                {status?.message || 'Carregando...'}
              </p>
              {status?.checkedAt && (
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Verificada em {new Date(status.checkedAt).toLocaleString('pt-BR')}
                  {status.stale && ' · '}
                  {status.stale && <span className="text-amber-600">dados desatualizados — clique em Sincronizar</span>}
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={handleSync}
            disabled={validating || !status?.hasKey}
            variant="outline"
            size="sm"
          >
            {validating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar
          </Button>
        </div>
      </div>

      {/* === Detailed info card === */}
      {status?.data && (
        <div className="bg-white border border-zinc-200 rounded-lg p-5">
          <h3 className="font-bold text-zinc-900 mb-3 flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-primary" /> Detalhes da Licença
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <DetailItem label="Chave (mascarada)" value={status.key} mono />
            <DetailItem label="Status" value={status.status} />
            {status.data.client_id != null && (
              <DetailItem label="Client ID" value={String(status.data.client_id)} />
            )}
            {status.data.product && (
              <DetailItem label="Produto" value={status.data.product} />
            )}
            {status.data.plan && (
              <DetailItem label="Plano" value={status.data.plan} />
            )}
            {status.data.max_users != null && (
              <DetailItem label="Máx. Usuários" value={String(status.data.max_users)} />
            )}
            {status.data.is_trial !== undefined && (
              <DetailItem label="Trial" value={status.data.is_trial ? 'Sim' : 'Não'} />
            )}
            {status.data.expires_at && (
              <DetailItem
                label="Expira em"
                value={new Date(status.data.expires_at).toLocaleString('pt-BR')}
              />
            )}
            {status.data.domain && (
              <DetailItem label="Domínio autorizado" value={status.data.domain} mono />
            )}
          </div>
        </div>
      )}

      {/* === Key input === */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <h3 className="font-bold text-zinc-900 mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" /> Chave de Licença
        </h3>
        <Label className="text-sm font-medium">Chave (formato: VS-XXXX-XXXX-XXXX)</Label>
        <div className="flex gap-2 mt-1">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder="VS-XXXX-XXXX-XXXX"
            className="font-mono tracking-wider"
            maxLength={16} // VS-XXXX-XXXX-XXXX = 16 chars
          />
          <Button
            onClick={handleValidate}
            disabled={validating || inputValue.length < 16}
            className="bg-primary flex-shrink-0"
          >
            {validating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Salvar & Validar
          </Button>
        </div>
        <p className="text-xs text-zinc-400 mt-2">
          A chave é automaticamente formatada e mascarada para exibição. A validação é feita em tempo real
          contra o servidor da VS Agencia.
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          Não tem uma chave ainda? Adquira em{' '}
          <a href="https://vsagencia.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            vsagencia.net
          </a>
        </p>
      </div>

      {/* === Info card === */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2 text-sm text-blue-900">
          <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Como funciona a licença?</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
              <li>A licença é validada contra o servidor da VS Agencia a cada 1 minuto (se ativa) ou 5 minutos (se inválida).</li>
              <li>Se a licença ficar inválida, o portal será bloqueado para não-admins até a regularização.</li>
              <li>Admins continuam tendo acesso ao painel para gerenciar a licença.</li>
              <li>A chave é armazenada em <code className="bg-blue-100 px-1 rounded">license_key</code> e o cache em <code className="bg-blue-100 px-1 rounded">license_status_cache</code>.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============= HELPERS =============

function Badge({ tone, icon: Icon, children, spin }: {
  tone: 'emerald' | 'amber' | 'red' | 'blue' | 'zinc'
  icon: any
  children: React.ReactNode
  spin?: boolean
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    zinc: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border', tones[tone])}>
      <Icon className={cn('h-3 w-3', spin && 'animate-spin')} />
      {children}
    </span>
  )
}

function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wider text-zinc-500 font-medium">{label}</dt>
      <dd className={cn('text-sm text-zinc-900 font-medium break-all', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}
