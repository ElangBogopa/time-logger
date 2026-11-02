/**
 * Small sessionStorage helper for the "no loading flash" pattern in CLAUDE.md,
 * with an age check so stale data is not served.
 *
 * sessionStorage, not localStorage: this is per-tab and clears when the tab
 * closes, which suits cached account data better than keeping it on disk.
 *
 * Every access is guarded. Storage can be blocked in private mode, full, or
 * hold JSON written by an older build, and none of that should break a render.
 */

interface Envelope<T> {
  value: T
  savedAt: number
}

/** The stored value, or null if absent, older than maxAgeMs, or unreadable. */
export function readSession<T>(key: string, maxAgeMs: number): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Envelope<T>
    if (!parsed || typeof parsed.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      window.sessionStorage.removeItem(key)
      return null
    }
    return parsed.value
  } catch {
    return null
  }
}

export function writeSession<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    const envelope: Envelope<T> = { value, savedAt: Date.now() }
    window.sessionStorage.setItem(key, JSON.stringify(envelope))
  } catch {
    // quota or blocked storage — the cache is an optimisation, not state
  }
}

export function clearSession(...keys: string[]): void {
  if (typeof window === 'undefined') return
  try {
    for (const key of keys) window.sessionStorage.removeItem(key)
  } catch {
    // nothing to do
  }
}
