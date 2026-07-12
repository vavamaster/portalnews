'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * Global Error Boundary — catches unhandled errors in any route segment.
 * Shows a friendly fallback with "Tentar novamente" button.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Algo deu errado</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Ocorreu um erro inesperado. Tente novamente ou volte para a página inicial.
        </p>
        {error.message && (
          <p className="text-xs text-zinc-400 bg-zinc-100 rounded-lg p-3 mb-4 font-mono">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} className="bg-primary">
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Voltar ao início
          </Button>
        </div>
      </div>
    </div>
  )
}
