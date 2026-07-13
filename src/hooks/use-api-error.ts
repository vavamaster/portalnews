'use client'

import { useToast } from '@/hooks/use-toast'

/**
 * Consolidated API error handler — replaces 82+ duplicate
 * `toast({ title: 'Erro', description: data.error, variant: 'destructive' })` patterns.
 *
 * Usage:
 *   const apiError = useApiError()
 *   const res = await fetch('/api/...')
 *   const data = await res.json()
 *   if (data.error) return apiError(data.error)
 *   if (!res.ok) return apiError('Falha na operação')
 */
export function useApiError() {
  const { toast } = useToast()
  return (message: string, title = 'Erro') => {
    toast({ title, description: message, variant: 'destructive' })
  }
}

/**
 * Consolidated API success toast — replaces ~40 duplicate
 * `toast({ title: '✓ Salvo' })` / `toast({ title: 'Sucesso' })` patterns.
 */
export function useApiSuccess() {
  const { toast } = useToast()
  return (message: string, title = '✓') => {
    toast({ title, description: message })
  }
}
