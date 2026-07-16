// Separate thresholds prevent the sticky header from oscillating near the top.
export const HEADER_COLLAPSE_AT = 160
export const HEADER_EXPAND_AT = 40

export function resolveHeaderCollapsed(current: boolean, scrollY: number): boolean {
  const y = Math.max(0, scrollY)
  return current ? y > HEADER_EXPAND_AT : y >= HEADER_COLLAPSE_AT
}
