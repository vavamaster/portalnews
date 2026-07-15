'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatDate, formatBRL } from '@/lib/utils'
import { ChevronLeft, Check, X, Sparkles, Crown, Building2, User as UserIcon, Loader2, CreditCard, Wallet, ShieldCheck, Tag } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { PLANS, PAYMENT_PROVIDERS, type PaymentProvider } from '@/lib/plans'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy } from 'lucide-react'

const PLAN_ICONS: Record<string, any> = {
  FREE: UserIcon,
  PROFESSIONAL: Sparkles,
  COMPANY: Building2,
  PREMIUM: Crown,
}

export function PlansView() {
  const { user, setView, refreshUser } = useAppStore()
  const { toast } = useToast()
  const [plans, setPlans] = useState<any[]>([])
  const [currentSub, setCurrentSub] = useState<any | null>(null)
  const [checkoutPlan, setCheckoutPlan] = useState<any | null>(null)
  const [provider, setProvider] = useState<PaymentProvider>('ASAAS')
  const [autoRenew, setAutoRenew] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponStatus, setCouponStatus] = useState<{ valid: boolean; discountCents?: number; error?: string } | null>(null)
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<any | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<{ status: string; pixCopyPaste?: string; boletoUrl?: string; planName: string } | null>(null)

  const load = async () => {
    const [plansRes, subsRes] = await Promise.all([
      fetch('/api/plans').then(r => r.json()),
      fetch('/api/subscriptions').then(r => r.json()),
    ])
    setPlans(plansRes.plans || [])
    const active = (subsRes.subscriptions || []).find((s: any) => s.status === 'ACTIVE')
    setCurrentSub(active || null)
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const performSubscribe = async (plan: any) => {
    if (!user) {
      toast({ title: 'Faça login primeiro', variant: 'destructive' })
      setView({ name: 'login' })
      return
    }
    if (plan.priceCents === 0) {
      // free - direct subscribe
      setSubscribing(true)
      try {
        const res = await fetch('/api/plans/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planSlug: plan.slug, provider: 'NONE', autoRenew: false }),
        })
        const data = await res.json()
        if (data.error) {
          toast({ title: 'Erro', description: data.error, variant: 'destructive' })
        } else {
          toast({ title: `Plano ${plan.name} ativado!`, description: 'Você já pode anunciar nos classificados.' })
          await refreshUser()
          await load()
          setView({ name: 'advertiser' })
        }
      } finally { setSubscribing(false) }
    } else {
      setCheckoutPlan(plan)
    }
  }

  const handleSubscribe = (plan: any) => {
    if (!user) {
      toast({ title: 'Faça login primeiro', variant: 'destructive' })
      setView({ name: 'login' })
      return
    }
    const isDowngrade = !!currentSub && currentSub.plan.priceCents > 0 && plan.priceCents < currentSub.plan.priceCents
    if (isDowngrade) {
      setPendingPlan(plan)
      return
    }
    performSubscribe(plan)
  }

  const handleConfirmDowngrade = () => {
    const plan = pendingPlan
    setPendingPlan(null)
    if (plan) performSubscribe(plan)
  }

  const handleCheckout = async () => {
    if (!checkoutPlan) return
    setSubscribing(true)
    try {
      const res = await fetch('/api/plans/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug: checkoutPlan.slug, provider, autoRenew, couponCode: couponCode || undefined }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      } else {
        const planName = checkoutPlan.name
        if (data.status === 'ACTIVE') {
          toast({
            title: `Plano ativado!`,
            description: `Plano ${planName} ativo. ${autoRenew ? 'Renovação automática ativada.' : ''}${data.discount ? ` Desconto: R$ ${(data.discount.discount / 100).toFixed(2)}` : ''}`,
          })
          setCheckoutPlan(null)
          setCouponCode('')
          setCouponStatus(null)
          await refreshUser()
          await load()
          setView({ name: 'advertiser' })
        } else if (data.status === 'PENDING') {
          toast({
            title: 'Pagamento criado!',
            description: 'Complete o pagamento para ativar o plano.',
          })
          setPaymentInfo({
            status: data.status,
            pixCopyPaste: data.payment?.pixCopyPaste,
            boletoUrl: data.payment?.boletoUrl,
            planName,
          })
          setCheckoutPlan(null)
          setCouponCode('')
          setCouponStatus(null)
          await load()
        } else {
          toast({
            title: 'Pagamento confirmado!',
            description: `Plano ${planName}.`,
          })
          setCheckoutPlan(null)
          setCouponCode('')
          setCouponStatus(null)
          await refreshUser()
          await load()
        }
      }
    } finally { setSubscribing(false) }
  }

  const handleValidateCoupon = async () => {
    if (!couponCode || !checkoutPlan) return
    setValidatingCoupon(true)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, amountCents: checkoutPlan.priceCents, appliesTo: 'SUBSCRIPTION' }),
      })
      const data = await res.json()
      setCouponStatus(data)
    } finally { setValidatingCoupon(false) }
  }

  return (
    <div className="news-container py-8 animate-fade-in">
      <button onClick={() => setView({ name: 'classifieds' })} className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-amber-600 mb-4">
        <ChevronLeft className="h-4 w-4" /> Voltar aos classificados
      </button>

      <div className="text-center mb-10">
        <h1 className="font-black text-3xl sm:text-4xl text-zinc-900 mb-2">Escolha seu plano</h1>
        <p className="text-zinc-600 max-w-2xl mx-auto">
          Mais recursos, mais contatos, mais visibilidade. Planos pagos desbloqueiam WhatsApp, telefone, mapa, avaliações e muito mais.
        </p>
        {currentSub && (
          <div className="mt-4 inline-flex items-center gap-2 bg-amber-100 border border-amber-300 rounded-full px-4 py-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-amber-700" />
            <span>Plano atual: <strong className="text-amber-800">{currentSub.plan.name}</strong></span>
            <span className="text-amber-600">·</span>
            <span className="text-amber-700">Renova em {formatDate(currentSub.currentPeriodEnd, 'short')}</span>
          </div>
        )}
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const config = PLANS.find(p => p.slug === plan.slug)
          const Icon = PLAN_ICONS[plan.slug] || Sparkles
          const isCurrent = currentSub?.planId === plan.id
          const isPopular = plan.slug === 'COMPANY'
          return (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col',
                isPopular && 'border-amber-400 shadow-lg ring-2 ring-amber-200',
                isCurrent && 'border-emerald-400'
              )}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  Mais Popular
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  Plano Atual
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <div className={cn('mx-auto mb-2 h-12 w-12 rounded-full flex items-center justify-center', `bg-${plan.badgeColor}-100`)}>
                  <Icon className={cn('h-6 w-6', `text-${plan.badgeColor}-600`)} />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="text-3xl font-black text-zinc-900">
                  {plan.priceCents === 0 ? 'Grátis' : (
                    <>
                      {formatBRL(plan.priceCents)}
                      <span className="text-sm font-medium text-zinc-500">/mês</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-1">{plan.description}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-1.5 text-sm flex-1">
                  {config?.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className={cn('h-4 w-4 flex-shrink-0 mt-0.5', `text-${plan.badgeColor}-600`)} />
                      <span className="text-zinc-700">{h}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn('mt-4 w-full', isCurrent ? 'bg-emerald-600' : plan.priceCents === 0 ? 'bg-zinc-800 hover:bg-zinc-900' : 'bg-amber-600 hover:bg-amber-700')}
                  onClick={() => !isCurrent && handleSubscribe(plan)}
                  disabled={isCurrent || subscribing}
                >
                  {isCurrent ? '✓ Plano ativo' : plan.priceCents === 0 ? 'Ativar grátis' : 'Assinar agora'}
                </Button>
                {plan.allowPoints && (
                  <p className="text-xs text-center mt-2 text-amber-700">Aceita pontos para anúncios extras</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Comparison table */}
      <Card className="mt-10 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Comparação detalhada de recursos</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left p-3 font-medium">Recurso</th>
                {plans.map(p => (
                  <th key={p.id} className="text-center p-3 font-bold">{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                { label: 'Anúncios ativos', key: 'maxListings', format: (v: number) => v === -1 ? '∞' : String(v) },
                { label: 'Fotos por anúncio', key: 'maxPhotosPerListing', format: (v: number) => String(v) },
                { label: 'Produtos/Serviços', key: 'maxServicesPerListing', format: (v: number) => v === -1 ? '∞' : (v === 0 ? '—' : String(v)) },
                { label: 'Pontos para anúncio extra', key: 'allowPoints', format: (v: boolean, p: any) => v ? `${p.pointsPerListing} pts` : '—' },
                { label: 'Mensagens pelo painel', key: 'allowPanelMessage' },
                { label: 'WhatsApp', key: 'allowWhatsApp' },
                { label: 'Telefone', key: 'allowPhone' },
                { label: 'Email', key: 'allowEmail' },
                { label: 'Mapa & Geolocalização', key: 'allowMap' },
                { label: 'Logo da empresa', key: 'allowLogo' },
                { label: 'Avaliações', key: 'allowReviews' },
                { label: 'Analytics', key: 'allowAnalytics' },
                { label: 'Boost com pontos', key: 'allowBoost' },
                { label: 'Selo verificado', key: 'allowVerified' },
                { label: 'Destaque na busca', key: 'allowFeatured' },
                { label: 'Leads por mês', key: 'maxLeadsPerMonth', format: (v: number) => v === -1 ? '∞' : String(v) },
              ] as Array<{ label: string; key: string; format?: (v: any, p?: any) => any }>).map((row) => (
                <tr key={row.key} className="border-b border-zinc-100 last:border-0">
                  <td className="p-3 font-medium text-zinc-700">{row.label}</td>
                  {plans.map(p => {
                    const val: any = (p as any)[row.key]
                    const display: any = row.format ? row.format(val, p) : (val === true ? <Check className="h-4 w-4 text-emerald-600 mx-auto" /> : val === false ? <X className="h-4 w-4 text-zinc-300 mx-auto" /> : String(val))
                    return <td key={p.id} className="text-center p-3">{display}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Perguntas frequentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-600">
          <div>
            <strong className="text-zinc-900">Como funciona o plano Grátis?</strong>
            <p>Você pode ter 1 anúncio ativo gratuitamente, com até 3 fotos. Para criar mais anúncios, faça upgrade para um plano pago ou use seus créditos (ganhos lendo notícias e fazendo check-in diário).</p>
          </div>
          <div>
            <strong className="text-zinc-900">Como ganho créditos para anúncios grátis?</strong>
            <p>Leia notícias (+10 pontos por leitura), reaja às notícias (+5 pontos), faça check-in diário (+10 a +30 pontos com bônus de sequência). A cada 10 pontos você ganha 1 crédito. Anúncios grátis custam 20 créditos por 7 dias.</p>
          </div>
          <div>
            <strong className="text-zinc-900">Posso cancelar quando quiser?</strong>
            <p>Sim. O cancelamento impede a renovação automática, mas seu plano continua ativo até o fim do período já pago. Após o vencimento, você volta automaticamente para o plano Grátis.</p>
          </div>
          <div>
            <strong className="text-zinc-900">O que é "Boost"?</strong>
            <p>Boost destaca seu anúncio no topo das buscas por 3 dias, usando seus pontos. Disponível em todos os planos (incluindo Grátis).</p>
          </div>
          <div>
            <strong className="text-zinc-900">Qual a diferença entre os planos pagos?</strong>
            <p><strong>Profissional</strong>: 10 anúncios, mais fotos, WhatsApp e telefone visíveis. <strong>Empresa</strong>: 50 anúncios, logo, analytics, avaliações e destaque. <strong>Premium</strong>: anúncios ilimitados, todos os recursos liberados.</p>
          </div>
          <div>
            <strong className="text-zinc-900">Quais dimensões devo usar nas fotos?</strong>
            <p>Fotos dos anúncios: <strong>800×600px</strong> (JPG ou PNG). Logo da empresa: <strong>200×200px</strong> (PNG transparente). Evite fotos maiores que 5MB — use sites como iLoveIMG ou Squoosh para comprimir.</p>
          </div>
        </CardContent>
      </Card>

      {/* Checkout dialog */}
      <Dialog open={!!checkoutPlan} onOpenChange={(o) => !o && setCheckoutPlan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assinar plano {checkoutPlan?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-zinc-50 rounded p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg">{checkoutPlan?.name}</div>
                  <div className="text-xs text-zinc-600">{checkoutPlan?.description}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-2xl">{formatBRL(checkoutPlan?.priceCents || 0)}</div>
                  <div className="text-xs text-zinc-500">/mês</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Escolha o pagamento:</div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(PAYMENT_PROVIDERS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setProvider(key as PaymentProvider)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 border-2 rounded transition-colors',
                      provider === key ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 hover:border-zinc-300'
                    )}
                  >
                    {p.icon === 'CreditCard' ? <CreditCard className={cn('h-5 w-5', `text-${p.color}-600`)} /> : <Wallet className={cn('h-5 w-5', `text-${p.color}-600`)} />}
                    <span className="text-xs font-medium">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Coupon section */}
            <div>
              <Label className="text-sm font-medium flex items-center gap-1">
                <Tag className="h-4 w-4" /> Cupom de desconto
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponStatus(null) }}
                  placeholder="Ex: BEMVINDO10"
                  className="uppercase"
                />
                <Button type="button" variant="outline" onClick={handleValidateCoupon} disabled={validatingCoupon || !couponCode}>
                  {validatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                </Button>
              </div>
              {couponStatus?.valid && (
                <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Cupom aplicado! Desconto: {formatBRL(couponStatus.discountCents || 0)}
                </p>
              )}
              {couponStatus && !couponStatus.valid && (
                <p className="text-xs text-red-600 mt-1">{couponStatus.error}</p>
              )}
              <p className="text-xs text-zinc-400 mt-1">Tem um cupom? Digite acima para validar.</p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="rounded" />
              <span className="text-sm">Renovação automática mensal</span>
            </label>

            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
              <strong>Modo demonstração:</strong> O pagamento é simulado e o plano ativado imediatamente. Em produção,
              você seria redirecionado para o checkout do <strong>{PAYMENT_PROVIDERS[provider].name}</strong>.
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setCheckoutPlan(null); setCouponCode(''); setCouponStatus(null) }}>Cancelar</Button>
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleCheckout} disabled={subscribing}>
                {subscribing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                {couponStatus?.valid ? (
                  <>
                    <span className="line-through text-xs opacity-60 mr-1">{formatBRL(checkoutPlan?.priceCents || 0)}</span>
                    {formatBRL((checkoutPlan?.priceCents || 0) - (couponStatus.discountCents || 0))}
                  </>
                ) : (
                  <>{formatBRL(checkoutPlan?.priceCents || 0)}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Downgrade confirmation */}
      <AlertDialog open={!!pendingPlan} onOpenChange={(o) => !o && setPendingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar mudança de plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está no plano {currentSub?.plan.name}. Mudar para {pendingPlan?.name} vai pausar seus anúncios excedentes e bloquear contatos premium. Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDowngrade} className="bg-amber-600 hover:bg-amber-700">Confirmar mudança</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment info (PIX / Boleto) */}
      <Dialog open={!!paymentInfo} onOpenChange={(o) => !o && setPaymentInfo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento pendente — {paymentInfo?.planName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-zinc-700">
              Complete o pagamento para ativar o plano {paymentInfo?.planName}.
            </p>
            {paymentInfo?.pixCopyPaste && (
              <div>
                <Label className="text-sm font-medium">Código PIX (copia e cola)</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={paymentInfo.pixCopyPaste} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard?.writeText(paymentInfo.pixCopyPaste || '')
                      toast({ title: 'Código PIX copiado!' })
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {paymentInfo?.boletoUrl && (
              <a
                href={paymentInfo.boletoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                <CreditCard className="h-4 w-4" /> Abrir boleto
              </a>
            )}
            <Button variant="outline" className="w-full" onClick={() => setPaymentInfo(null)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
