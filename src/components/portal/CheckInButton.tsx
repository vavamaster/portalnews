'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Flame, Gift, Trophy, Sparkles, Loader2, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface CheckInData {
  canCheckIn: boolean
  streak: number
  lastCheckInAt: string | null
  nextMultiplier: number
  nextStreak: number
  nextPoints: number
}

export function CheckInButton() {
  const { user, setUser, refreshUser } = useAppStore()
  const { toast } = useToast()
  const [data, setData] = useState<CheckInData | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ points: number; streak: number; multiplier: number; newAchievements: any[] } | null>(null)

  const load = async () => {
    if (!user) return
    try {
      const res = await fetch('/api/check-in')
      const d = await res.json()
      setData(d)
      // Auto-open modal if user can check-in and hasn't seen it this session
      if (d.canCheckIn && !sessionStorage.getItem('checkin-dismissed')) {
        // wait 2s after login to show
        setTimeout(() => {
          if (!sessionStorage.getItem('checkin-dismissed')) {
            setOpen(true)
          }
        }, 2000)
      }
    } catch {}
  }

  useEffect(() => {
    load()
  }, [user?.id])

  const handleCheckIn = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/check-in', { method: 'POST' })
      const d = await res.json()
      if (d.error) {
        toast({ title: 'Erro', description: d.error, variant: 'destructive' })
      } else {
        setResult(d)
        if (d.user) setUser(d.user)
        await refreshUser()
        toast({
          title: `+${d.points} pontos!`,
          description: `Check-in dia ${d.streak} · Multiplicador ${d.multiplier}x`,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    sessionStorage.setItem('checkin-dismissed', '1')
    if (result) {
      setResult(null)
      load()
    }
  }

  if (!user) return null
  if (!data) return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'relative gap-1.5 text-xs font-bold',
          data.canCheckIn && 'text-orange-600 hover:bg-orange-50'
        )}
        onClick={() => setOpen(true)}
        title={data.canCheckIn ? 'Check-in diário disponível!' : `Streak: ${data.streak} dias`}
      >
        <Flame className={cn('h-4 w-4', data.canCheckIn && 'animate-pulse')} />
        <span className="hidden lg:inline">{data.streak > 0 ? data.streak : ''}</span>
        {data.canCheckIn && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Flame className="h-6 w-6 text-orange-500" /> Check-in Diário
            </DialogTitle>
            <DialogDescription>
              Ganhe pontos todo dia só por entrar. Mantenha sua sequência para multiplicar!
            </DialogDescription>
          </DialogHeader>

          {result ? (
            // Result screen
            <div className="text-center py-4">
              <div className="text-5xl mb-2">🎉</div>
              <div className="text-3xl font-black text-orange-600 mb-1">+{result.points} pontos</div>
              <div className="text-sm text-zinc-600 mb-4">
                Sequência: <strong>{result.streak} dia(s)</strong> · Multiplicador <strong>{result.multiplier}x</strong>
              </div>
              {result.newAchievements.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Conquistas desbloqueadas!</div>
                  {result.newAchievements.map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1">
                      <span className="flex items-center gap-1.5">
                        <Trophy className="h-4 w-4 text-amber-500" /> {a.name}
                      </span>
                      <span className="text-amber-700 font-bold">+{a.pointsReward} pts</span>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={handleClose} className="bg-orange-500 hover:bg-orange-600">
                <Check className="h-4 w-4 mr-2" /> Continuar
              </Button>
            </div>
          ) : (
            // Pre-checkin screen
            <div className="space-y-4">
              {/* Current streak */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4 text-center">
                <div className="text-xs uppercase tracking-wider text-orange-700 font-medium mb-1">Sequência atual</div>
                <div className="flex items-center justify-center gap-2">
                  <Flame className="h-8 w-8 text-orange-500" />
                  <span className="text-4xl font-black text-orange-700">{data.streak || 0}</span>
                  <span className="text-sm text-orange-700">dias</span>
                </div>
              </div>

              {/* Next check-in reward */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2">Próximo check-in vale</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-emerald-600" />
                    <span className="font-bold text-lg">{data.nextPoints} pontos</span>
                  </div>
                  {data.nextMultiplier > 1 && (
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">
                      {data.nextMultiplier}x multiplicador
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Streak após check-in: <strong>{data.nextStreak} dias</strong>
                </div>
              </div>

              {/* Streak roadmap */}
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2">Multiplicadores</div>
                <div className="grid grid-cols-3 gap-2">
                  <StreakCard days={3} mult={1.5} current={data.streak} />
                  <StreakCard days={7} mult={2} current={data.streak} />
                  <StreakCard days={30} mult={3} current={data.streak} />
                </div>
              </div>

              <Button
                onClick={handleCheckIn}
                disabled={!data.canCheckIn || loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-lg py-6"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Flame className="h-5 w-5 mr-2" />
                )}
                {data.canCheckIn ? `Fazer Check-in (+${data.nextPoints} pts)` : 'Já fez check-in hoje'}
              </Button>
              {!data.canCheckIn && (
                <p className="text-xs text-center text-zinc-500">
                  Volte amanhã para manter sua sequência de {data.streak} dia(s)!
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function StreakCard({ days, mult, current }: { days: number; mult: number; current: number }) {
  const achieved = current >= days
  return (
    <div className={cn(
      'border rounded-lg p-2 text-center',
      achieved ? 'border-emerald-400 bg-emerald-50' : 'border-zinc-200 bg-white'
    )}>
      <div className={cn('font-bold text-lg', achieved ? 'text-emerald-700' : 'text-zinc-700')}>{days}d</div>
      <div className={cn('text-xs font-medium', achieved ? 'text-emerald-600' : 'text-zinc-500')}>{mult}x</div>
      {achieved && <Check className="h-3 w-3 text-emerald-600 mx-auto mt-0.5" />}
    </div>
  )
}
