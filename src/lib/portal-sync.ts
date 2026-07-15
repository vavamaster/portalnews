/**
 * Notify the portal that data was updated, so it can refresh immediately.
 * Uses localStorage event (cross-tab) + custom event (same tab) + window focus.
 *
 * Usage:
 *   notifyPortalUpdate('seo')      // after saving SEO settings
 *   notifyPortalUpdate('categories') // after creating/deleting a category
 */
export function notifyPortalUpdate(type: 'seo' | 'categories' | 'sponsored'): void {
  try {
    const key = `${type}-updated`
    const timestamp = Date.now().toString()
    localStorage.setItem(key, timestamp)
    // Dispatch storage event for same-tab listeners (localStorage events don't fire in same tab)
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: timestamp }))
    // Also dispatch a custom event for more reliable same-tab detection
    window.dispatchEvent(new CustomEvent('portal-update', { detail: { type, key, timestamp } }))
  } catch {}
}
