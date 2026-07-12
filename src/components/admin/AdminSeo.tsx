'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ColorPicker } from '@/components/ui/color-picker'
import { cn } from '@/lib/utils'
import {
  Save, Loader2, Search, Share2, Coins, CloudSun, Image as ImageIcon, Upload, Palette,
  ShieldCheck, KeyRound, RefreshCw, CheckCircle2, AlertCircle, Clock, ExternalLink,
  AlertTriangle, Lightbulb, LayoutTemplate,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { notifyPortalUpdate } from '@/lib/portal-sync'

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
  // site_logo, logo_style, logo_size, header_template, primary_color, secondary_color,
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
    if (loading) return
    const missing = [...REQUIRED_KEYS, ...RECOMMENDED_KEYS].filter(k => !settings[k]?.trim())
    setShowSetupBanner(missing.length > 0)
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
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
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
    if (d.error) { toast({ title: 'Erro no upload', description: d.error, variant: 'destructive' }); return }
    setSettings({ ...settings, [key]: d.url })
    toast({ title: 'Upload concluído!' })
  }

  if (loading) return <div className="text-zinc-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>

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

  useEffect(() => { loadStatus() }, [loadStatus])

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
        toast({ title: 'Erro ao salvar', description: saveData.error, variant: 'destructive' })
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
        toast({ title: 'Erro na validação', description: valData.error, variant: 'destructive' })
      } else if (valData.valid) {
        toast({ title: '✓ Licença válida!', description: valData.message })
      } else {
        toast({ title: 'Licença inválida', description: valData.message, variant: 'destructive' })
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
        toast({ title: 'Erro na sincronização', description: valData.error, variant: 'destructive' })
      } else if (valData.valid) {
        toast({ title: '✓ Licença sincronizada!', description: valData.message })
      } else {
        toast({ title: 'Licença inválida', description: valData.message, variant: 'destructive' })
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
