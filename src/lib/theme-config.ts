export const THEME_COLOR_DEFAULTS = {
  primary_color: '#2563eb',
  secondary_color: '#0ea5e9',
  accent_color: '#f59e0b',
  header_bg_color: '#ffffff',
  header_text_color: '#18181b',
  nav_bg_color: '#fafafa',
} as const

export const THEME_CSS_VARIABLES = {
  primary_color: '--primary',
  secondary_color: '--secondary',
  accent_color: '--accent',
  header_bg_color: '--header-bg',
  header_text_color: '--header-text',
  nav_bg_color: '--nav-bg',
} as const

// Color controls in the admin use hexadecimal values. Keeping this contract
// strict prevents malformed settings from breaking the generated stylesheet.
export function isValidThemeColor(value: unknown, allowEmpty = false): value is string {
  if (typeof value !== 'string') return false
  const color = value.trim()
  if (!color) return allowEmpty
  return /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)
}

export function normalizeThemeColor(value: unknown, fallback: string): string {
  return isValidThemeColor(value) ? value.trim() : fallback
}

export function getThemeCssVariables(settings: Record<string, string>): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const key of Object.keys(THEME_CSS_VARIABLES) as Array<keyof typeof THEME_CSS_VARIABLES>) {
    variables[THEME_CSS_VARIABLES[key]] = normalizeThemeColor(settings[key], THEME_COLOR_DEFAULTS[key])
  }
  return variables
}

export function isColorSettingKey(key: string): boolean {
  return key.endsWith('_color')
}
