/**
 * Header Theme Config — centralized configuration for all header visual settings.
 *
 * All settings are stored in SeoSetting as key-value pairs.
 * This module provides typed access + defaults + CSS variable generation.
 *
 * Settings are organized in groups:
 * 1. Top bar (utility bar) — bg color, text color
 * 2. Navigation — font family, weight, text color, hover color, bg color
 * 3. Breaking ticker — speed, bg color, text color, font size
 * 4. Header ad fallback — toggle, text, colors, border, link
 * 5. Classified buttons — size preset (compact/default/large)
 * 6. Quotes widget — size preset (small/medium/large)
 */

// === Types ===

export interface HeaderThemeConfig {
  // Top bar (utility bar — currently hardcoded as bg-zinc-900)
  topbar_bg_color: string
  topbar_text_color: string
  topbar_show: boolean

  // Navigation
  nav_font_family: string // see FONT_FAMILY_OPTIONS (16 modern fonts)
  nav_font_weight: number // 300 | 400 | 500 | 600 | 700 | 800 | 900
  nav_font_size: number // px (default 14)
  nav_text_color: string
  nav_hover_color: string
  nav_active_color: string
  nav_bg_color: string
  nav_height: number // px

  // Breaking ticker
  breaking_speed: number // seconds (animation duration)
  breaking_bg_color: string
  breaking_text_color: string
  breaking_font_size: number // px
  breaking_label_text: string // "URGENTE" or custom

  // Header ad fallback ("Anuncie Aqui" when no ads)
  ad_fallback_enabled: boolean
  ad_fallback_text: string
  ad_fallback_bg_color: string
  ad_fallback_text_color: string
  ad_fallback_border_color: string
  ad_fallback_border_width: number // px (0 = no border)
  ad_fallback_link_url: string // WhatsApp or any URL
  ad_fallback_font_size: number // px
  ad_fallback_height: number // px

  // Classified + store buttons
  classified_button_size: 'compact' | 'default' | 'large'
  store_button_size: 'compact' | 'default' | 'large'

  // Quotes widget
  quotes_widget_size: 'small' | 'medium' | 'large'
}

// === Defaults (match current hardcoded values) ===

export const DEFAULT_HEADER_THEME: HeaderThemeConfig = {
  topbar_bg_color: '#18181b', // zinc-900
  topbar_text_color: '#d4d4d8', // zinc-300
  topbar_show: true,

  nav_font_family: 'inherit',
  nav_font_weight: 600,
  nav_font_size: 14, // text-sm
  nav_text_color: '#374151', // zinc-700
  nav_hover_color: '#18181b', // zinc-900
  nav_active_color: '#2563eb', // primary blue
  nav_bg_color: '', // empty = transparent (inherits from header bg)
  nav_height: 44, // h-11 = 44px

  breaking_speed: 60, // 60s
  breaking_bg_color: '', // empty = use primary color
  breaking_text_color: '#ffffff',
  breaking_font_size: 12, // text-xs = 12px
  breaking_label_text: 'URGENTE',

  ad_fallback_enabled: true,
  ad_fallback_text: 'Anuncie Aqui',
  ad_fallback_bg_color: '#f4f4f5', // zinc-100
  ad_fallback_text_color: '#2563eb', // primary
  ad_fallback_border_color: '#e4e4e7', // zinc-200
  ad_fallback_border_width: 1,
  ad_fallback_link_url: '', // empty = no link
  ad_fallback_font_size: 13,
  ad_fallback_height: 40,

  classified_button_size: 'default',
  store_button_size: 'default',

  quotes_widget_size: 'medium',
}

// === Load from SeoSetting key-value store ===

/**
 * Load header theme config from a settings record (SeoSetting key-value).
 * Missing keys fall back to defaults.
 */
export function loadHeaderTheme(settings: Record<string, string>): HeaderThemeConfig {
  const get = (key: keyof HeaderThemeConfig, fallback: any) => {
    const v = settings[`header_theme_${key}`]
    if (v === undefined || v === '') return fallback
    if (typeof fallback === 'boolean') return v === 'true'
    if (typeof fallback === 'number') {
      const n = parseFloat(v)
      return isNaN(n) ? fallback : n
    }
    return v
  }

  return {
    topbar_bg_color: get('topbar_bg_color', DEFAULT_HEADER_THEME.topbar_bg_color),
    topbar_text_color: get('topbar_text_color', DEFAULT_HEADER_THEME.topbar_text_color),
    topbar_show: get('topbar_show', DEFAULT_HEADER_THEME.topbar_show),

    nav_font_family: get('nav_font_family', DEFAULT_HEADER_THEME.nav_font_family),
    nav_font_weight: get('nav_font_weight', DEFAULT_HEADER_THEME.nav_font_weight),
    nav_font_size: get('nav_font_size', DEFAULT_HEADER_THEME.nav_font_size),
    nav_text_color: get('nav_text_color', DEFAULT_HEADER_THEME.nav_text_color),
    nav_hover_color: get('nav_hover_color', DEFAULT_HEADER_THEME.nav_hover_color),
    nav_active_color: get('nav_active_color', DEFAULT_HEADER_THEME.nav_active_color),
    // nav_bg_color: prefer header_theme_nav_bg_color, fall back to legacy nav_bg_color (from Header & Logo tab)
    nav_bg_color: get('nav_bg_color', settings.nav_bg_color || DEFAULT_HEADER_THEME.nav_bg_color),
    nav_height: get('nav_height', DEFAULT_HEADER_THEME.nav_height),

    breaking_speed: get('breaking_speed', DEFAULT_HEADER_THEME.breaking_speed),
    breaking_bg_color: get('breaking_bg_color', DEFAULT_HEADER_THEME.breaking_bg_color),
    breaking_text_color: get('breaking_text_color', DEFAULT_HEADER_THEME.breaking_text_color),
    breaking_font_size: get('breaking_font_size', DEFAULT_HEADER_THEME.breaking_font_size),
    breaking_label_text: get('breaking_label_text', DEFAULT_HEADER_THEME.breaking_label_text),

    ad_fallback_enabled: get('ad_fallback_enabled', DEFAULT_HEADER_THEME.ad_fallback_enabled),
    ad_fallback_text: get('ad_fallback_text', DEFAULT_HEADER_THEME.ad_fallback_text),
    ad_fallback_bg_color: get('ad_fallback_bg_color', DEFAULT_HEADER_THEME.ad_fallback_bg_color),
    ad_fallback_text_color: get('ad_fallback_text_color', DEFAULT_HEADER_THEME.ad_fallback_text_color),
    ad_fallback_border_color: get('ad_fallback_border_color', DEFAULT_HEADER_THEME.ad_fallback_border_color),
    ad_fallback_border_width: get('ad_fallback_border_width', DEFAULT_HEADER_THEME.ad_fallback_border_width),
    ad_fallback_link_url: get('ad_fallback_link_url', DEFAULT_HEADER_THEME.ad_fallback_link_url),
    ad_fallback_font_size: get('ad_fallback_font_size', DEFAULT_HEADER_THEME.ad_fallback_font_size),
    ad_fallback_height: get('ad_fallback_height', DEFAULT_HEADER_THEME.ad_fallback_height),

    classified_button_size: get('classified_button_size', DEFAULT_HEADER_THEME.classified_button_size),
    store_button_size: get('store_button_size', DEFAULT_HEADER_THEME.store_button_size),

    quotes_widget_size: get('quotes_widget_size', DEFAULT_HEADER_THEME.quotes_widget_size),
  }
}

// === Save to settings record ===

/**
 * Convert a HeaderThemeConfig partial to SeoSetting key-value pairs.
 * Only includes non-default values (to keep the DB clean).
 */
export function saveHeaderTheme(config: Partial<HeaderThemeConfig>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(config)) {
    const fullKey = `header_theme_${key}`
    if (value === undefined) continue
    if (typeof value === 'boolean') result[fullKey] = String(value)
    else if (typeof value === 'number') result[fullKey] = String(value)
    else result[fullKey] = value
  }
  return result
}

// === CSS helpers ===

/** Generate CSS variables for inline style application. */
export function headerThemeToCssVars(config: HeaderThemeConfig): React.CSSProperties {
  const vars: Record<string, string> = {
    '--topbar-bg': config.topbar_bg_color,
    '--topbar-text': config.topbar_text_color,
    '--nav-text': config.nav_text_color,
    '--nav-hover': config.nav_hover_color,
    '--nav-active': config.nav_active_color,
    '--breaking-bg': config.breaking_bg_color || 'var(--primary, #2563eb)',
    '--breaking-text': config.breaking_text_color,
  }
  return vars as React.CSSProperties
}

// === Button size presets ===

export const BUTTON_SIZE_PRESETS = {
  compact: {
    padding: 'px-2.5 py-1',
    fontSize: 'text-[11px]',
    iconSize: 'h-3 w-3',
    gap: 'gap-1',
    height: 'h-7',
  },
  default: {
    padding: 'px-3.5 py-1.5',
    fontSize: 'text-xs',
    iconSize: 'h-3.5 w-3.5',
    gap: 'gap-1.5',
    height: 'h-8',
  },
  large: {
    padding: 'px-5 py-2.5',
    fontSize: 'text-sm',
    iconSize: 'h-4 w-4',
    gap: 'gap-2',
    height: 'h-10',
  },
} as const

export type ButtonSizeKey = keyof typeof BUTTON_SIZE_PRESETS

/** Get button size classes for a preset key. */
export function getButtonSizeClasses(size: string) {
  return BUTTON_SIZE_PRESETS[size as ButtonSizeKey] || BUTTON_SIZE_PRESETS.default
}

// === Quotes widget size presets ===

export const QUOTES_SIZE_PRESETS = {
  small: {
    cardHeight: 'h-7',
    fontSize: 'text-[10px]',
    numberSize: 'text-xs',
    padding: 'px-2',
  },
  medium: {
    cardHeight: 'h-8',
    fontSize: 'text-xs',
    numberSize: 'text-sm',
    padding: 'px-2.5',
  },
  large: {
    cardHeight: 'h-10',
    fontSize: 'text-sm',
    numberSize: 'text-base',
    padding: 'px-3',
  },
} as const

export type QuotesSizeKey = keyof typeof QUOTES_SIZE_PRESETS

/** Get quotes widget classes for a preset key. */
export function getQuotesSizeClasses(size: string) {
  return QUOTES_SIZE_PRESETS[size as QuotesSizeKey] || QUOTES_SIZE_PRESETS.medium
}

// === Font family options — 16 modern, clean, consistent fonts ===

export const FONT_FAMILY_OPTIONS = [
  { value: 'inherit', label: 'Padrão do Sistema', css: 'inherit', category: 'system' },
  { value: 'inter', label: 'Inter', css: '"Inter", system-ui, sans-serif', category: 'sans' },
  { value: 'system-ui', label: 'System UI', css: 'system-ui, -apple-system, sans-serif', category: 'sans' },
  { value: 'helvetica', label: 'Helvetica Neue', css: '"Helvetica Neue", Helvetica, Arial, sans-serif', category: 'sans' },
  { value: 'arial', label: 'Arial', css: 'Arial, "Helvetica Neue", Helvetica, sans-serif', category: 'sans' },
  { value: 'roboto', label: 'Roboto', css: '"Roboto", "Helvetica Neue", sans-serif', category: 'sans' },
  { value: 'asap', label: 'Asap (atual)', css: '"Asap", system-ui, sans-serif', category: 'sans' },
  { value: 'poppins', label: 'Poppins', css: '"Poppins", system-ui, sans-serif', category: 'sans' },
  { value: 'montserrat', label: 'Montserrat', css: '"Montserrat", system-ui, sans-serif', category: 'sans' },
  { value: 'opensans', label: 'Open Sans', css: '"Open Sans", system-ui, sans-serif', category: 'sans' },
  { value: 'lato', label: 'Lato', css: '"Lato", system-ui, sans-serif', category: 'sans' },
  { value: 'georgia', label: 'Georgia (Serif)', css: 'Georgia, "Times New Roman", serif', category: 'serif' },
  { value: 'playfair', label: 'Playfair Display', css: '"Playfair Display", Georgia, serif', category: 'serif' },
  { value: 'merriweather', label: 'Merriweather', css: '"Merriweather", Georgia, serif', category: 'serif' },
  { value: 'jetbrains', label: 'JetBrains Mono', css: '"JetBrains Mono", ui-monospace, monospace', category: 'mono' },
  { value: 'fira', label: 'Fira Code', css: '"Fira Code", ui-monospace, monospace', category: 'mono' },
] as const

// === Font weight options — 7 weights for fine control ===

export const FONT_WEIGHT_OPTIONS = [
  { value: 300, label: 'Light (300)' },
  { value: 400, label: 'Regular (400)' },
  { value: 500, label: 'Medium (500)' },
  { value: 600, label: 'Semibold (600)' },
  { value: 700, label: 'Bold (700)' },
  { value: 800, label: 'Extrabold (800)' },
  { value: 900, label: 'Black (900)' },
] as const

/** Get CSS font-family value for a font key. */
export function getFontFamily(key: string): string {
  return FONT_FAMILY_OPTIONS.find(f => f.value === key)?.css || 'inherit'
}
