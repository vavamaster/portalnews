import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parse a JSON string. Returns fallback (default: null) if parsing fails.
 * Use this anywhere you're parsing JSON from DB fields, localStorage, or user input.
 */
export function safeJsonParse<T = any>(s: string | null | undefined, fallback: T = null as any): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

/**
 * Safely parse a JSON array. Returns fallback (default: []) if parsing fails or result is not an array.
 */
export function safeJsonArray<T = any>(s: string | null | undefined, fallback: T[] = []): T[] {
  const parsed = safeJsonParse<any>(s, null)
  return Array.isArray(parsed) ? parsed : fallback
}

