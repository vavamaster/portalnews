'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * useAsyncEffect — runs an async function in useEffect with proper cancellation.
 * Prevents setState-on-unmounted-component warnings and stale-response races.
 *
 * Usage:
 *   const { data, error, loading, reload } = useAsyncEffect(async () => {
 *     const r = await fetch('/api/foo')
 *     return r.json()
 *   }, [deps])
 *
 * The async function receives an AbortSignal — pass it to fetch() for cancellation:
 *   useAsyncEffect(async (signal) => {
 *     const r = await fetch('/api/foo', { signal })
 *     return r.json()
 *   }, [deps])
 *
 * Returns:
 *   - data: T | null (last successful result)
 *   - error: Error | null
 *   - loading: boolean (true during the latest invocation)
 *   - reload: () => void (re-runs the effect)
 */
export function useAsyncEffect<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: any[]
): { data: T | null; error: Error | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadTick, setReloadTick] = useState(0)
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn })

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    // Set loading state synchronously before the async call.
    // This is the standard fetch-effect pattern; the react-hooks/set-state-in-effect
    // rule prefers derived state, but for an imperative fetch we need to signal loading.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true)
    setError(null)

    fnRef.current(controller.signal)
      .then((result) => {
        if (!cancelled) {
          setData(result)
        }
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [...deps, reloadTick])

  const reload = useCallback(() => setReloadTick(t => t + 1), [])
  return { data, error, loading, reload }
}
