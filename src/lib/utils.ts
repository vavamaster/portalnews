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

// ============================================================
// Slug generation — consolidated from 11 duplicate sites
// ============================================================

/**
 * Convert a string to a URL-safe slug.
 * Strips accents, lowercases, replaces non-alphanumeric with hyphens, trims hyphens.
 * @param maxLen Truncate to this length (default 80) to avoid oversized slugs
 */
export function slugify(s: string, maxLen = 80): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, maxLen)
    .replace(/-$/, '') // trim trailing hyphen after slice
}

/**
 * Generate a unique slug by appending -1, -2, etc. if the base slug already exists.
 * @param exists Function that returns true if the slug is taken (e.g. `await db.post.findUnique({ where: { slug } })`)
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = base
  let i = 1
  while (await exists(slug)) {
    slug = `${base}-${i++}`
  }
  return slug
}

// ============================================================
// Date helpers — consolidated from ~75 sites
// ============================================================

/** Common time constants in milliseconds */
export const MS = {
  SECOND: 1000,
  MINUTE: 60_000,
  HOUR: 3_600_000,
  DAY: 86_400_000,
  WEEK: 604_800_000,
  THIRTY_DAYS: 30 * 86_400_000,
} as const

/** Add N days to a date (returns new Date) */
export function addDays(date: Date | number, days: number): Date {
  return new Date((date instanceof Date ? date.getTime() : date) + days * MS.DAY)
}

/** Subtract N days from now (returns Date for "X days ago") */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MS.DAY)
}

/** Hours from now (returns Date) */
export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * MS.HOUR)
}

/**
 * Format a date in pt-BR. Consolidates ~30 sites using toLocaleString/toLocaleDateString.
 * @param style 'short' = dd/mm/yyyy, 'datetime' = dd/mm/yyyy hh:mm, 'long' = dd de mês de yyyy
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  style: 'short' | 'datetime' | 'long' | 'time' = 'short'
): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  switch (style) {
    case 'short':
      return d.toLocaleDateString('pt-BR')
    case 'datetime':
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    case 'long':
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    case 'time':
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
}

/** Format a short relative date: "há 2 horas", "ontem", "em 3 dias" */
export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  const diff = d.getTime() - Date.now()
  const absDiff = Math.abs(diff)
  const isPast = diff < 0
  if (absDiff < MS.HOUR) return isPast ? 'agora' : 'em instantes'
  if (absDiff < MS.DAY) {
    const hours = Math.floor(absDiff / MS.HOUR)
    return isPast ? `há ${hours}h` : `em ${hours}h`
  }
  if (absDiff < MS.WEEK) {
    const days = Math.floor(absDiff / MS.DAY)
    return isPast ? (days === 1 ? 'ontem' : `há ${days} dias`) : (days === 1 ? 'amanhã' : `em ${days} dias`)
  }
  return formatDate(d, 'short')
}

// ============================================================
// Currency / number formatting — consolidated from ~15 sites
// ============================================================

/** Format cents (R$ 4990) as BRL string: "R$ 49,90" */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, style: 'currency', currency: 'BRL' })
}

/** Format a number as pt-BR with thousands separator */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** Format a phone number for display: (66) 99999-0000 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.length === 13 || d.length === 12) {
    // 55 66 99999 0000
    const dd = d.slice(-10, -8)
    const part1 = d.slice(-8, -4)
    const part2 = d.slice(-4)
    return `(${dd}) ${part1}-${part2}`
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  }
  return phone
}

/** Normalize a phone number to digits only (for wa.me / tel: links) */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

// ============================================================
// Document formatting (CPF/CNPJ) — consolidated from 4 sites
// ============================================================

/** Format a CPF/CNPJ with mask. Returns '—' if empty for display. */
export function formatDocument(doc: string | null | undefined, type: 'CPF' | 'CNPJ' | string): string {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (type === 'CPF' && d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (type === 'CNPJ' && d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return d
}

/** Validate a CPF or CNPJ (basic format check — not check-digit) */
export function validateDocument(doc: string, type: 'CPF' | 'CNPJ'): boolean {
  const d = doc.replace(/\D/g, '')
  if (type === 'CPF') return d.length === 11
  if (type === 'CNPJ') return d.length === 14
  return false
}

// ============================================================
// URL validation — consolidated from 5+ sites
// ============================================================

/**
 * Normalize a URL: ensure http(s) protocol, return null if invalid.
 * Strips javascript:, data:, file: protocols (XSS protection).
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(withProto)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

// ============================================================
// Default avatar — consolidated from 4 sites
// ============================================================

const AVATAR_COLORS = ['2563eb', '0369a1', '4285F4', '7c3aed', 'db2777', 'dc2626', 'ea580c', '16a34a', '0891b2', '9333ea']

/**
 * Generate a default avatar URL using Dicebear initials service.
 * Color is deterministic based on name hash (so same name always gets same color).
 */
export function defaultAvatar(name: string, bg?: string): string {
  const seed = encodeURIComponent(name || '?')
  const backgroundColor = bg || AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=${backgroundColor}&textColor=fff`
}

// ============================================================
// Static Tailwind color class map — fixes 70+ dynamic class purges
// ============================================================

export interface ColorClasses {
  bg: string       // bg-amber-100
  text: string     // text-amber-800
  bgSolid: string  // bg-amber-600
  bgSolidHover: string // hover:bg-amber-700
  border: string   // border-amber-600
  textSolid: string // text-amber-600
  bgMedium: string // bg-amber-500 (for badges, swatches)
  bgLight: string  // bg-amber-50 (for subtle backgrounds)
  borderLight: string // border-amber-200
  textMedium: string // text-amber-700
}

const COLOR_CLASS_MAP: Record<string, ColorClasses> = {
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-800',    bgSolid: 'bg-blue-600',    bgSolidHover: 'hover:bg-blue-700',    border: 'border-blue-600',    textSolid: 'text-blue-600',    bgMedium: 'bg-blue-500',    bgLight: 'bg-blue-50',    borderLight: 'border-blue-200',    textMedium: 'text-blue-700' },
  red:     { bg: 'bg-red-100',     text: 'text-red-800',     bgSolid: 'bg-red-600',     bgSolidHover: 'hover:bg-red-700',     border: 'border-red-600',     textSolid: 'text-red-600',     bgMedium: 'bg-red-500',     bgLight: 'bg-red-50',     borderLight: 'border-red-200',     textMedium: 'text-red-700' },
  green:   { bg: 'bg-green-100',   text: 'text-green-800',   bgSolid: 'bg-green-600',   bgSolidHover: 'hover:bg-green-700',   border: 'border-green-600',   textSolid: 'text-green-600',   bgMedium: 'bg-green-500',   bgLight: 'bg-green-50',   borderLight: 'border-green-200',   textMedium: 'text-green-700' },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-800',   bgSolid: 'bg-amber-600',   bgSolidHover: 'hover:bg-amber-700',   border: 'border-amber-600',   textSolid: 'text-amber-600',   bgMedium: 'bg-amber-500',   bgLight: 'bg-amber-50',   borderLight: 'border-amber-200',   textMedium: 'text-amber-700' },
  purple:  { bg: 'bg-purple-100',  text: 'text-purple-800',  bgSolid: 'bg-purple-600',  bgSolidHover: 'hover:bg-purple-700',  border: 'border-purple-600',  textSolid: 'text-purple-600',  bgMedium: 'bg-purple-500',  bgLight: 'bg-purple-50',  borderLight: 'border-purple-200',  textMedium: 'text-purple-700' },
  pink:    { bg: 'bg-pink-100',    text: 'text-pink-800',    bgSolid: 'bg-pink-600',    bgSolidHover: 'hover:bg-pink-700',    border: 'border-pink-600',    textSolid: 'text-pink-600',    bgMedium: 'bg-pink-500',    bgLight: 'bg-pink-50',    borderLight: 'border-pink-200',    textMedium: 'text-pink-700' },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-800',    bgSolid: 'bg-rose-600',    bgSolidHover: 'hover:bg-rose-700',    border: 'border-rose-600',    textSolid: 'text-rose-600',    bgMedium: 'bg-rose-500',    bgLight: 'bg-rose-50',    borderLight: 'border-rose-200',    textMedium: 'text-rose-700' },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-800',  bgSolid: 'bg-orange-600',  bgSolidHover: 'hover:bg-orange-700',  border: 'border-orange-600',  textSolid: 'text-orange-600',  bgMedium: 'bg-orange-500',  bgLight: 'bg-orange-50',  borderLight: 'border-orange-200',  textMedium: 'text-orange-700' },
  lime:    { bg: 'bg-lime-100',    text: 'text-lime-800',    bgSolid: 'bg-lime-600',    bgSolidHover: 'hover:bg-lime-700',    border: 'border-lime-600',    textSolid: 'text-lime-600',    bgMedium: 'bg-lime-500',    bgLight: 'bg-lime-50',    borderLight: 'border-lime-200',    textMedium: 'text-lime-700' },
  teal:    { bg: 'bg-teal-100',    text: 'text-teal-800',    bgSolid: 'bg-teal-600',    bgSolidHover: 'hover:bg-teal-700',    border: 'border-teal-600',    textSolid: 'text-teal-600',    bgMedium: 'bg-teal-500',    bgLight: 'bg-teal-50',    borderLight: 'border-teal-200',    textMedium: 'text-teal-700' },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-800',    bgSolid: 'bg-cyan-600',    bgSolidHover: 'hover:bg-cyan-700',    border: 'border-cyan-600',    textSolid: 'text-cyan-600',    bgMedium: 'bg-cyan-500',    bgLight: 'bg-cyan-50',    borderLight: 'border-cyan-200',    textMedium: 'text-cyan-700' },
  sky:     { bg: 'bg-sky-100',     text: 'text-sky-800',     bgSolid: 'bg-sky-600',     bgSolidHover: 'hover:bg-sky-700',     border: 'border-sky-600',     textSolid: 'text-sky-600',     bgMedium: 'bg-sky-500',     bgLight: 'bg-sky-50',     borderLight: 'border-sky-200',     textMedium: 'text-sky-700' },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-800',  bgSolid: 'bg-indigo-600',  bgSolidHover: 'hover:bg-indigo-700',  border: 'border-indigo-600',  textSolid: 'text-indigo-600',  bgMedium: 'bg-indigo-500',  bgLight: 'bg-indigo-50',  borderLight: 'border-indigo-200',  textMedium: 'text-indigo-700' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', bgSolid: 'bg-emerald-600', bgSolidHover: 'hover:bg-emerald-700', border: 'border-emerald-600', textSolid: 'text-emerald-600', bgMedium: 'bg-emerald-500', bgLight: 'bg-emerald-50', borderLight: 'border-emerald-200', textMedium: 'text-emerald-700' },
  slate:   { bg: 'bg-slate-100',   text: 'text-slate-800',   bgSolid: 'bg-slate-600',   bgSolidHover: 'hover:bg-slate-700',   border: 'border-slate-600',   textSolid: 'text-slate-600',   bgMedium: 'bg-slate-500',   bgLight: 'bg-slate-50',   borderLight: 'border-slate-200',   textMedium: 'text-slate-700' },
  zinc:    { bg: 'bg-zinc-100',    text: 'text-zinc-800',    bgSolid: 'bg-zinc-600',    bgSolidHover: 'hover:bg-zinc-700',    border: 'border-zinc-600',    textSolid: 'text-zinc-600',    bgMedium: 'bg-zinc-500',    bgLight: 'bg-zinc-50',    borderLight: 'border-zinc-200',    textMedium: 'text-zinc-700' },
}

/** Get static Tailwind color classes for a color name (fixes JIT purging of dynamic `bg-${color}-100`) */
export function getColorClasses(color: string | null | undefined): ColorClasses {
  return COLOR_CLASS_MAP[color || 'zinc'] || COLOR_CLASS_MAP.zinc
}


