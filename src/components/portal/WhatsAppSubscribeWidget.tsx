'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { MessageCircle, Loader2, CheckCircle2, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const WA_GREEN = '#25D366'

interface WList {
  id: string
  name: string
  description?: string | null
  color?: string | null
  categorySlug?: string | null
}

type Step = 'idle' | 'sending' | 'otp' | 'verifying' | 'success'

export function WhatsAppSubscribeWidget({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  const { toast } = useToast()
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [code, setCode] = useState('')
  const [lists, setLists] = useState<WList[]>([])
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [showLists, setShowLists] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch available subscriber lists (public endpoint)
  useEffect(() => {
    fetch('/api/whatsapp/subscribe')
      .then(r => r.json())
      .then(d => setLists(d.lists || []))
      .catch(() => {})
  }, [])

  // Cleanup auto-close timer on unmount
  useEffect(() => {
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current) }
  }, [])

  const normalizePhone = (p: string) => p.replace(/\D/g, '')

  const requestOtp = async () => {
    const normalized = normalizePhone(phone)
    if (normalized.length < 10 || normalized.length > 15) {
      toast({ title: 'Número inválido', description: 'Use DDI+DDD+número, ex: 5566999990000', variant: 'destructive' })
      return
    }
    setStep('sending')
    try {
      const r = await fetch('/api/whatsapp/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_otp',
          phoneNumber: normalized,
          name: name || undefined,
        }),
      })
      const d = await r.json()
      if (d.error) {
        if (d.alreadySubscribed) {
          toast({ title: 'Já inscrito', description: 'Este número já recebe nossas notícias no WhatsApp.' })
        } else {
          toast({ title: 'Erro', description: d.error, variant: 'destructive' })
        }
        setStep('idle')
        return
      }
      // OTP sent successfully — open dialog
      setStep('otp')
      setDialogOpen(true)
      toast({ title: 'Código enviado', description: 'Verifique seu WhatsApp.' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
      setStep('idle')
    }
  }

  const verifyOtp = async () => {
    if (code.length !== 6) {
      toast({ title: 'Código incompleto', description: 'Digite os 6 dígitos.', variant: 'destructive' })
      return
    }
    const normalized = normalizePhone(phone)
    setStep('verifying')
    try {
      const r = await fetch('/api/whatsapp/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_otp',
          phoneNumber: normalized,
          code,
          name: name || undefined,
          listIds: selectedLists,
        }),
      })
      const d = await r.json()
      if (d.error) {
        toast({ title: 'Código inválido', description: d.error, variant: 'destructive' })
        setStep('otp') // allow retry
        return
      }
      setStep('success')
      closeTimer.current = setTimeout(() => {
        setDialogOpen(false)
        // Reset for next subscription
        setTimeout(() => {
          setStep('idle')
          setPhone('')
          setName('')
          setCode('')
          setSelectedLists([])
          setShowLists(false)
        }, 300)
      }, 3000)
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
      setStep('otp')
    }
  }

  const toggleList = (id: string) => {
    setSelectedLists(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleDialogChange = (v: boolean) => {
    // Block closing during verify/success
    if (!v && (step === 'verifying' || step === 'success')) return
    setDialogOpen(v)
  }

  // === Compact variant: sidebar card ===
  if (variant === 'compact') {
    return (
      <>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: WA_GREEN }}>
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-zinc-900 dark:text-zinc-100 text-sm" style={{ fontWeight: 600 }}>Receba no WhatsApp</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Notícias no seu celular</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex">
              <span className="inline-flex items-center px-2 text-xs text-zinc-500 border border-r-0 border-zinc-200 dark:border-zinc-700 rounded-l-md bg-zinc-50 dark:bg-zinc-800">🇧🇷</span>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && step !== 'sending') requestOtp() }}
                placeholder="5566999990000"
                className="text-xs h-9 rounded-l-none"
                disabled={step === 'sending'}
              />
            </div>
            <Button
              onClick={requestOtp}
              disabled={step === 'sending'}
              className="w-full text-white h-9 border-0 hover:opacity-90"
              style={{ backgroundColor: WA_GREEN }}
            >
              {step === 'sending' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
              Inscrever-se
            </Button>
            {lists.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowLists(!showLists)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 w-full justify-center py-0.5"
                >
                  {showLists ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Escolher editorias
                </button>
                {showLists && (
                  <div className="space-y-1 pt-1 border-t border-zinc-100 dark:border-zinc-800 max-h-32 overflow-y-auto">
                    {lists.map(l => (
                      <label key={l.id} className="flex items-center gap-2 cursor-pointer text-[11px] py-0.5">
                        <Checkbox checked={selectedLists.includes(l.id)} onCheckedChange={() => toggleList(l.id)} />
                        <span className={cn('inline-block h-2 w-2 rounded-full flex-shrink-0', `bg-${l.color || 'slate'}-500`)} />
                        <span className="line-clamp-1">{l.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <SubscribeDialog
          open={dialogOpen}
          onOpenChange={handleDialogChange}
          step={step}
          code={code}
          setCode={setCode}
          verifyOtp={verifyOtp}
          phone={phone}
        />
      </>
    )
  }

  // === Full variant: inline section ===
  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: WA_GREEN }}>
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-zinc-900 dark:text-zinc-100 text-base" style={{ fontWeight: 600 }}>Receba notícias no WhatsApp</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Notícias direto no seu celular, grátis.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Seu nome (opcional)</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-9 text-xs mt-1" placeholder="Como podemos te chamar?" />
          </div>
          <div>
            <Label className="text-xs">WhatsApp</Label>
            <div className="flex mt-1">
              <span className="inline-flex items-center px-2 text-xs text-zinc-500 border border-r-0 border-zinc-200 dark:border-zinc-700 rounded-l-md bg-zinc-50 dark:bg-zinc-800">🇧🇷</span>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && step !== 'sending') requestOtp() }}
                placeholder="5566999990000"
                className="text-xs h-9 rounded-l-none"
                disabled={step === 'sending'}
              />
            </div>
          </div>
        </div>
        {lists.length > 0 && (
          <div className="mt-4">
            <Label className="text-xs mb-2 block">Escolher editorias (opcional)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {lists.map(l => (
                <label key={l.id} className="flex items-center gap-2 cursor-pointer text-xs p-2 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <Checkbox checked={selectedLists.includes(l.id)} onCheckedChange={() => toggleList(l.id)} />
                  <span className={cn('inline-block h-2 w-2 rounded-full flex-shrink-0', `bg-${l.color || 'slate'}-500`)} />
                  <span className="line-clamp-1">{l.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <Button
          onClick={requestOtp}
          disabled={step === 'sending'}
          className="mt-4 text-white h-10 border-0 hover:opacity-90"
          style={{ backgroundColor: WA_GREEN }}
        >
          {step === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          Inscrever-se
        </Button>
        <p className="text-[10px] text-zinc-400 mt-2 flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Você receberá um código de verificação via WhatsApp. Sem spam — cancele quando quiser.
        </p>
      </div>
      <SubscribeDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        step={step}
        code={code}
        setCode={setCode}
        verifyOtp={verifyOtp}
        phone={phone}
      />
    </>
  )
}

function SubscribeDialog({
  open, onOpenChange, step, code, setCode, verifyOtp, phone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  step: Step
  code: string
  setCode: (v: string) => void
  verifyOtp: () => void
  phone: string
}) {
  const isBlocking = step === 'verifying' || step === 'success'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" showCloseButton={!isBlocking}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" style={{ color: WA_GREEN }} />
            Verifique seu WhatsApp
          </DialogTitle>
        </DialogHeader>
        {step === 'success' ? (
          <div className="text-center py-6">
            <div className="h-14 w-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="text-base font-bold text-zinc-900">Inscrição confirmada!</div>
            <p className="text-xs text-zinc-500 mt-1">A partir de agora você receberá nossas notícias no WhatsApp.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-600">
              Enviamos um código de 6 dígitos para <strong className="font-mono">{phone}</strong> via WhatsApp.
            </p>
            <div>
              <Label className="text-xs mb-2 block">Código de verificação</Label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(v) => setCode(v)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <Button
              onClick={verifyOtp}
              disabled={step === 'verifying' || code.length !== 6}
              className="w-full text-white h-10 border-0 hover:opacity-90"
              style={{ backgroundColor: WA_GREEN }}
            >
              {step === 'verifying' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Verificar
            </Button>
            <p className="text-[10px] text-zinc-400 text-center">Não recebeu? Verifique o número e tente novamente.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
