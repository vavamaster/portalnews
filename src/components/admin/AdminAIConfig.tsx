'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Save, Loader2, Plus, Check, X, Zap, AlertCircle, Cpu, Settings2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { useApiError } from '@/hooks/use-api-error'

const PROVIDER_ICONS: Record<string, string> = {
  ZAI: '🤖', OPENAI: '🟢', GEMINI: '🔵', CLAUDE: '🟠', OLLAMA: '🦙', CUSTOM: '⚙️',
}

export function AdminAIConfig() {
  const { toast } = useToast()
  const apiError = useApiError()
  const [configs, setConfigs] = useState<any[]>([])
  const [presets, setPresets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [showAddProvider, setShowAddProvider] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ai-config')
      const data = await res.json()
      setConfigs(data.configs || [])
      setPresets(data.presets || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const handleSave = async (config: any) => {
    setSaving(config.id)
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        toast({ title: 'Configuração salva!' })
        load()
      }
    } finally {
      setSaving(null)
    }
  }

  const handleTest = async (config: any) => {
    setTesting(config.id)
    try {
      const res = await fetch('/api/admin/ai-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: config.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: '✅ Conexão OK!', description: `Resposta: ${data.response}` })
      } else {
        apiError(data.message, '❌ Falha na conexão')
      }
    } catch (e: any) {
      apiError(e.message)
    } finally {
      setTesting(null)
    }
  }

  const handleAddProvider = async (provider: string) => {
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json()
      if (data.error) {
        apiError(data.error)
      } else {
        toast({ title: 'Provider adicionado!' })
        setShowAddProvider(false)
        load()
      }
    } catch (e: any) {
      apiError(e.message)
    }
  }

  const updateConfig = (id: string, field: string, value: any) => {
    setConfigs(configs.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const handleSetDefault = async (config: any) => {
    setSaving(config.id)
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, isDefault: true }),
      })
      const data = await res.json()
      // A7 fix: check res.ok before showing success
      if (!res.ok || data.error) {
        apiError(data.error || 'Falha ao definir padrão')
      } else {
        toast({ title: 'Provider padrão definido!' })
        load()
      }
    } catch (e: any) {
      apiError(e.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <LoadingSpinner className="py-0" />
  }

  const availableToAdd = presets.filter(p => !configs.find(c => c.provider === p.provider))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">
          {configs.length} provider(s) configurado(s) · {configs.filter(c => c.isEnabled).length} ativo(s)
        </div>
        {availableToAdd.length > 0 && (
          <Button onClick={() => setShowAddProvider(!showAddProvider)} variant="outline">
            <Plus className="h-4 w-4 mr-2" /> Adicionar provider
          </Button>
        )}
      </div>

      {/* Add provider panel */}
      {showAddProvider && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">Selecionar provider para adicionar</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableToAdd.map(p => (
                <button
                  key={p.provider}
                  onClick={() => handleAddProvider(p.provider)}
                  className="flex flex-col items-start gap-1 p-3 border-2 rounded-lg hover:border-primary hover:bg-accent/50 transition-all text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{p.icon}</span>
                    <span className="text-sm font-medium">{p.displayName}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{p.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Config cards */}
      {configs.map((config) => {
        const preset = presets.find(p => p.provider === config.provider)
        const icon = PROVIDER_ICONS[config.provider] || '🤖'
        return (
          <Card key={config.id} className={cn(
            'transition-all',
            config.isDefault && 'ring-2 ring-primary ring-offset-1',
            !config.isEnabled && 'opacity-60',
          )}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{config.displayName}</CardTitle>
                      {config.isDefault && <Badge className="bg-primary text-white text-xs">PADRÃO</Badge>}
                      {config.isEnabled && <Badge variant="outline" className="text-emerald-700 text-xs">ATIVO</Badge>}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{config.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.isEnabled}
                    onCheckedChange={(v) => updateConfig(config.id, 'isEnabled', v)}
                  />
                  <Label className="text-xs cursor-pointer">Ativo</Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Modelo</Label>
                  <Input
                    value={config.model}
                    onChange={(e) => updateConfig(config.id, 'model', e.target.value)}
                    placeholder="ex: gpt-4o, gemini-1.5-pro"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Base URL {preset?.needsApiKey === false && '(opcional)'}</Label>
                  <Input
                    value={config.baseUrl || ''}
                    onChange={(e) => updateConfig(config.id, 'baseUrl', e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="mt-1"
                  />
                </div>
              </div>

              {preset?.needsApiKey !== false && (
                <div>
                  <Label className="text-xs">API Key {preset?.needsApiKey ? '*' : '(opcional)'}</Label>
                  <Input
                    type="password"
                    value={config.apiKey || ''}
                    onChange={(e) => updateConfig(config.id, 'apiKey', e.target.value)}
                    placeholder={preset?.needsApiKey ? 'sk-...' : 'Opcional para este provider'}
                    className="mt-1"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Max Tokens</Label>
                  <Input
                    type="number"
                    value={config.maxTokens}
                    onChange={(e) => updateConfig(config.id, 'maxTokens', parseInt(e.target.value) || 4096)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Temperature (0-1)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={config.temperature}
                    onChange={(e) => updateConfig(config.id, 'temperature', parseFloat(e.target.value) || 0.7)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Cpu className="h-3 w-3" />
                  {config.provider} · {config.model}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest(config)}
                    disabled={testing === config.id || !config.isEnabled}
                  >
                    {testing === config.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                    Testar
                  </Button>
                  {!config.isDefault && config.isEnabled && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetDefault(config)}
                      disabled={saving === config.id}
                    >
                      <Star className="h-3.5 w-3.5 mr-1" /> Definir padrão
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleSave(config)}
                    disabled={saving === config.id}
                    className="bg-primary"
                  >
                    {saving === config.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                    Salvar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {configs.length === 0 && !showAddProvider && (
        <Card>
          <CardContent className="py-12 text-center">
            <Cpu className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-600 mb-2">Nenhum provider de IA configurado.</p>
            <p className="text-xs text-zinc-400 mb-4">Adicione um provider para habilitar a geração de matérias com IA.</p>
            <Button onClick={() => setShowAddProvider(true)}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar provider
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Star({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
}
