'use client'

import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark'

function applyThemeToDocument(t: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (t === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Load theme from localStorage or system preference
    void (async () => {
      try {
        const stored = localStorage.getItem('portal-theme') as Theme | null
        if (stored === 'dark' || stored === 'light') {
          setTheme(stored)
          applyThemeToDocument(stored)
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setTheme('dark')
          applyThemeToDocument('dark')
        }
      } catch {}
      setMounted(true)
    })()
  }, [])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      applyThemeToDocument(next)
      try { localStorage.setItem('portal-theme', next) } catch {}
      return next
    })
  }, [])

  return { theme, toggle, mounted }
}
