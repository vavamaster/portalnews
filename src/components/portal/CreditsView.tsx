'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Award, Coins, TrendingUp, TrendingDown, ArrowLeftRight, ShoppingBag, Sparkles, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function CreditsView() {
  const { user, setView, refreshUser } = useAppStore()
  const { toast } = useToast()
  const [pointsTxs, setPointsTxs] = useState<any[]>([])
  const [creditTxs, setCreditTxs] = useState<any[]>([])
  const [config, setConfig] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [convertAmount, setConvertAmount] = useState('')

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [pointsRes, creditsRes] = await Promise.all([
        fetch('/api/credits?type=points'),
        fetch('/api/credits'),
      ])
      const [pointsData, creditsData] = await Promise.all([pointsRes.json(), creditsRes.json()])
      setPointsTxs(pointsData.transactions || [])
      setCreditTxs(creditsData.transactions || [])
      setConfig(creditsData.config || {})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])

  if (!user) {
    return (
      <div className="news-container py-16 text-center">
        <Award className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Faça login para ver seus pontos</h1>
        <Button onClick={() => setView({ name: 'login' })} className="bg-primary mt-3">Entrar</Button>
      </div>
    )
  }

  const handleConvert = async () => {
    const amount = parseInt(convertAmount, 10)
    if (!amount || amount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' })
      return
    }
    if (amount > user.points) {
      toast({ title: 'Pontos insuficientes', variant: 'destructive' })
      return
    }
    const res = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pointsToConvert: amount }),
    })
    const data = await res.json()
    if (data.error) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    } else {
      toast({
        title: 'Conversão realizada!',
        description: `${data.pointsUsed} pontos → ${data.creditsAwarded} créditos`,
      })
      setConvertAmount('')
      await refreshUser()
      load()
    }
  }

  const creditsToGet = Math.floor((parseInt(convertAmount) || 0) / (config.creditsConversionRate || 10))

  return (
    <div className="news-container py-8 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-black text-3xl text-zinc-900 mb-2">Pontos & Créditos</h1>
        <p className="text-zinc-600 mb-6">Leia notícias, reaja, ganhe pontos e troque por créditos para anunciar grátis.</p>

        {/* Balances */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-amber-500 text-white flex items-center justify-center">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-amber-700 font-medium">Saldo de Pontos</div>
                  <div className="font-black text-3xl text-zinc-900">{user.points}</div>
                </div>
              </div>
              <p className="text-xs text-amber-800">Ganhe pontos lendo e reagindo às notícias.</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <Coins className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-emerald-700 font-medium">Saldo de Créditos</div>
                  <div className="font-black text-3xl text-zinc-900">{user.credits}</div>
                </div>
              </div>
              <p className="text-xs text-emerald-800">Use créditos para anúncios grátis no portal.</p>
            </CardContent>
          </Card>
        </div>

        {/* How to earn */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="h-5 w-5 text-primary" /> Como ganhar pontos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded">
                <span>Ler uma notícia (a cada 25%)</span>
                <span className="font-bold text-amber-600">+{config.pointsPerRead || 10} pts</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded">
                <span>Reagir a uma notícia</span>
                <span className="font-bold text-amber-600">+{config.pointsPerReaction || 5} pts</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded">
                <span>Máximo por post (leitura)</span>
                <span className="font-bold text-zinc-700">{config.maxReadsPerPost || 50} pts</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded">
                <span>Máximo por post (reação)</span>
                <span className="font-bold text-zinc-700">{config.maxReactionsPerPost || 30} pts</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Convert points to credits */}
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowLeftRight className="h-5 w-5 text-primary" /> Converter Pontos em Créditos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <Label htmlFor="convert" className="text-sm">Quantos pontos converter?</Label>
                <Input
                  id="convert"
                  type="number"
                  min="0"
                  max={user.points}
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  placeholder="Ex: 100"
                  className="mt-1"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Taxa: {config.creditsConversionRate || 10} pontos = 1 crédito
                </p>
              </div>
              <div className="text-center px-4 py-2 bg-emerald-50 rounded">
                <div className="text-xs text-emerald-700 uppercase tracking-wider">Você recebe</div>
                <div className="font-bold text-2xl text-emerald-700">{creditsToGet} <span className="text-sm">créditos</span></div>
              </div>
              <Button onClick={handleConvert} className="bg-primary hover:bg-blue-700" disabled={!convertAmount || creditsToGet <= 0}>
                <ArrowLeftRight className="h-4 w-4 mr-2" /> Converter
              </Button>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span>Anúncio grátis custa <strong>{config.freeAdCostCredits || 20} créditos</strong></span>
              </div>
              <Button onClick={() => setView({ name: 'store' })} variant="link" className="text-primary">
                Anunciar agora <Sparkles className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" /> Histórico de Pontos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-zinc-500">Carregando...</div>
              ) : pointsTxs.length === 0 ? (
                <div className="text-sm text-zinc-500 text-center py-6">Sem transações ainda.</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {pointsTxs.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-zinc-100 last:border-0">
                      <div className="flex items-center gap-2">
                        {t.amount > 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                        <div>
                          <div className="font-medium">{reasonLabel(t.reason)}</div>
                          <div className="text-xs text-zinc-500">{new Date(t.createdAt).toLocaleString('pt-BR')}</div>
                        </div>
                      </div>
                      <div className={t.amount > 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                        {t.amount > 0 ? '+' : ''}{t.amount}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="h-5 w-5 text-emerald-600" /> Histórico de Créditos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-zinc-500">Carregando...</div>
              ) : creditTxs.length === 0 ? (
                <div className="text-sm text-zinc-500 text-center py-6">Sem transações ainda.</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {creditTxs.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-zinc-100 last:border-0">
                      <div className="flex items-center gap-2">
                        {t.amount > 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                        <div>
                          <div className="font-medium">{reasonLabel(t.reason)}</div>
                          <div className="text-xs text-zinc-500">{new Date(t.createdAt).toLocaleString('pt-BR')}</div>
                        </div>
                      </div>
                      <div className={t.amount > 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                        {t.amount > 0 ? '+' : ''}{t.amount}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function reasonLabel(r: string): string {
  const map: Record<string, string> = {
    READING: 'Leitura de notícia',
    REACTION: 'Reação a notícia',
    REACTION_RECEIVED: 'Recebeu reação',
    COMMENT: 'Comentário',
    DAILY_LOGIN: 'Login diário',
    CONVERTED_TO_CREDITS: 'Convertido em créditos',
    MANUAL: 'Ajuste manual',
    CONVERTED_FROM_POINTS: 'Conversão de pontos',
    SPENT_FREE_AD: 'Anúncio grátis',
    ADMIN_GRANT: 'Crédito administrativo',
    PURCHASE: 'Compra',
  }
  return map[r] || r
}
