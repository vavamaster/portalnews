'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

/**
 * Global Error Boundary for the root layout — catches errors that error.tsx can't.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Erro no sistema</h1>
          <p className="text-sm text-zinc-500 mb-6">
            Ocorreu um erro crítico. Tente novamente.
          </p>
          <Button onClick={reset} className="bg-primary">
            Tentar novamente
          </Button>
        </div>
      </body>
    </html>
  )
}
