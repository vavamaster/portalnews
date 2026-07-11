'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Cookie, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const CONSENT_KEY = 'portal_cookie_consent'
const CONSENT_VERSION = 1 // bump to re-prompt users when policy changes

type ConsentState = 'unknown' | 'accepted' | 'rejected'

export function CookieConsent() {
  const [state, setState] = useState<ConsentState>('unknown')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let mounted = true
    const checkConsent = () => {
      if (!mounted) return
      try {
        const stored = localStorage.getItem(CONSENT_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed?.version === CONSENT_VERSION && (parsed?.state === 'accepted' || parsed?.state === 'rejected')) {
            setState(parsed.state)
            return
          }
        }
      } catch {}
      // Show banner after a short delay
      setTimeout(() => mounted && setVisible(true), 1500)
    }
    checkConsent()
    return () => { mounted = false }
  }, [])

  const persist = (newState: ConsentState) => {
    setState(newState)
    setVisible(false)
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ state: newState, version: CONSENT_VERSION, at: new Date().toISOString() }))
    } catch {}
    // Dispatch event so analytics scripts can react
    window.dispatchEvent(new CustomEvent('cookie-consent-change', { detail: newState }))
  }

  if (!visible || state !== 'unknown') return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto bg-white border border-zinc-200 shadow-2xl rounded-lg p-4 flex flex-col sm:flex-row items-start gap-3">
        <div className="bg-amber-100 rounded-full h-10 w-10 flex items-center justify-center flex-shrink-0">
          <Cookie className="h-5 w-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-zinc-900 mb-1">Usamos cookies</h3>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Utilizamos cookies essenciais para o funcionamento do portal (login, preferências, carrinho).
            Também usamos cookies opcionais para análise de tráfego e personalização. Você pode aceitar todos
            ou recusar os opcionais. Leia nossa{' '}
            <a href="/?view=about" className="text-primary underline">Política de Privacidade</a>.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" className="bg-primary h-8" onClick={() => persist('accepted')}>
              <Check className="h-3.5 w-3.5 mr-1" /> Aceitar todos
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => persist('rejected')}>
              Recusar opcionais
            </Button>
          </div>
        </div>
        <button
          onClick={() => persist('rejected')}
          className="text-zinc-400 hover:text-zinc-700 flex-shrink-0"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// Helper for other components to check consent
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (!stored) return false
    const parsed = JSON.parse(stored)
    return parsed?.state === 'accepted'
  } catch {
    return false
  }
}
